package adkengine

import (
	"context"
	"encoding/base64"
	"fmt"
	aimemory "github.com/andrevmp/vito/backend/internal/ai/memory"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/plugin"
	"google.golang.org/adk/v2/runner"
	"google.golang.org/adk/v2/session"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

const (
	// DefaultMaxADKSteps define o limite de chamadas de modelo por turno no Runner (elevado de 4 para 7 na Onda 0).
	DefaultMaxADKSteps = 7
	adkAppName         = "vito"
)

// ContextEnricherProvider abstrai a construção do contexto Nível 1 do usuário.
type ContextEnricherProvider interface {
	BuildLevel1Context(ctx context.Context, userID, userMessage string, now time.Time) string
}

// ActivityNotifier abstrai o disparo de consolidação de memória pós-turno com debounce.
type ActivityNotifier interface {
	NotifyActivity(threadID, userID string)
}

// FacadeConfig agrupa as dependências para inicializar o ADKLoopFacade.
type FacadeConfig struct {
	Router              *ai.ModelRouter
	ServerPool          []ServerPoolEntry
	Registry            *toolsets.ToolsetsRegistry
	ScopeGuard          domain.ScopeGuard
	ConfirmationGate    *service.ConfirmationGateService
	ConvRepo            *repository.ConversationStoreRepository
	TraceRecorder       ai.TraceRecorder
	UserRepo            domain.UserRepository
	AISettingsRepo      domain.AISettingsRepository
	ContextEnricher     ContextEnricherProvider
	ConsolidationWorker ActivityNotifier
	MemoryService       *aimemory.SQLiteMemoryService
	ModelResolver       *service.ModelResolver
	AIProviderRepo      domain.AIProviderRepository
	UserRegistry        *service.UserProviderRegistry
}

// ADKLoopFacade encapsula o google.golang.org/adk/v2/runner.Runner mantendo 100% de compatibilidade
// com UnifiedAssistantRequest, UnifiedAssistantResponse e StreamDelta SSE em todos os passos.
type ADKLoopFacade struct {
	cfg                 FacadeConfig
	routedLLM           *RoutedLLM
	sessionService      *SQLiteSessionService
	memoryService       *aimemory.SQLiteMemoryService
	bridge              *ToolsetBridge
	guardrail           *GuardrailPlugin
	topology            *AgentTopology
	adkRunner           *runner.Runner
	userRepo            domain.UserRepository
	aiSettingsRepo      domain.AISettingsRepository
	contextEnricher     ContextEnricherProvider
	consolidationWorker ActivityNotifier
}

// NewADKLoopFacade instancia o motor Google ADK Go v2 completo.
func NewADKLoopFacade(cfg FacadeConfig) (*ADKLoopFacade, error) {
	routedLLM := NewRoutedLLM(cfg.Router)
	if len(cfg.ServerPool) > 0 {
		routedLLM.SetServerPool(cfg.ServerPool)
	}
	routedLLM.ConfigureBYOK(cfg.ModelResolver, cfg.AIProviderRepo, cfg.UserRegistry, cfg.TraceRecorder)
	sessionSvc := NewSQLiteSessionService(cfg.ConvRepo)
	bridge := NewToolsetBridge(cfg.Registry)
	guardrail := NewGuardrailPlugin(bridge, cfg.ScopeGuard, cfg.ConfirmationGate, cfg.TraceRecorder)

	topology, err := BuildAgentTopology(routedLLM, bridge)
	if err != nil {
		return nil, err
	}

	adkPlugin, err := guardrail.BuildADKPlugin()
	if err != nil {
		return nil, fmt.Errorf("falha ao construir GuardrailPlugin do ADK: %w", err)
	}

	runnerCfg := runner.Config{
		AppName:           adkAppName,
		Agent:             topology.RootAgent,
		SessionService:    sessionSvc,
		AutoCreateSession: true,
		PluginConfig: runner.PluginConfig{
			Plugins: []*plugin.Plugin{adkPlugin},
		},
	}
	if cfg.MemoryService != nil {
		runnerCfg.MemoryService = cfg.MemoryService
	}
	r, err := runner.New(runnerCfg)
	if err != nil {
		return nil, fmt.Errorf("falha ao inicializar adk/v2/runner.Runner: %w", err)
	}

	return &ADKLoopFacade{
		cfg:                 cfg,
		routedLLM:           routedLLM,
		sessionService:      sessionSvc,
		memoryService:       cfg.MemoryService,
		bridge:              bridge,
		guardrail:           guardrail,
		topology:            topology,
		adkRunner:           r,
		userRepo:            cfg.UserRepo,
		aiSettingsRepo:      cfg.AISettingsRepo,
		contextEnricher:     cfg.ContextEnricher,
		consolidationWorker: cfg.ConsolidationWorker,
	}, nil
}

// MemoryService retorna o aimemory.SQLiteMemoryService subjacente.
func (f *ADKLoopFacade) MemoryService() *aimemory.SQLiteMemoryService {
	return f.memoryService
}

// RoutedLLM retorna o adaptador model.LLM com failover transparente.
func (f *ADKLoopFacade) RoutedLLM() *RoutedLLM {
	return f.routedLLM
}

// SetUserRepositories configura os repositórios de usuário e preferências de IA.
func (f *ADKLoopFacade) SetUserRepositories(userRepo domain.UserRepository, aiSettingsRepo domain.AISettingsRepository) {
	f.userRepo = userRepo
	f.aiSettingsRepo = aiSettingsRepo
}

// SetContextEnricher configura o enriquecedor de contexto Nível 1.
func (f *ADKLoopFacade) SetContextEnricher(enricher ContextEnricherProvider) {
	f.contextEnricher = enricher
}

// SetConsolidationWorker conecta o worker de consolidação de memória pós-turno.
func (f *ADKLoopFacade) SetConsolidationWorker(worker ActivityNotifier) {
	f.consolidationWorker = worker
}

// SessionService retorna o SQLiteSessionService subjacente.
func (f *ADKLoopFacade) SessionService() *SQLiteSessionService {
	return f.sessionService
}

// Topology retorna a topologia de agentes ADK construída.
func (f *ADKLoopFacade) Topology() *AgentTopology {
	return f.topology
}

// Run executa um turno síncrono sobre o adk/v2/runner.Runner.
func (f *ADKLoopFacade) Run(ctx context.Context, req domain.UnifiedAssistantRequest) (*domain.UnifiedAssistantResponse, error) {
	return f.RunStream(ctx, req, nil)
}

// RunStream executa o turno sobre o adk/v2/runner.Runner emitindo deltas SSE em tempo real em todos os passos.
func (f *ADKLoopFacade) RunStream(ctx context.Context, req domain.UnifiedAssistantRequest, onDelta func(ai.StreamDelta) error) (*domain.UnifiedAssistantResponse, error) {
	startTime := time.Now()
	turnID := uuid.New().String()

	if req.Message == "" && req.Prompt != "" {
		req.Message = req.Prompt
	}

	userID := strings.TrimSpace(req.UserID)
	if userID == "" {
		userID = "anonymous"
	}

	// 1. Resolução ou criação da thread
	threadID := strings.TrimSpace(req.ThreadID)
	if threadID == "" && f.cfg.ConvRepo != nil {
		thread, err := f.cfg.ConvRepo.GetOrCreateThread(ctx, userID, req.Channel, "")
		if err == nil && thread != nil {
			threadID = thread.ID
		}
	} else if threadID != "" && f.cfg.ConvRepo != nil {
		_, _ = f.cfg.ConvRepo.GetOrCreateThread(ctx, userID, req.Channel, threadID)
	}
	if threadID == "" {
		threadID = uuid.New().String()
	}

	// 2. Interceptação determinística de confirmação/cancelamento pendente no ConfirmationGate
	if confResp, handled, confErr := f.tryHandlePendingConfirmation(ctx, req, userID, threadID, turnID, startTime, onDelta); handled {
		return confResp, confErr
	}

	// 3. Resolução de persona (Prefixo Estático Cacheável) + Contexto Volátil do Turno
	userName, personaStyle, autonomyLevel := f.resolveUserPersonaAndAutonomy(req, userID)
	staticPrompt := ai.BuildStaticPersonaSystemPrompt(personaStyle, userName, req.Channel)
	volatileParts := []string{ai.BuildVolatileTurnContextHeader(startTime)}
	if f.contextEnricher != nil && userID != "" {
		if lvl1 := f.contextEnricher.BuildLevel1Context(ctx, userID, req.Message, startTime); lvl1 != "" {
			volatileParts = append(volatileParts, lvl1)
		}
	}
	if strings.TrimSpace(req.QuotedContext) != "" {
		volatileParts = append(volatileParts, "### CONTEXTO CITADO / TELA\n"+strings.TrimSpace(req.QuotedContext))
	}
	if req.Channel == "whatsapp" && !req.WhatsAppPrivateScope {
		volatileParts = append(volatileParts, "### ESCOPO DE PRIVACIDADE WHATSAPP\nConversa visível para terceiros: NUNCA revele dados privados de outros chats, pendências pessoais ou informações confidenciais do dono.")
	}
	volatileContext := strings.Join(volatileParts, "\n\n")

	// 4. Sincronização de histórico enviado pelo cliente caso a sessão seja recém-criada
	if len(req.History) > 0 {
		_, _ = f.sessionService.Get(ctx, &session.GetRequest{
			AppName:   adkAppName,
			UserID:    userID,
			SessionID: threadID,
		})
		startIdx := 0
		if len(req.History) > 8 {
			startIdx = len(req.History) - 8
		}
		var seed []struct{ Role, Content string }
		for _, h := range req.History[startIdx:] {
			seed = append(seed, struct{ Role, Content string }{Role: h.Role, Content: h.Content})
		}
		f.sessionService.SeedClientHistory(adkAppName, userID, threadID, seed)
	}

	// 5. Preparação do contexto e collector do turno para os callbacks do ADK
	collector := &TurnCollector{}
	initialEffort := ""
	if f.cfg.ModelResolver != nil {
		if resolved, resErr := f.cfg.ModelResolver.Resolve(ctx, service.ModelResolveRequest{
			UserID:   userID,
			ThreadID: threadID,
			BotID:    req.BotID,
			Channel:  req.Channel,
		}); resErr == nil && resolved != nil {
			initialEffort = resolved.Effort
		}
	}
	meta := &TurnExecutionMeta{
		UserID:    userID,
		ThreadID:  threadID,
		TurnID:    turnID,
		BotID:     req.BotID,
		Channel:   req.Channel,
		FocusMode: req.FocusMode,
		Effort:    initialEffort,
		OnDelta:   onDelta,
	}
	runCtx := WithTurnExecutionMeta(ctx, meta)
	runCtx = context.WithValue(runCtx, collectorContextKey{}, collector)

	userContent := buildUserGenaiContent(req)
	streamingMode := agent.StreamingModeNone
	if onDelta != nil {
		streamingMode = agent.StreamingModeSSE
	}

	stateDelta := map[string]any{
		"channel":                    req.Channel,
		"autonomy_level":             autonomyLevel,
		"tainted_by_untrusted_input": false,
		"static_system_prompt":       staticPrompt,
		"volatile_turn_context":      volatileContext,
	}

	// 6. Execução do grafo de agentes via adk/v2/runner.Runner (teto de 7 chamadas de modelo)
	var finalAnswerParts []string
	emittedThinkingStatus := false
	for event, err := range f.adkRunner.Run(
		runCtx,
		userID,
		threadID,
		userContent,
		agent.RunConfig{
			StreamingMode: streamingMode,
			MaxLLMCalls:   DefaultMaxADKSteps,
		},
		runner.WithStateDelta(stateDelta),
	) {
		if err != nil {
			return nil, err
		}
		if event == nil {
			continue
		}
		if event.Partial {
			if onDelta != nil && event.Content != nil {
				for _, p := range event.Content.Parts {
					if p == nil || p.Text == "" {
						continue
					}
					if p.Thought {
						if !emittedThinkingStatus {
							emittedThinkingStatus = true
							_ = onDelta(ai.StreamDelta{Type: "status", ToolName: "Analisando solicitação"})
						}
					} else {
						_ = onDelta(ai.StreamDelta{Type: "text", TextDelta: p.Text})
					}
				}
			}
			continue
		}
		if event.Content != nil && event.Content.Role == genai.RoleModel {
			for _, p := range event.Content.Parts {
				if p == nil {
					continue
				}
				if p.Thought && strings.TrimSpace(p.Text) != "" {
					collector.Mu.Lock()
					collector.Reasoning = append(collector.Reasoning, p.Text)
					collector.Mu.Unlock()
				} else if !p.Thought && strings.TrimSpace(p.Text) != "" {
					finalAnswerParts = append(finalAnswerParts, p.Text)
				}
			}
		}
	}

	collector.Mu.Lock()
	requiresConf := collector.RequiresConfirmation
	pendingID := collector.PendingConfirmationID
	suspendedText := collector.SuspendedPromptText
	executedTools := collector.ExecutedTools
	collectedCards := collector.Cards
	collectedSources := collector.Sources
	collectedReasoning := collector.Reasoning
	respWhatsApp := collector.WhatsAppMessage
	respGmail := collector.GmailMessage
	collectedEntities := collector.Entities
	collector.Mu.Unlock()

	meta.Mu.Lock()
	providerUsed := meta.ProviderUsed
	modelUsed := meta.ModelUsed
	modelDisplay := meta.ModelDisplayName
	fallbackNotice := meta.FallbackNotice
	tokensIn := meta.TokensIn
	tokensOut := meta.TokensOut
	meta.Mu.Unlock()
	if modelDisplay == "" {
		modelDisplay = modelUsed
	}

	var finalAnswer string
	if requiresConf && suspendedText != "" {
		finalAnswer = suspendedText
	} else if len(finalAnswerParts) > 0 {
		finalAnswer = strings.TrimSpace(finalAnswerParts[len(finalAnswerParts)-1])
	}

	// 7. Garantia de Síntese Final Factual caso o modelo tenha chamado tools mas encerrado sem texto final
	if strings.TrimSpace(finalAnswer) == "" {
		finalAnswer = f.synthesizeFallbackAnswer(runCtx, req, threadID, staticPrompt, volatileContext, executedTools)
	}

	if onDelta != nil {
		_ = onDelta(ai.StreamDelta{Done: true})
	}

	// 8. Persistência no ConversationStore via DefaultWriterQueue() e notificação de consolidação
	if !requiresConf {
		f.persistCompletedTurn(ctx, threadID, turnID, req, finalAnswer, collectedCards, executedTools, collectedReasoning, modelDisplay, startTime)
		if f.consolidationWorker != nil && userID != "" && threadID != "" {
			f.consolidationWorker.NotifyActivity(threadID, userID)
		}
	}

	out := &domain.UnifiedAssistantResponse{
		ThreadID:              threadID,
		TurnID:                turnID,
		Text:                  finalAnswer,
		Reply:                 finalAnswer,
		Message:               finalAnswer,
		Reasoning:             collectedReasoning,
		ToolCalls:             executedTools,
		Cards:                 collectedCards,
		Sources:               collectedSources,
		RequiresConfirmation:  requiresConf,
		PendingConfirmationID: pendingID,
		WhatsAppMessage:       respWhatsApp,
		GmailMessage:          respGmail,
		ModelUsed:             modelDisplay,
		FallbackNotice:        fallbackNotice,
		Telemetry: domain.TurnTelemetry{
			ProviderUsed:   providerUsed,
			ModelUsed:      modelDisplay,
			FallbackNotice: fallbackNotice,
			TokensIn:       tokensIn,
			TokensOut:      tokensOut,
			LatencyMs:      time.Since(startTime).Milliseconds(),
		},
	}
	collectedEntities.ApplyToResponse(out)
	return out, nil
}

func buildUserGenaiContent(req domain.UnifiedAssistantRequest) *genai.Content {
	var parts []*genai.Part
	msg := strings.TrimSpace(req.Message)
	if msg == "" {
		msg = "Olá"
	}
	parts = append(parts, genai.NewPartFromText(msg))

	if strings.TrimSpace(req.ImageB64) != "" {
		if rawBytes, err := base64.StdEncoding.DecodeString(req.ImageB64); err == nil && len(rawBytes) > 0 {
			mime := req.ImageMime
			if mime == "" {
				mime = "image/jpeg"
			}
			parts = append(parts, genai.NewPartFromBytes(rawBytes, mime))
		}
	}

	return &genai.Content{
		Role:  genai.RoleUser,
		Parts: parts,
	}
}
