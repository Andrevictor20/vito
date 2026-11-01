package main

import (
	"context"
	"database/sql"
	"log"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/config"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
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
	AgentLoop           *service.AgentLoop
}

// setupAgentSubsystem instancia e orquestra o cérebro único do assistente, ferramentas e memória.
func setupAgentSubsystem(
	cfg *config.Config,
	db *sql.DB,
	calSvc *service.CalendarService,
	todoSvc *service.TodoService,
	waSvc *service.WhatsAppService,
	gmailSvc *service.GmailService,
	userRepo domain.UserRepository,
	aiSettingsRepo domain.AISettingsRepository,
	triggerSvc *service.TriggerService,
	bookingSvc *service.BookingService,
	memoryRepo *repository.MemoryRepositorySQLite,
) *AgentSubsystem {
	// 1. Repositórios e Serviços de Memória e Confirmação
	convRepo := repository.NewConversationStoreRepository(db)
	memRepo := repository.NewMemoryHierarchyRepository(db)
	confGate := service.NewConfirmationGateService(db)
	scopeGuard := service.NewMemoryScopeGuard()

	// 2. Telemetria via Ring Buffer
	traceRecorder := ai.NewRingBufferTraceRecorder(db, 200, 10*time.Second)

	// 3. 8 Domain Toolsets
	registry := toolsets.NewToolsetsRegistry()
	if calSvc != nil {
		registry.Register(toolsets.NewCalendarToolset(&calendarServiceAdapter{calSvc}))
	}
	if todoSvc != nil {
		registry.Register(toolsets.NewTaskPendingToolset(&todoServiceAdapter{todoSvc}))
	}
	if waSvc != nil {
		waBridge := service.NewWhatsAppConversationBridge(convRepo)
		waSvc.SetConversationBridge(waBridge)
		registry.Register(toolsets.NewWhatsAppToolset(&whatsAppServiceAdapter{waSvc}))
	}
	if gmailSvc != nil {
		registry.Register(toolsets.NewGmailToolset(&gmailServiceAdapter{gmailSvc}))
	}

	var searxClient *ai.SearXNGClient
	if cfg.SearXNGURL != "" {
		searxClient = ai.NewSearXNGClient(cfg.SearXNGURL)
		ai.SetDefaultSearXNGClient(searxClient)
	}

	searchSubagent := ai.NewVerticalSearchSubagent(searxClient, nil)
	if cfg.GeminiAPIKey != "" {
		searchSubagent.SetGeminiConfig(cfg.GeminiAPIKey, cfg.GeminiModel, "")
	}
	registry.Register(toolsets.NewSearchToolset(searchSubagent))
	if bookingSvc != nil {
		registry.Register(toolsets.NewMeetingBookingToolset(&bookingServiceAdapter{bookingSvc}))
	} else {
		registry.Register(toolsets.NewMeetingBookingToolset())
	}
	if triggerSvc != nil {
		registry.Register(toolsets.NewRadarTriggerToolset(&triggerServiceAdapter{triggerSvc}))
	} else {
		registry.Register(toolsets.NewRadarTriggerToolset())
	}
	if memoryRepo != nil {
		registry.Register(toolsets.NewMemoryProfileToolset(memoryRepo))
	} else {
		registry.Register(toolsets.NewMemoryProfileToolset())
	}

	// 4. ModelRouter com provedores reais disponíveis
	router := ai.NewModelRouter()
	if cfg.GeminiAPIKey != "" {
		geminiModel := cfg.GeminiModel
		if geminiModel == "" {
			geminiModel = "gemini-2.5-flash"
		}
		p := ai.NewGeminiAgentProvider(cfg.GeminiAPIKey, geminiModel)
		router.AddProvider(p)
		log.Printf("🤖 [Agent Loop] Provedor Gemini Nativo registrado (%s, Tier 3)", geminiModel)
	}

	if cfg.OpenRouterAPIKey != "" {
		openRouterModel := cfg.OpenRouterModel
		if openRouterModel == "" {
			openRouterModel = "google/gemini-2.5-flash"
		}
		p := ai.NewOpenAICompatAgentProvider(
			"OpenRouter",
			openRouterModel,
			"https://openrouter.ai/api/v1/chat/completions",
			cfg.OpenRouterAPIKey,
			3,
			true,
			true,
			16384,
		)
		router.AddProvider(p)
		log.Printf("🤖 [Agent Loop] Provedor OpenRouter registrado (%s, Tier 3)", openRouterModel)
	}

	if cfg.GroqAPIKey != "" {
		groqModel := cfg.GroqModel
		if groqModel == "" {
			groqModel = "qwen/qwen3.8-27b"
		}
		p := ai.NewOpenAICompatAgentProvider(
			"Groq",
			groqModel,
			"https://api.groq.com/openai/v1/chat/completions",
			cfg.GroqAPIKey,
			2,
			true,
			false,
			8192,
		)
		router.AddProvider(p)
		log.Printf("⚡ [Agent Loop] Provedor Groq registrado (%s, Tier 2)", groqModel)
	}

	// 5. Loop ReAct Central
	loop := service.NewAgentLoop(
		router,
		registry,
		scopeGuard,
		confGate,
		convRepo,
		traceRecorder,
	)
	if userRepo != nil && aiSettingsRepo != nil {
		loop.SetUserRepositories(userRepo, aiSettingsRepo)
	}

	// 6. Worker de Consolidação com debounce de 150s
	consolidationWorker := service.NewMemoryConsolidationWorker(convRepo, memRepo, 150*time.Second)

	// 7. Handlers HTTP REST e SSE
	streamHandler := handler.NewAssistantStreamHandler(loop)
	memoryHandler := handler.NewMemoryHandler(memRepo)

	return &AgentSubsystem{
		StreamHandler:       streamHandler,
		MemoryHandler:       memoryHandler,
		ConsolidationWorker: consolidationWorker,
		TraceRecorder:       traceRecorder,
		ConversationStore:   convRepo,
		MemoryHierarchy:     memRepo,
		AgentLoop:           loop,
	}
}

type calendarServiceAdapter struct {
	svc *service.CalendarService
}

func (a *calendarServiceAdapter) GetEvents(ctx context.Context, userID string, start, end time.Time) ([]*domain.Event, error) {
	events, err := a.svc.ListEvents(userID, start, end)
	if err != nil {
		return nil, err
	}
	var res []*domain.Event
	for i := range events {
		res = append(res, &events[i])
	}
	return res, nil
}

func (a *calendarServiceAdapter) CreateEvent(ctx context.Context, event *domain.Event) error {
	_, _, err := a.svc.CreateEvent(event.UserID, event.Title, event.Description, event.Location, event.StartAt, event.EndAt)
	return err
}

func (a *calendarServiceAdapter) DeleteEvent(ctx context.Context, id, userID string) error {
	return a.svc.DeleteEvent(id, userID)
}

type todoServiceAdapter struct {
	svc *service.TodoService
}

func (a *todoServiceAdapter) GetTodos(ctx context.Context, userID string) ([]*domain.Todo, error) {
	todos, err := a.svc.ListTodos(userID, "")
	if err != nil {
		return nil, err
	}
	var res []*domain.Todo
	for i := range todos {
		res = append(res, &todos[i])
	}
	return res, nil
}

func (a *todoServiceAdapter) CreateTodo(ctx context.Context, todo *domain.Todo) error {
	_, err := a.svc.CreateTodo(todo.UserID, todo.Title, string(todo.Priority), todo.DueDate)
	return err
}

func (a *todoServiceAdapter) CompleteTodo(ctx context.Context, id, userID string) error {
	return a.svc.CompleteTodo(id, userID)
}

func (a *todoServiceAdapter) DeleteTodo(ctx context.Context, id, userID string) error {
	return a.svc.DeleteTodo(id, userID)
}

type whatsAppServiceAdapter struct {
	svc *service.WhatsAppService
}

func (a *whatsAppServiceAdapter) SendMessage(ctx context.Context, userID, phone, message string) error {
	return a.svc.SendWhatsAppMessage(ctx, userID, phone, message)
}

type gmailServiceAdapter struct {
	svc *service.GmailService
}

func (a *gmailServiceAdapter) SendEmail(ctx context.Context, userID, to, subject, body string) error {
	_, err := a.svc.SendEmail(ctx, userID, to, subject, body)
	return err
}

func (a *gmailServiceAdapter) CreateDraft(ctx context.Context, userID, to, subject, body string) error {
	_, err := a.svc.CreateDraft(ctx, userID, to, subject, body)
	return err
}

type bookingServiceAdapter struct {
	svc *service.BookingService
}

func (a *bookingServiceAdapter) ListBookingTypes(ctx context.Context, userID string) ([]*domain.BookingType, error) {
	list, err := a.svc.ListBookingTypes(ctx, userID)
	if err != nil {
		return nil, err
	}
	var res []*domain.BookingType
	for i := range list {
		bt := list[i].BookingType
		res = append(res, &bt)
	}
	return res, nil
}

func (a *bookingServiceAdapter) CreateBookingType(ctx context.Context, userID string, bt *domain.BookingType) (*domain.BookingType, string, error) {
	created, err := a.svc.CreateBookingType(ctx, userID, bt)
	if err != nil {
		return nil, "", err
	}
	return &created.BookingType, created.PublicURL, nil
}

type triggerServiceAdapter struct {
	svc *service.TriggerService
}

func (a *triggerServiceAdapter) ListTriggers(userID string) ([]*domain.Trigger, error) {
	list, err := a.svc.ListTriggers(userID, "", "")
	if err != nil {
		return nil, err
	}
	var res []*domain.Trigger
	for i := range list {
		tr := list[i]
		res = append(res, &tr)
	}
	return res, nil
}

func (a *triggerServiceAdapter) CreateTrigger(t *domain.Trigger) error {
	input := domain.CreateTriggerInput{
		Title:         t.Title,
		Category:      domain.CategoryCustom,
		Query:         t.UserIntent,
		ConditionType: domain.ConditionChangeDetected,
		TargetValue:   "alert",
		Frequency:     domain.FrequencyDailyMorning,
	}
	_, err := a.svc.CreateTrigger(t.UserID, input)
	return err
}

func (a *triggerServiceAdapter) DeleteTrigger(id, userID string) error {
	return a.svc.DeleteTrigger(id, userID)
}
