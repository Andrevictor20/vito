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
	"google.golang.org/adk/v2/runner"
	"google.golang.org/adk/v2/session/compaction"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

const (
	// DefaultMaxADKSteps define o limite de chamadas de modelo por turno no Runner (elevado de 7 para 12 para comportar transfer_to_agent + multi-tool + síntese).
	DefaultMaxADKSteps = 12
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

// PrivacySettingsProvider abstrai a verificação de consentimento de processamento com IA.
type PrivacySettingsProvider interface {
	GetPrivacySettings(ctx context.Context, userID string) (*domain.PrivacySettings, error)
}

// FacadeConfig agrupa as dependências para inicializar o ADKLoopFacade.
type FacadeConfig struct {
	ServerPool          []ServerPoolEntry
	Registry            *toolsets.ToolsetsRegistry
	ScopeGuard          domain.ScopeGuard
	ConfirmationGate    *service.ConfirmationGateService
	ConvRepo            *repository.ConversationStoreRepository
	TraceRecorder       ai.TraceRecorder
	UserRepo            domain.UserRepository
	AISettingsRepo      domain.AISettingsRepository
	PrivacyChecker      PrivacySettingsProvider
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
	routedLLM := NewRoutedLLM(cfg.ServerPool...)
	routedLLM.ConfigureBYOK(cfg.ModelResolver, cfg.AIProviderRepo, cfg.UserRegistry, cfg.TraceRecorder)
	sessionSvc := NewSQLiteSessionService(cfg.ConvRepo)
	bridge := NewToolsetBridge(cfg.Registry)
	guardrail := NewGuardrailPlugin(bridge, cfg.ScopeGuard, cfg.ConfirmationGate, cfg.TraceRecorder)

	topology, err := BuildAgentTopologyWithOptions(routedLLM, bridge, TopologyOptions{
		EnableLoadMemory: cfg.MemoryService != nil,
	})
	if err != nil {
		return nil, err
	}

	plugins, err := buildStandardADKPlugins(guardrail)
	if err != nil {
		return nil, fmt.Errorf("falha ao construir plugins do ADK: %w", err)
	}

	runnerCfg := runner.Config{
		AppName:           adkAppName,
		Agent:             topology.RootAgent,
		SessionService:    sessionSvc,
		AutoCreateSession: true,
		PluginConfig: runner.PluginConfig{
			Plugins: plugins,
		},
		Compaction: &compaction.Config{
			CompactionInterval: 10,
			OverlapSize:        1,
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

// SessionService retorna o SQLiteSessionService subjacente.
func (f *ADKLoopFacade) SessionService() *SQLiteSessionService {
	return f.sessionService
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

	if f.cfg.PrivacyChecker != nil && userID != "anonymous" {
		if ps, err := f.cfg.PrivacyChecker.GetPrivacySettings(ctx, userID); err == nil && ps != nil && !ps.AIProcessingEnabled {
			return nil, fmt.Errorf("processamento de IA desativado nas configurações de Privacidade")
		}
	}

	// 1. Resolução ou criação da thread
	threadID := f.resolveOrCreateThread(ctx, userID, req.ThreadID, req.Channel)

	// 2. Interceptação determinística de confirmação/cancelamento pendente no ConfirmationGate
	if confResp, handled, confErr := f.tryHandlePendingConfirmation(ctx, req, userID, threadID, turnID, startTime, onDelta); handled {
		return confResp, confErr
	}

	// 3. Resolução de persona (Prefixo Estático Cacheável) + Contexto Volátil do Turno
	userName, personaStyle, autonomyLevel, autonomyMode, autoFocusBlocks := f.resolveUserPersonaAndAutonomy(req, userID)
	staticPrompt := ai.BuildStaticPersonaSystemPrompt(personaStyle, userName, req.Channel)
	volatileContext := f.buildVolatileTurnContext(ctx, req, userID, startTime, autonomyMode, autoFocusBlocks)

	// 4. Sincronização de histórico enviado pelo cliente (ou reset explícito ao editar/reenviar)
	f.seedClientHistoryIfPresent(ctx, userID, threadID, req.History, req.ResetHistory)

	// 5. Preparação do contexto e collector do turno para os callbacks do ADK
	collector := &TurnCollector{}
	initialEffort := f.resolveInitialEffort(ctx, userID, threadID, req.BotID, req.Channel)
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

	// 6. Execução do grafo de agentes via adk/v2/runner.Runner
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
			if strings.Contains(strings.ToLower(err.Error()), "max number of llm calls exceeded") {
				break
			}
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
	f.persistCompletedTurn(ctx, threadID, turnID, req, finalAnswer, collectedCards, executedTools, collectedReasoning, modelDisplay, startTime)
	if !requiresConf && f.consolidationWorker != nil && userID != "" && threadID != "" {
		f.consolidationWorker.NotifyActivity(threadID, userID)
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

// ToolsetBridge expõe o bridge compilado do facade para reuso sem duplicação no wiring.
func (f *ADKLoopFacade) ToolsetBridge() *ToolsetBridge {
	if f == nil {
		return nil
	}
	return f.bridge
}

// GuardrailPlugin expõe o plugin de guardrails compartilhado pelo facade.
func (f *ADKLoopFacade) GuardrailPlugin() *GuardrailPlugin {
	if f == nil {
		return nil
	}
	return f.guardrail
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
