package main

import (
	"context"
	"database/sql"
	aimemory "github.com/andrevmp/vito/backend/internal/ai/memory"
	"github.com/andrevmp/vito/backend/internal/ai/search"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/calendar/booking"
	"github.com/andrevmp/vito/backend/internal/finance"
	"github.com/andrevmp/vito/backend/internal/gmail"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"log"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/bots/catalog"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/platform/config"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

// AgentSubsystem encapsula os componentes da Inteligência Conversacional v2.
type AgentSubsystem struct {
	StreamHandler       *handler.AssistantStreamHandler
	MemoryHandler       *handler.MemoryHandler
	ConsolidationWorker *service.MemoryConsolidationWorker
	TraceRecorder       *ai.RingBufferTraceRecorder
	ConversationStore   *repository.ConversationStoreRepository
	MemoryHierarchy     *repository.MemoryHierarchyRepository
	AssistantEngine     service.AssistantEngine
	ContextEnricher     *service.AssistantContextEnricher
	EntityLinkRepo      *repository.EntityLinkRepository
	ToolsetRegistry     *toolsets.ToolsetsRegistry
	ADKFacade           *adkengine.ADKLoopFacade
	AIProviderHandler   *handler.AIProviderHandler
	AIProviderSvc       *service.AIProviderService
	ScopeGuard          *service.MemoryScopeGuard
	ConfGate            *service.ConfirmationGateService
	BotRepo             *bots.BotRepositorySQLite
	Catalog             *catalog.Catalog
	FinanceRepo         finance.FinanceRepository
	FinanceAnalytics    finance.FinanceAnalyticsRepository
	FinanceLimitRepo    finance.FinanceLimitRepository
	FinanceSvc          *finance.FinanceService
	FinanceLimitSvc     *finance.FinanceLimitService
}

// setupAgentSubsystem instancia e orquestra o cérebro único do assistente, ferramentas e memória.
func setupAgentSubsystem(
	cfg *config.Config,
	db *sql.DB,
	calSvc *calendar.CalendarService,
	todoSvc *tasks.TodoService,
	waSvc *whatsapp.WhatsAppService,
	gmailSvc *gmail.GmailService,
	userRepo domain.UserRepository,
	aiSettingsRepo domain.AISettingsRepository,
	triggerSvc *bots.TriggerService,
	bookingSvc *booking.BookingService,
	memoryRepo *repository.MemoryRepositorySQLite,
	waDir ...*whatsapp.WhatsAppDirectoryService,
) *AgentSubsystem {
	// 1. Repositórios e Serviços de Memória e Confirmação
	convRepo := repository.NewConversationStoreRepository(db)
	memRepo := repository.NewMemoryHierarchyRepository(db)
	entityLinkRepo := repository.NewEntityLinkRepository(db)
	finRepo := finance.NewFinanceRepository(db)
	finAnalyticsRepo := finance.NewFinanceAnalyticsRepository(db)
	finLimitRepo := finance.NewFinanceLimitRepository(db)
	finSvc := finance.NewFinanceService(finRepo, finAnalyticsRepo)
	finLimitSvc := finance.NewFinanceLimitService(finLimitRepo, finRepo)
	confGate := service.NewConfirmationGateService(db)
	scopeGuard := service.NewMemoryScopeGuard()

	// 2. Telemetria via Ring Buffer
	traceRecorder := ai.NewRingBufferTraceRecorder(db, 200, 10*time.Second)

	// 3. 8 Domain Toolsets
	registry := toolsets.NewToolsetsRegistry()
	if calSvc != nil {
		calSvc.SetEntityLinkRepository(entityLinkRepo)
		registry.Register(calendar.NewCalendarToolsetFromService(calSvc))
	}
	if todoSvc != nil {
		todoSvc.SetEntityLinkRepository(entityLinkRepo)
		registry.Register(tasks.NewTaskPendingToolsetFromService(todoSvc))
	}
	if waSvc != nil {
		waBridge := whatsapp.NewWhatsAppConversationBridge(convRepo)
		waSvc.SetConversationBridge(waBridge)
		waSvc.SetEntityLinkRepository(entityLinkRepo)
		var directory *whatsapp.WhatsAppDirectoryService
		if len(waDir) > 0 {
			directory = waDir[0]
		}
		waTS := whatsapp.NewWhatsAppToolsetFromService(waSvc, directory)
		waTS.SetEntityLinkResolver(entityLinkRepo)
		registry.Register(waTS)
	}
	if gmailSvc != nil {
		gmailTS := gmail.NewGmailToolsetFromService(gmailSvc)
		gmailTS.SetEntityLinkResolver(entityLinkRepo)
		registry.Register(gmailTS)
	}

	var searxClient *search.SearXNGClient
	if cfg.SearXNGURL != "" {
		searxClient = search.NewSearXNGClient(cfg.SearXNGURL)
		search.SetDefaultSearXNGClient(searxClient)
	}

	searchSubagent := search.NewVerticalSearchSubagent(searxClient)
	if cfg.GeminiAPIKey != "" {
		searchSubagent.SetGeminiConfig(cfg.GeminiAPIKey, cfg.GeminiModel, "")
	}
	registry.Register(toolsets.NewSearchToolset(searchSubagent))
	registry.Register(booking.NewMeetingBookingToolsetFromService(bookingSvc))
	botTS := bots.NewBotTriggerToolsetFromService(triggerSvc)
	var (
		botRepo *bots.BotRepositorySQLite
		botCat  *catalog.Catalog
	)
	if db != nil {
		botRepo = bots.NewBotRepository(db)
		var catErr error
		botCat, catErr = catalog.LoadDefaultCatalog()
		if catErr != nil {
			log.Printf("⚠️ [Bots] Falha ao carregar catálogo de bots: %v", catErr)
		}
		botTS.SetBotRepository(botRepo, botCat)
	}
	registry.Register(botTS)
	if finRepo != nil {
		finToolset := finance.NewFinanceToolset(finSvc, finRepo)
		finToolset.SetLimitService(finLimitSvc)
		registry.Register(finToolset)
	} else {
		registry.Register(finance.NewFinanceToolset(nil))
	}
	if memoryRepo != nil {
		registry.Register(toolsets.NewMemoryProfileToolset(memoryRepo))
	} else {
		registry.Register(toolsets.NewMemoryProfileToolset())
	}

	// 4. Pool de Modelos ADK v2 do Servidor (Gemini nativo + OpenRouter + Groq)
	var serverPool []adkengine.ServerPoolEntry
	if cfg.GeminiAPIKey != "" {
		geminiModel := cfg.GeminiModel
		if geminiModel == "" {
			geminiModel = "gemini-2.5-flash"
		}
		if gLLM, gErr := adkengine.NewGeminiBYOKLLM(context.Background(), geminiModel, cfg.GeminiAPIKey); gErr == nil && gLLM != nil {
			serverPool = append(serverPool, adkengine.ServerPoolEntry{
				ProviderKey: "gemini",
				DisplayName: "Gemini",
				ModelID:     geminiModel,
				Tier:        3,
				LLM:         gLLM,
			})
			log.Printf("🤖 [ADK Server Pool] Provedor Gemini nativo registrado (%s, Tier 3)", geminiModel)
		} else if gErr != nil {
			log.Printf("⚠️ [ADK Server Pool] Falha ao inicializar Gemini nativo: %v", gErr)
		}
	}

	if cfg.OpenRouterAPIKey != "" {
		openRouterModel := cfg.OpenRouterModel
		if openRouterModel == "" {
			openRouterModel = "google/gemini-2.5-flash"
		}
		orLLM := adkengine.NewOpenAICompatLLM(
			"openrouter",
			openRouterModel,
			"https://openrouter.ai/api/v1/chat/completions",
			cfg.OpenRouterAPIKey,
			adkengine.WithOpenAISupportsReasoning(true),
			adkengine.WithOpenAISupportsTools(true),
			adkengine.WithOpenAIHeaders(map[string]string{
				"HTTP-Referer": "https://vito.app",
				"X-Title":      "Vito Assistant",
			}),
		)
		serverPool = append(serverPool, adkengine.ServerPoolEntry{
			ProviderKey: "openrouter",
			DisplayName: "OpenRouter",
			ModelID:     openRouterModel,
			Tier:        3,
			LLM:         orLLM,
		})
		log.Printf("🤖 [ADK Server Pool] Provedor OpenRouter ADK registrado (%s, Tier 3)", openRouterModel)
	}

	if cfg.GroqAPIKey != "" {
		groqModel := cfg.GroqModel
		if groqModel == "" {
			groqModel = "llama-3.3-70b-versatile"
		}
		groqLLM := adkengine.NewOpenAICompatLLM(
			"groq",
			groqModel,
			"https://api.groq.com/openai/v1/chat/completions",
			cfg.GroqAPIKey,
			adkengine.WithOpenAISupportsReasoning(false),
			adkengine.WithOpenAISupportsTools(true),
		)
		serverPool = append(serverPool, adkengine.ServerPoolEntry{
			ProviderKey: "groq",
			DisplayName: "Groq",
			ModelID:     groqModel,
			Tier:        2,
			LLM:         groqLLM,
		})
		log.Printf("⚡ [ADK Server Pool] Provedor Groq ADK registrado (%s, Tier 2)", groqModel)
	}

	// 5. Enriquecimento cognitivo e memória
	coreProfileRepo := repository.NewCoreProfileRepository(db)
	contextEnricher := service.NewAssistantContextEnricher(
		userRepo,
		aiSettingsRepo,
		coreProfileRepo,
		memoryRepo,
		calSvc,
		todoSvc,
		triggerSvc,
	)
	contextEnricher.SetMemoryHierarchyRepository(memRepo)
	contextEnricher.SetFinanceSnapshotProvider(finance.NewSQLiteFinanceSnapshotProvider(finRepo))
	contextEnricher.SetEntityLinkRepository(entityLinkRepo)

	// 6. Worker de Consolidação com debounce de 150s + aimemory.SQLiteMemoryService Híbrido (FTS5 + Embeddings 036)
	embedder := aimemory.BuildGenaiEmbedder(cfg.GeminiAPIKey)
	sqliteMemorySvc := aimemory.NewSQLiteMemoryService(memoryRepo, memRepo, embedder)
	consolidationWorker := service.NewMemoryConsolidationWorker(convRepo, memRepo, 150*time.Second)
	consolidationWorker.SetFactRepository(memoryRepo, embedder)
	confGate.SetFeedbackRecorder(consolidationWorker)

	// 6.4 Provedores BYOK & Resolução de Modelos (§2-§5)
	aiProviderRT := setupAIProviderSubsystem(cfg, db, aiSettingsRepo, convRepo)

	// 6.5 Motor Google ADK Go v2 (ADKLoopFacade) plugado ao WhatsAppService, HTTP e Voz
	var assistantEngine service.AssistantEngine
	privacyRepo := repository.NewStoreComplianceRepository(db)
	adkFacade, adkErr := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:          serverPool,
		Registry:            registry,
		ScopeGuard:          scopeGuard,
		ConfirmationGate:    confGate,
		ConvRepo:            convRepo,
		TraceRecorder:       traceRecorder,
		UserRepo:            userRepo,
		AISettingsRepo:      aiSettingsRepo,
		PrivacyChecker:      privacyRepo,
		ContextEnricher:     contextEnricher,
		ConsolidationWorker: consolidationWorker,
		MemoryService:       sqliteMemorySvc,
		ModelResolver:       aiProviderRT.Resolver,
		AIProviderRepo:      aiProviderRT.Repo,
		UserRegistry:        aiProviderRT.Registry,
	})
	if adkErr == nil && adkFacade != nil {
		consolidationWorker.SetSemanticExtractor(aimemory.NewADKMemoryExtractor(adkFacade.RoutedLLM()))
		assistantEngine = adkFacade
		if waSvc != nil {
			waSvc.SetAgentLoop(adkFacade)
		}
		log.Println("🧠 [Google ADK v2] Motor ADKLoopFacade inicializado e conectado aos canais Mobile, Desktop, Voz e WhatsApp.")
	} else if adkErr != nil {
		log.Printf("⚠️ [Google ADK v2] Falha ao inicializar ADKLoopFacade: %v", adkErr)
	}

	// 7. Handlers HTTP REST e SSE
	streamHandler := handler.NewAssistantStreamHandler(assistantEngine)
	memoryHandler := handler.NewMemoryHandler(memRepo)
	memoryHandler.SetFactRepository(memoryRepo, embedder)

	return &AgentSubsystem{
		StreamHandler:       streamHandler,
		MemoryHandler:       memoryHandler,
		ConsolidationWorker: consolidationWorker,
		TraceRecorder:       traceRecorder,
		ConversationStore:   convRepo,
		MemoryHierarchy:     memRepo,
		AssistantEngine:     assistantEngine,
		ContextEnricher:     contextEnricher,
		EntityLinkRepo:      entityLinkRepo,
		ToolsetRegistry:     registry,
		ADKFacade:           adkFacade,
		AIProviderHandler:   aiProviderRT.Handler,
		AIProviderSvc:       aiProviderRT.Service,
		ScopeGuard:          scopeGuard,
		ConfGate:            confGate,
		BotRepo:             botRepo,
		Catalog:             botCat,
		FinanceRepo:         finRepo,
		FinanceAnalytics:    finAnalyticsRepo,
		FinanceLimitRepo:    finLimitRepo,
		FinanceSvc:          finSvc,
		FinanceLimitSvc:     finLimitSvc,
	}
}
