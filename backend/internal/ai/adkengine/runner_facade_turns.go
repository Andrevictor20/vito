package adkengine

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func (f *ADKLoopFacade) tryHandlePendingConfirmation(
	ctx context.Context,
	req domain.UnifiedAssistantRequest,
	userID, threadID, turnID string,
	startTime time.Time,
	onDelta func(ai.StreamDelta) error,
) (*domain.UnifiedAssistantResponse, bool, error) {
	if f.cfg.ConfirmationGate == nil {
		return nil, false, nil
	}

	userMsg := strings.TrimSpace(req.Message)
	isConfirm := req.ConfirmPendingID != "" || service.IsShortConfirmationReply(userMsg)
	isCancel := req.RejectPendingID != "" || service.IsExplicitSendCancellationText(userMsg)

	if !isConfirm && !isCancel {
		return nil, false, nil
	}

	var pending *service.PendingConfirmationRecord
	var err error
	if req.ConfirmPendingID != "" {
		pending, err = f.cfg.ConfirmationGate.GetByID(ctx, req.ConfirmPendingID, userID)
		if err != nil || pending == nil {
			if err == nil {
				err = service.ErrConfirmationNotFound
			}
			return nil, true, err
		}
	} else if req.RejectPendingID != "" {
		pending, err = f.cfg.ConfirmationGate.GetByID(ctx, req.RejectPendingID, userID)
		if err != nil || pending == nil {
			if err == nil {
				err = service.ErrConfirmationNotFound
			}
			return nil, true, err
		}
	} else {
		pending, err = f.cfg.ConfirmationGate.GetLatestPending(ctx, userID, threadID)
	}
	if err != nil || pending == nil {
		return nil, false, nil
	}

	emitStreamFinal := func(msg string) {
		if onDelta != nil {
			if msg != "" {
				_ = onDelta(ai.StreamDelta{TextDelta: msg})
			}
			_ = onDelta(ai.StreamDelta{Done: true})
		}
	}

	if isCancel {
		_ = f.cfg.ConfirmationGate.CancelWithReason(ctx, pending.ID, userID, userMsg)
		cancelMsg := FormatCancelledAction(pending.Operation)
		f.recordSimpleTurns(ctx, threadID, turnID, userID, req.Channel, userMsg, cancelMsg, startTime)
		emitStreamFinal(cancelMsg)
		return &domain.UnifiedAssistantResponse{
			ThreadID:  threadID,
			TurnID:    turnID,
			Text:      cancelMsg,
			Reply:     cancelMsg,
			Message:   cancelMsg,
			Telemetry: domain.TurnTelemetry{LatencyMs: time.Since(startTime).Milliseconds()},
		}, true, nil
	}

	resumed, err := f.cfg.ConfirmationGate.Resume(ctx, pending.ID, userID)
	if err != nil {
		if req.ConfirmPendingID != "" {
			return nil, true, err
		}
		return nil, false, err
	}
	if f.cfg.Registry == nil {
		return nil, false, fmt.Errorf("registry de toolsets não configurado")
	}
	toolset, ok := f.cfg.Registry.Get(domain.ToolsetName(resumed.ToolsetName))
	if !ok || toolset == nil {
		return nil, false, fmt.Errorf("toolset '%s' não encontrado", resumed.ToolsetName)
	}

	execCtx := &domain.ToolExecutionContext{
		UserID:                  userID,
		ThreadID:                threadID,
		TurnID:                  turnID,
		Channel:                 req.Channel,
		FocusMode:               req.FocusMode,
		AutonomyLevel:           "confirmed",
		TaintedByUntrustedInput: resumed.TaintedContext,
	}

	rawArgs := json.RawMessage(resumed.ArgumentsJSON)
	var env domain.ToolOperationEnvelope
	if err := json.Unmarshal(rawArgs, &env); err == nil && len(env.Params) > 0 {
		rawArgs = env.Params
	}

	res, execErr := toolset.Execute(ctx, execCtx, resumed.Operation, rawArgs)
	if execErr != nil {
		log.Printf("⚠️ [ADKLoopFacade] falha ao executar ação confirmada %s.%s: %v", resumed.ToolsetName, resumed.Operation, execErr)
		errMsg := FormatActionError(resumed.Operation, execErr)
		f.recordSimpleTurns(ctx, threadID, turnID, userID, req.Channel, userMsg, errMsg, startTime)
		emitStreamFinal(errMsg)
		return &domain.UnifiedAssistantResponse{
			ThreadID:  threadID,
			TurnID:    turnID,
			Text:      errMsg,
			Reply:     errMsg,
			Message:   errMsg,
			Telemetry: domain.TurnTelemetry{LatencyMs: time.Since(startTime).Milliseconds()},
		}, true, nil
	}

	resBytes, _ := json.Marshal(res)
	_ = f.cfg.ConfirmationGate.SaveExecutionResult(ctx, resumed.ID, string(resBytes))

	successMsg := res.SummaryForLLM
	if strings.TrimSpace(successMsg) == "" {
		successMsg = fmt.Sprintf("Ação '%s' executada com sucesso.", resumed.Operation)
	}

	resp := &domain.UnifiedAssistantResponse{
		ThreadID:  threadID,
		TurnID:    turnID,
		Text:      successMsg,
		Reply:     successMsg,
		Message:   successMsg,
		Cards:     res.Cards,
		Telemetry: domain.TurnTelemetry{LatencyMs: time.Since(startTime).Milliseconds()},
	}
	ExtractToolEntities(resumed.Operation, res.Data).ApplyToResponse(resp)
	waMsg, gmailMsg := extractMessageCards(res.Cards)
	if waMsg != nil {
		resp.WhatsAppMessage = waMsg
	}
	if gmailMsg != nil {
		resp.GmailMessage = gmailMsg
	}

	f.recordSimpleTurns(ctx, threadID, turnID, userID, req.Channel, userMsg, successMsg, startTime)
	emitStreamFinal(successMsg)
	return resp, true, nil
}

func (f *ADKLoopFacade) persistCompletedTurn(
	ctx context.Context,
	threadID, turnID string,
	req domain.UnifiedAssistantRequest,
	finalAnswer string,
	collectedCards []domain.ChatCard,
	executedTools []domain.ExecutedTool,
	collectedReasoning []string,
	modelUsed string,
	startTime time.Time,
) {
	if f.cfg.ConvRepo == nil {
		return
	}
	cardsBytes, _ := json.Marshal(collectedCards)
	toolsBytes, _ := json.Marshal(executedTools)
	reasonBytes, _ := json.Marshal(collectedReasoning)

	_ = f.cfg.ConvRepo.CreateTurn(ctx, &repository.ConversationTurn{
		ID:        turnID,
		ThreadID:  threadID,
		UserID:    req.UserID,
		Channel:   req.Channel,
		Role:      "user",
		Content:   req.Message,
		CreatedAt: startTime,
	})
	_ = f.cfg.ConvRepo.CreateTurn(ctx, &repository.ConversationTurn{
		ID:            uuid.New().String(),
		ThreadID:      threadID,
		UserID:        req.UserID,
		Channel:       req.Channel,
		Role:          "assistant",
		Content:       finalAnswer,
		ReasoningJSON: string(reasonBytes),
		ToolCallsJSON: string(toolsBytes),
		CardsJSON:     string(cardsBytes),
		ModelUsed:     modelUsed,
		LatencyMs:     time.Since(startTime).Milliseconds(),
		CreatedAt:     time.Now().UTC(),
	})
}

func (f *ADKLoopFacade) recordSimpleTurns(
	ctx context.Context,
	threadID, turnID, userID, channel, userMsg, assistantMsg string,
	startTime time.Time,
) {
	if f.cfg.ConvRepo == nil {
		return
	}
	if userMsg != "" {
		_ = f.cfg.ConvRepo.CreateTurn(ctx, &repository.ConversationTurn{
			ID:        turnID,
			ThreadID:  threadID,
			UserID:    userID,
			Role:      "user",
			Content:   userMsg,
			Channel:   channel,
			CreatedAt: startTime,
		})
	}
	_ = f.cfg.ConvRepo.CreateTurn(ctx, &repository.ConversationTurn{
		ID:        uuid.New().String(),
		ThreadID:  threadID,
		UserID:    userID,
		Role:      "assistant",
		Content:   assistantMsg,
		Channel:   channel,
		CreatedAt: time.Now().UTC(),
	})
}
