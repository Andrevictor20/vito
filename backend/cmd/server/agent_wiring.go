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
	searchSubagent := ai.NewVerticalSearchSubagent(ai.DefaultSearXNGClient(), nil)
	if cfg.GeminiAPIKey != "" {
		searchSubagent.SetGeminiConfig(cfg.GeminiAPIKey, cfg.GeminiModel, "")
	}
	registry.Register(toolsets.NewSearchToolset(searchSubagent))
	registry.Register(toolsets.NewMeetingBookingToolset())
	registry.Register(toolsets.NewRadarTriggerToolset())
	registry.Register(toolsets.NewMemoryProfileToolset())

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
			groqModel = "llama-3.3-70b-versatile"
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
