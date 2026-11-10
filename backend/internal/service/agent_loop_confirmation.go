package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/google/uuid"
)

// tryHandlePendingConfirmation verifica se a requisição atual é a confirmação ou cancelamento de uma ação suspensa.
func (l *AgentLoop) tryHandlePendingConfirmation(
	ctx context.Context,
	req domain.UnifiedAssistantRequest,
	threadID, turnID string,
	startTime time.Time,
) (*domain.UnifiedAssistantResponse, bool, error) {
	if l.confirmationGate == nil {
		return nil, false, nil
	}

	userMsg := strings.TrimSpace(req.Message)
	isConfirm := req.ConfirmPendingID != "" || IsExplicitSendConfirmationText(userMsg)
	isCancel := IsExplicitSendCancellationText(userMsg)

	if !isConfirm && !isCancel {
		return nil, false, nil
	}

	var pending *PendingConfirmationRecord
	var err error

	if req.ConfirmPendingID != "" {
		pending, err = l.confirmationGate.GetByID(ctx, req.ConfirmPendingID, req.UserID)
	} else {
		pending, err = l.confirmationGate.GetLatestPending(ctx, req.UserID, threadID)
	}

	if err != nil || pending == nil {
		// Não há pendência no gate; deixa o loop ReAct normal processar
		return nil, false, nil
	}

	// 1. Caso de Cancelamento
	if isCancel {
		_ = l.confirmationGate.Cancel(ctx, pending.ID, req.UserID)
		cancelMsg := fmt.Sprintf("Ação de envio (%s) cancelada. Nada foi enviado.", pending.Operation)
		resp := &domain.UnifiedAssistantResponse{
			ThreadID: threadID,
			TurnID:   turnID,
			Text:     cancelMsg,
			Reply:    cancelMsg,
			Message:  cancelMsg,
			Telemetry: domain.TurnTelemetry{
				LatencyMs: time.Since(startTime).Milliseconds(),
			},
		}
		l.recordConversationTurns(ctx, threadID, turnID, req.UserID, req.Channel, userMsg, cancelMsg, startTime)
		return resp, true, nil
	}

	// 2. Caso de Confirmação -> Aprova no gate e executa a ferramenta de verdade
	resumed, err := l.confirmationGate.Resume(ctx, pending.ID, req.UserID)
	if err != nil {
		return nil, false, err
	}

	toolset, ok := l.registry.Get(domain.ToolsetName(resumed.ToolsetName))
	if !ok || toolset == nil {
		return nil, false, fmt.Errorf("toolset '%s' não encontrado para executar ação confirmada", resumed.ToolsetName)
	}

	execCtx := &domain.ToolExecutionContext{
		UserID:                  req.UserID,
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
		errMsg := fmt.Sprintf("Não consegui concluir o envio (%s): %v", resumed.Operation, execErr)
		resp := &domain.UnifiedAssistantResponse{
			ThreadID: threadID,
			TurnID:   turnID,
			Text:     errMsg,
			Reply:    errMsg,
			Message:  errMsg,
			Telemetry: domain.TurnTelemetry{
				LatencyMs: time.Since(startTime).Milliseconds(),
			},
		}
		l.recordConversationTurns(ctx, threadID, turnID, req.UserID, req.Channel, userMsg, errMsg, startTime)
		return resp, true, nil
	}

	resBytes, _ := json.Marshal(res)
	_ = l.confirmationGate.SaveExecutionResult(ctx, resumed.ID, string(resBytes))

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

	// Anexa cards estruturados específicos para mobile e voz
	for _, c := range res.Cards {
		if c.Type == "whatsapp" {
			resp.WhatsAppMessage = &domain.ChatWhatsAppMessage{
				ID:             c.ID,
				RecipientName:  c.Title,
				Message:        c.Subtitle,
				Status:         "sent",
				SentAt:         time.Now().Format(time.RFC3339),
			}
		} else if c.Type == "gmail" {
			resp.GmailMessage = &domain.ChatGmailMessage{
				ID:             c.ID,
				RecipientEmail: c.Subtitle,
				Subject:        c.Title,
				Status:         "sent",
				SentAt:         time.Now().Format(time.RFC3339),
			}
		}
	}

	l.recordConversationTurns(ctx, threadID, turnID, req.UserID, req.Channel, userMsg, successMsg, startTime)
	return resp, true, nil
}

// persistCompletedTurn persiste no ConversationStore os turnos finais de uma iteração ReAct completa.
func (l *AgentLoop) persistCompletedTurn(
	ctx context.Context,
	threadID, turnID string,
	req domain.UnifiedAssistantRequest,
	finalAnswer string,
	collectedCards []domain.ChatCard,
	executedTools []domain.ExecutedTool,
	collectedReasoning []string,
	chosenProvider string,
	startTime time.Time,
) {
	if l.convRepo == nil {
		return
	}
	_ = l.convRepo.CreateTurn(ctx, &repository.ConversationTurn{
		ID:        turnID,
		ThreadID:  threadID,
		UserID:    req.UserID,
		Channel:   req.Channel,
		Role:      "user",
		Content:   req.Message,
		CreatedAt: startTime,
	})

	cardsBytes, _ := json.Marshal(collectedCards)
	toolsBytes, _ := json.Marshal(executedTools)
	reasonBytes, _ := json.Marshal(collectedReasoning)

	_ = l.convRepo.CreateTurn(ctx, &repository.ConversationTurn{
		ID:                uuid.New().String(),
		ThreadID:          threadID,
		UserID:            req.UserID,
		Channel:           req.Channel,
		Role:              "assistant",
		Content:           finalAnswer,
		ReasoningJSON:     string(reasonBytes),
		ToolCallsJSON:     string(toolsBytes),
		CardsJSON:         string(cardsBytes),
		ModelUsed:         chosenProvider,
		LatencyMs:         time.Since(startTime).Milliseconds(),
		TaintedByExternal: 0,
		CreatedAt:         time.Now().UTC(),
	})
}

func (l *AgentLoop) recordConversationTurns(
	ctx context.Context,
	threadID, turnID, userID, channel, userMsg, assistantMsg string,
	startTime time.Time,
) {
	if l.convRepo == nil {
		return
	}
	if userMsg != "" {
		_ = l.convRepo.CreateTurn(ctx, &repository.ConversationTurn{
			ID:        turnID,
			ThreadID:  threadID,
			UserID:    userID,
			Role:      "user",
			Content:   userMsg,
			Channel:   channel,
			CreatedAt: startTime,
		})
	}
	_ = l.convRepo.CreateTurn(ctx, &repository.ConversationTurn{
		ID:        uuid.New().String(),
		ThreadID:  threadID,
		UserID:    userID,
		Role:      "assistant",
		Content:   assistantMsg,
		Channel:   channel,
		CreatedAt: time.Now(),
	})
}

// formatSuspendedActionResponse formata a mensagem e os cards quando uma ação de escrita é suspensa para confirmação humana.
func formatSuspendedActionResponse(
	operation string,
	pendingID string,
	reason string,
	preview map[string]any,
) (finalAnswer string, card domain.ChatCard, waMsg *domain.ChatWhatsAppMessage, gmailMsg *domain.ChatGmailMessage) {
	switch operation {
	case "send_message":
		rec, _ := preview["recipient"].(string)
		msg, _ := preview["message"].(string)
		if rec == "" {
			rec = "o destinatário"
		}
		finalAnswer = fmt.Sprintf("Preparei a mensagem para %s:\n\n\"%s\"\n\nPosso enviar?", rec, msg)
		card = domain.ChatCard{
			ID:          pendingID,
			Type:        "whatsapp",
			Title:       fmt.Sprintf("WhatsApp para %s", rec),
			Subtitle:    msg,
			ActionLabel: "Confirmar Envio",
			Confirm:     true,
		}
		waMsg = &domain.ChatWhatsAppMessage{
			ID:            pendingID,
			RecipientName: rec,
			Message:       msg,
			Status:        "ready",
		}
	case "send_email":
		to, _ := preview["to"].(string)
		subj, _ := preview["subject"].(string)
		body, _ := preview["body"].(string)
		if subj == "" {
			subj = deriveDefaultEmailSubject(body)
		}
		if to == "" {
			to = "o destinatário"
		}
		finalAnswer = fmt.Sprintf("Preparei o e-mail para %s (Assunto: \"%s\"):\n\n\"%s\"\n\nPosso enviar?", to, subj, body)
		card = domain.ChatCard{
			ID:          pendingID,
			Type:        "gmail",
			Title:       subj,
			Subtitle:    fmt.Sprintf("Para: %s", to),
			ActionLabel: "Confirmar Envio",
			Confirm:     true,
		}
		gmailMsg = &domain.ChatGmailMessage{
			ID:             pendingID,
			RecipientEmail: to,
			Subject:        subj,
			Body:           body,
			Status:         "ready",
		}
	default:
		finalAnswer = fmt.Sprintf("Preparei a ação '%s'. Para sua segurança, você confirma o envio?", operation)
		card = domain.ChatCard{
			ID:          pendingID,
			Type:        "confirm",
			Title:       fmt.Sprintf("Confirmar: %s", operation),
			Subtitle:    reason,
			ActionLabel: "Confirmar Agora",
			Confirm:     true,
		}
	}
	return
}
