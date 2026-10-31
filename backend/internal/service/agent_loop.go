package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
	"github.com/google/uuid"
)

// AgentLoop coordena o loop ReAct, roteamento de modelo, Confirmation Gate e execução de ferramentas.
type AgentLoop struct {
	router           *ai.ModelRouter
	registry         *toolsets.ToolsetsRegistry
	scopeGuard       domain.ScopeGuard
	confirmationGate *ConfirmationGateService
	convRepo         *repository.ConversationStoreRepository
	traceRecorder    ai.TraceRecorder
}

// NewAgentLoop inicializa o cérebro único do assistente.
func NewAgentLoop(
	router *ai.ModelRouter,
	registry *toolsets.ToolsetsRegistry,
	scopeGuard domain.ScopeGuard,
	confirmationGate *ConfirmationGateService,
	convRepo *repository.ConversationStoreRepository,
	traceRecorder ai.TraceRecorder,
) *AgentLoop {
	return &AgentLoop{
		router:           router,
		registry:         registry,
		scopeGuard:       scopeGuard,
		confirmationGate: confirmationGate,
		convRepo:         convRepo,
		traceRecorder:    traceRecorder,
	}
}

// Run executa o loop ReAct síncrono.
func (l *AgentLoop) Run(ctx context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	return l.RunStream(ctx, req, nil)
}

// RunStream executa o loop ReAct emitindo fragmentos em tempo real via callback onDelta.
func (l *AgentLoop) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, onDelta func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	startTime := time.Now()
	turnID := uuid.New().String()

	if req.Message == "" && req.Prompt != "" {
		req.Message = req.Prompt
	}

	// 1. Resolução ou inicialização da thread de conversa
	threadID := req.ThreadID
	if threadID == "" && l.convRepo != nil {
		thread, err := l.convRepo.GetOrCreateThread(ctx, req.UserID, req.Channel, "")
		if err == nil && thread != nil {
			threadID = thread.ID
		}
	}
	if threadID == "" {
		threadID = uuid.New().String()
	}

	// 2. Se a requisição contiver confirmação pendente explícita (clique em card ou "sim")
	if req.ConfirmPendingID != "" && l.confirmationGate != nil {
		pending, err := l.confirmationGate.Resume(ctx, req.ConfirmPendingID, req.UserID)
		if err == nil && pending != nil {
			msg := fmt.Sprintf("Ação '%s' confirmada e executada com sucesso.", pending.Operation)
			resp := &domain.UnifiedAssistantResponse{
				ThreadID: threadID,
				TurnID:   turnID,
				Text:     msg,
				Reply:    msg,
				Message:  msg,
				Telemetry: domain.TurnTelemetry{
					LatencyMs: time.Since(startTime).Milliseconds(),
				},
			}
			return resp, nil
		}
	}

	// 3. Montagem do contexto e persona
	style := ai.PersonaStyle(req.StyleOverride)
	if style == "" {
		style = ai.StyleBalanced
	}
	systemPrompt := ai.BuildPersonaSystemPrompt(style, "Usuário")

	execCtx := &domain.ToolExecutionContext{
		UserID:                  req.UserID,
		ThreadID:                threadID,
		TurnID:                  turnID,
		Channel:                 req.Channel,
		FocusMode:               req.FocusMode,
		TaintedByUntrustedInput: false,
	}

	// 4. Histórico da conversa em turnos reais
	var messages []ai.TurnMessage
	if l.convRepo != nil {
		recent, err := l.convRepo.GetRecentTurns(ctx, threadID, 12)
		if err == nil {
			for _, t := range recent {
				messages = append(messages, ai.TurnMessage{
					Role:    ai.ChatRole(t.Role),
					Content: t.Content,
				})
			}
		}
	}
	messages = append(messages, ai.TurnMessage{
		Role:    ai.RoleUser,
		Content: req.Message,
	})

	// Grava o turno do usuário no repositório
	if l.convRepo != nil {
		_ = l.convRepo.CreateTurn(ctx, &repository.ConversationTurn{
			ID:        turnID,
			ThreadID:  threadID,
			UserID:    req.UserID,
			Channel:   req.Channel,
			Role:      "user",
			Content:   req.Message,
			CreatedAt: time.Now().UTC(),
		})
	}

	// 5. Ciclo ReAct (máx. 4 iterações)
	maxSteps := 4
	var collectedReasoning []string
	var executedTools []domain.ExecutedTool
	var collectedCards []domain.ChatCard
	var collectedSources []domain.SearchSource
	var finalAnswer string
	var chosenProvider ai.AgentProvider

	toolDefs := l.registry.Definitions()

	for step := 0; step < maxSteps; step++ {
		stepReq := ai.AgentChatRequest{
			ThreadID:     threadID,
			UserID:       req.UserID,
			Channel:      req.Channel,
			Task:         ai.TaskToolUse,
			SystemPrompt: systemPrompt,
			Messages:     messages,
			Tools:        toolDefs,
			RequireTools: false,
		}

		provider, err := l.router.SelectProvider(ctx, stepReq)
		if err != nil {
			return nil, fmt.Errorf("falha ao selecionar provedor no router: %w", err)
		}
		chosenProvider = provider

		var stepResp *ai.AgentChatResponse
		if onDelta != nil && step == 0 {
			stepResp, err = provider.StreamChat(ctx, stepReq, onDelta)
		} else {
			stepResp, err = provider.Chat(ctx, stepReq)
		}
		if err != nil {
			return nil, fmt.Errorf("erro na chamada ao provedor de IA (%s): %w", provider.Name(), err)
		}

		if len(stepResp.Reasoning) > 0 {
			collectedReasoning = append(collectedReasoning, stepResp.Reasoning...)
		}

		// Se o modelo não chamou ferramentas, encerrou o raciocínio
		if len(stepResp.ToolCalls) == 0 {
			finalAnswer = stepResp.Text
			break
		}

		// Processa as ferramentas invocadas
		hasSuspendedTool := false
		var pendingID string

		for _, call := range stepResp.ToolCalls {
			toolset, exists := l.registry.Get(domain.ToolsetName(call.Name))
			if !exists {
				continue
			}

			var envelope domain.ToolOperationEnvelope
			_ = json.Unmarshal(call.Arguments, &envelope)
			if envelope.Operation == "" {
				envelope.Operation = "default"
			}

			isWrite, _, preview := toolset.IsWriteOperation(envelope.Operation, envelope.Params)
			allowed, reason := l.scopeGuard.CanExecute(ctx, execCtx, envelope.Operation, isWrite)

			if !allowed {
				// Interrompe via Confirmation Gate
				if l.confirmationGate != nil {
					previewBytes, _ := json.Marshal(preview)
					p, err := l.confirmationGate.CreatePending(ctx, &CreatePendingRequest{
						UserID:         req.UserID,
						ThreadID:       threadID,
						Channel:        req.Channel,
						ToolsetName:    string(toolset.Name()),
						Operation:      envelope.Operation,
						ArgumentsJSON:  string(call.Arguments),
						PreviewJSON:    string(previewBytes),
						TaintedContext: execCtx.TaintedByUntrustedInput,
					})
					if err == nil && p != nil {
						pendingID = p.ID
						hasSuspendedTool = true
						executedTools = append(executedTools, domain.ExecutedTool{
							Tool:      call.Name,
							Operation: envelope.Operation,
							Status:    "AWAITING_USER_CONFIRMATION",
						})
						collectedCards = append(collectedCards, domain.ChatCard{
							ID:          p.ID,
							Type:        "confirm",
							Title:       fmt.Sprintf("Confirmar: %s", envelope.Operation),
							Subtitle:    reason,
							ActionLabel: "Confirmar Agora",
							Confirm:     true,
						})
						finalAnswer = fmt.Sprintf("Preparei a ação '%s'. Para sua segurança, você confirma o envio?", envelope.Operation)
						break
					}
				}
			}

			// Executa a macro-ferramenta em Go
			res, execErr := toolset.Execute(ctx, execCtx, envelope.Operation, envelope.Params)
			if execErr != nil {
				executedTools = append(executedTools, domain.ExecutedTool{
					Tool:      call.Name,
					Operation: envelope.Operation,
					Status:    "ERROR",
				})
				continue
			}

			executedTools = append(executedTools, domain.ExecutedTool{
				Tool:      call.Name,
				Operation: envelope.Operation,
				Status:    res.Status,
			})
			if len(res.Cards) > 0 {
				collectedCards = append(collectedCards, res.Cards...)
			}
			if len(res.Sources) > 0 {
				collectedSources = append(collectedSources, res.Sources...)
			}
			if res.MarksContextAsTainted {
				execCtx.TaintedByUntrustedInput = true
				l.scopeGuard.MarkTainted(ctx, turnID, res.TaintSourceLabel)
			}

			// Alimenta o resultado de volta ao diálogo como turno RoleTool
			messages = append(messages, ai.TurnMessage{
				Role:       ai.RoleTool,
				ToolCallID: call.ID,
				Name:       call.Name,
				Content:    res.SummaryForLLM,
			})
		}

		if hasSuspendedTool {
			resp := &domain.UnifiedAssistantResponse{
				ThreadID:              threadID,
				TurnID:                turnID,
				Text:                  finalAnswer,
				Reply:                 finalAnswer,
				Message:               finalAnswer,
				Reasoning:             collectedReasoning,
				ToolCalls:             executedTools,
				Cards:                 collectedCards,
				RequiresConfirmation:  true,
				PendingConfirmationID: pendingID,
				Telemetry: domain.TurnTelemetry{
					ProviderUsed: chosenProvider.Name(),
					ModelUsed:    chosenProvider.ModelName(),
					LatencyMs:    time.Since(startTime).Milliseconds(),
				},
			}
			return resp, nil
		}
	}

	// 6. Grava resposta do assistente no ConversationStore
	if l.convRepo != nil {
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
			ModelUsed:         chosenProvider.ModelName(),
			LatencyMs:         time.Since(startTime).Milliseconds(),
			TaintedByExternal: 0,
			CreatedAt:         time.Now().UTC(),
		})
	}

	return &domain.UnifiedAssistantResponse{
		ThreadID:         threadID,
		TurnID:           turnID,
		Text:             finalAnswer,
		Reply:            finalAnswer,
		Message:          finalAnswer,
		Reasoning:        collectedReasoning,
		ToolCalls:        executedTools,
		Cards:            collectedCards,
		Sources:          collectedSources,
		SuggestedActions: []string{"Ver tarefas", "Próximo compromisso"},
		Telemetry: domain.TurnTelemetry{
			ProviderUsed: chosenProvider.Name(),
			ModelUsed:    chosenProvider.ModelName(),
			LatencyMs:    time.Since(startTime).Milliseconds(),
		},
	}, nil
}
