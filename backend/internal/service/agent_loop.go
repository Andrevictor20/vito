package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
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
	userRepo         domain.UserRepository
	aiSettingsRepo   domain.AISettingsRepository
	contextEnricher  *AssistantContextEnricher
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

// SetUserRepositories injeta os repositórios para resolução do nome real e persona style do usuário.
func (l *AgentLoop) SetUserRepositories(userRepo domain.UserRepository, aiSettingsRepo domain.AISettingsRepository) {
	l.userRepo = userRepo
	l.aiSettingsRepo = aiSettingsRepo
}

// SetContextEnricher configura o motor de injeção de contexto Nível 1.
func (l *AgentLoop) SetContextEnricher(enricher *AssistantContextEnricher) {
	l.contextEnricher = enricher
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
	} else if threadID != "" && l.convRepo != nil {
		// Garante que a thread existe isolada no repositório
		_, _ = l.convRepo.GetOrCreateThread(ctx, req.UserID, req.Channel, threadID)
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

	// 3. Montagem do contexto e persona humana real
	userName := "você"
	personaStyle := ai.StyleBalanced

	if l.userRepo != nil && req.UserID != "" {
		if u, err := l.userRepo.GetByID(req.UserID); err == nil && u != nil && u.Name != "" {
			parts := strings.Fields(u.Name)
			if len(parts) > 0 {
				userName = parts[0]
			}
		}
	}
	if req.StyleOverride != "" {
		personaStyle = ai.PersonaStyle(req.StyleOverride)
	} else if l.aiSettingsRepo != nil && req.UserID != "" {
		if s, err := l.aiSettingsRepo.GetSettings(req.UserID); err == nil && s != nil && s.PersonaStyle != "" {
			personaStyle = ai.PersonaStyle(s.PersonaStyle)
		}
	}
	systemPrompt := ai.BuildPersonaSystemPromptWithChannel(personaStyle, userName, time.Now(), req.Channel)
	if l.contextEnricher != nil && req.UserID != "" {
		if lvl1 := l.contextEnricher.BuildLevel1Context(ctx, req.UserID, req.Message, startTime); lvl1 != "" {
			systemPrompt = systemPrompt + "\n\n" + lvl1
		}
	}

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
	if l.convRepo != nil && threadID != "" {
		recent, err := l.convRepo.GetRecentTurns(ctx, threadID, 12)
		if err == nil && len(recent) > 0 {
			for _, t := range recent {
				messages = append(messages, ai.TurnMessage{
					Role:    ai.ChatRole(t.Role),
					Content: t.Content,
				})
			}
		}
	}

	// Se a thread no SQLite é nova mas o cliente enviou req.History (mesma sessão no cliente)
	if len(messages) == 0 && len(req.History) > 0 {
		startIdx := 0
		if len(req.History) > 8 {
			startIdx = len(req.History) - 8
		}
		for _, h := range req.History[startIdx:] {
			role := ai.RoleUser
			if strings.EqualFold(h.Role, "assistant") || strings.EqualFold(h.Role, "model") {
				role = ai.RoleAssistant
			}
			messages = append(messages, ai.TurnMessage{
				Role:    role,
				Content: h.Content,
			})
		}
	}

	messages = append(messages, ai.TurnMessage{
		Role:    ai.RoleUser,
		Content: req.Message,
	})

	// 5. Ciclo ReAct (máx. 4 iterações)
	maxSteps := 4
	var collectedReasoning []string
	var executedTools []domain.ExecutedTool
	var collectedCards []domain.ChatCard
	var collectedSources []domain.SearchSource
	var finalAnswer string
	var chosenProvider ai.AgentProvider

	toolDefs := l.registry.Definitions()

	isVoiceChannel := strings.Contains(strings.ToLower(req.Channel), "voice")

	for step := 0; step < maxSteps; step++ {
		maxTokens := 0
		if isVoiceChannel {
			maxTokens = 120
		}
		stepReq := ai.AgentChatRequest{
			ThreadID:     threadID,
			UserID:       req.UserID,
			Channel:      req.Channel,
			Task:         ai.TaskToolUse,
			SystemPrompt: systemPrompt,
			Messages:     messages,
			Tools:        toolDefs,
			RequireTools: false,
			MaxTokens:    maxTokens,
		}

		provider, err := l.router.SelectProvider(ctx, stepReq)
		if err != nil {
			return nil, fmt.Errorf("falha ao selecionar provedor no router: %w", err)
		}
		chosenProvider = provider

		var stepResp *ai.AgentChatResponse
		var stepErr error

		if onDelta != nil && step == 0 {
			stepResp, stepErr = provider.StreamChat(ctx, stepReq, onDelta)
		} else {
			stepResp, stepErr = provider.Chat(ctx, stepReq)
		}

		if stepErr != nil {
			// Failover transparente para outros provedores aptos
			fallbacks := l.router.SelectFallbackProviders(ctx, stepReq, provider.Name())
			for _, fb := range fallbacks {
				if onDelta != nil && step == 0 {
					stepResp, stepErr = fb.StreamChat(ctx, stepReq, onDelta)
				} else {
					stepResp, stepErr = fb.Chat(ctx, stepReq)
				}
				if stepErr == nil && stepResp != nil {
					chosenProvider = fb
					break
				}
			}
		}

		if stepErr != nil {
			return nil, fmt.Errorf("erro na chamada ao provedor de IA (%s): %w", chosenProvider.Name(), stepErr)
		}

		if len(stepResp.Reasoning) > 0 {
			collectedReasoning = append(collectedReasoning, stepResp.Reasoning...)
		}

		// Se o modelo não chamou ferramentas, encerrou o raciocínio
		if len(stepResp.ToolCalls) == 0 {
			finalAnswer = stepResp.Text
			break
		}

		// Protocolo ReAct Estrito: Anexa o turno RoleAssistant contendo ToolCalls
		// (e ThoughtSignature) antes de alimentar as respostas das ferramentas (RoleTool)
		messages = append(messages, ai.TurnMessage{
			Role:      ai.RoleAssistant,
			Content:   stepResp.Text,
			Thought:   stepResp.Thought,
			ToolCalls: stepResp.ToolCalls,
		})

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
				var rawMap map[string]any
				if err := json.Unmarshal(call.Arguments, &rawMap); err == nil {
					if opVal, ok := rawMap["operation"].(string); ok && opVal != "" {
						envelope.Operation = opVal
					}
				}
				if envelope.Operation == "" {
					envelope.Operation = "default"
				}
			}
			if len(envelope.Params) == 0 && len(call.Arguments) > 0 {
				envelope.Params = call.Arguments
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
				// Garante turno RoleTool para manter paridade no protocolo ReAct da LLM
				messages = append(messages, ai.TurnMessage{
					Role:       ai.RoleTool,
					ToolCallID: call.ID,
					Name:       call.Name,
					Content:    fmt.Sprintf("Falha ao executar ferramenta %s: %v", call.Name, execErr),
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

	// 5.1 Garantia de Síntese Final Factual: finalAnswer nunca pode ser vazio.
	// Se ferramentas foram executadas mas a LLM não concluiu em texto na última iteração,
	// dispara uma chamada de síntese forçada sem ferramentas para transformar os dados apurados em resposta textual.
	if strings.TrimSpace(finalAnswer) == "" {
		if len(executedTools) > 0 && chosenProvider != nil {
			synthReq := ai.AgentChatRequest{
				ThreadID:     threadID,
				UserID:       req.UserID,
				Channel:      req.Channel,
				Task:         ai.TaskChat,
				SystemPrompt: systemPrompt + "\n\nDIRETRIZ MANDATÓRIA: Sintetize os dados factuais obtidos pelas ferramentas acima diretamente para o usuário em texto claro, objetivo e em português. NUNCA finalize vazio nem responda apenas 'comando executado'.",
				Messages:     messages,
				Tools:        nil, // Sem ferramentas para forçar resposta em texto
				RequireTools: false,
			}
			synthResp, synthErr := chosenProvider.Chat(ctx, synthReq)
			if synthErr == nil && synthResp != nil && strings.TrimSpace(synthResp.Text) != "" {
				finalAnswer = strings.TrimSpace(synthResp.Text)
			}
		}

		// Se ainda assim estiver vazio, sintetiza diretamente a partir dos resumos das ferramentas executadas
		if strings.TrimSpace(finalAnswer) == "" {
			var summaries []string
			for _, m := range messages {
				if m.Role == ai.RoleTool && strings.TrimSpace(m.Content) != "" && !strings.HasPrefix(m.Content, "Falha ao executar") {
					summaries = append(summaries, m.Content)
				}
			}
			if len(summaries) > 0 {
				finalAnswer = strings.Join(summaries, "\n\n")
			} else if len(executedTools) > 0 {
				finalAnswer = "Ação concluída com sucesso."
			} else {
				finalAnswer = "Não consegui obter uma resposta para essa solicitação no momento. Por favor, tente novamente."
			}
		}
	}

	// 6. Grava turnos do usuário e do assistente no ConversationStore
	if l.convRepo != nil {
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
		SuggestedActions: nil,
		Telemetry: domain.TurnTelemetry{
			ProviderUsed: chosenProvider.Name(),
			ModelUsed:    chosenProvider.ModelName(),
			LatencyMs:    time.Since(startTime).Milliseconds(),
		},
	}, nil
}
