package adkengine_test

import (
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type testAC03CalSvc struct {
	svc *calendar.CalendarService
}

func (a *testAC03CalSvc) GetEvents(ctx context.Context, userID string, start, end time.Time) ([]*domain.Event, error) {
	evts, err := a.svc.ListEvents(userID, start, end)
	if err != nil {
		return nil, err
	}
	out := make([]*domain.Event, 0, len(evts))
	for i := range evts {
		out = append(out, &evts[i])
	}
	return out, nil
}

func (a *testAC03CalSvc) CreateEvent(ctx context.Context, event *domain.Event) error {
	created, _, err := a.svc.CreateEvent(event.UserID, event.Title, event.Description, event.Location, event.StartAt, event.EndAt)
	if err != nil {
		return err
	}
	if created != nil {
		*event = *created
	}
	return nil
}

func (a *testAC03CalSvc) CreateEventWithConflict(ctx context.Context, event *domain.Event) (*domain.ConflictInfo, error) {
	created, conflict, err := a.svc.CreateEvent(event.UserID, event.Title, event.Description, event.Location, event.StartAt, event.EndAt)
	if err != nil {
		return nil, err
	}
	if created != nil {
		*event = *created
	}
	return conflict, nil
}

func (a *testAC03CalSvc) DeleteEvent(ctx context.Context, id, userID string) error {
	return a.svc.DeleteEvent(id, userID)
}

type testAC03BookingSvc struct {
	svc *calendar.BookingService
}

func (a *testAC03BookingSvc) ListBookingTypes(ctx context.Context, userID string) ([]*domain.BookingType, error) {
	list, err := a.svc.ListBookingTypes(ctx, userID)
	if err != nil {
		return nil, err
	}
	out := make([]*domain.BookingType, 0, len(list))
	for i := range list {
		bt := list[i].BookingType
		out = append(out, &bt)
	}
	return out, nil
}

func (a *testAC03BookingSvc) CreateBookingType(ctx context.Context, userID string, bt *domain.BookingType) (*domain.BookingType, string, error) {
	created, err := a.svc.CreateBookingType(ctx, userID, bt)
	if err != nil {
		return nil, "", err
	}
	return &created.BookingType, created.PublicURL, nil
}

type testAC03TriggerSvc struct {
	svc *bots.TriggerService
}

func (a *testAC03TriggerSvc) ListTriggers(userID string) ([]*domain.Trigger, error) {
	list, err := a.svc.ListTriggers(userID, "", "")
	if err != nil {
		return nil, err
	}
	out := make([]*domain.Trigger, 0, len(list))
	for i := range list {
		out = append(out, &list[i])
	}
	return out, nil
}

func (a *testAC03TriggerSvc) CreateTrigger(tr *domain.Trigger) error {
	created, err := a.svc.CreateTrigger(tr.UserID, domain.CreateTriggerInput{
		Title:         tr.Title,
		Category:      domain.CategoryCustom,
		Query:         tr.UserIntent,
		ConditionType: domain.ConditionChangeDetected,
		TargetValue:   "alert",
		Frequency:     domain.FrequencyDailyMorning,
	})
	if err != nil {
		return err
	}
	if created != nil {
		*tr = *created
	}
	return nil
}

func (a *testAC03TriggerSvc) DeleteTrigger(id, userID string) error {
	return a.svc.DeleteTrigger(id, userID)
}

// TestAC03_ChatToolsReturnRealTypedEntitiesAndCards valida modo direto (proativo) e HITL
// para create_todo, create_event, create_booking_link e create_bot com IDs reais do SQLite.
func TestAC03_ChatToolsReturnRealTypedEntitiesAndCards(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "ac03_cards.db"))
	if err != nil {
		t.Fatalf("falha ao abrir banco: %v", err)
	}
	defer db.Close()

	userID := "user-ac03"
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André",
		Email:     "ac03@vito.local",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	aiSettingsRepo := repository.NewAISettingsRepository(db)
	convRepo := repository.NewConversationStoreRepository(db)
	todoSvc := tasks.NewTodoService(tasks.NewTodoRepository(db))
	eventRepo := calendar.NewEventRepository(db)
	calSvc := calendar.NewCalendarService(eventRepo)
	bookingSvc := calendar.NewBookingService(calendar.NewBookingRepositorySQLite(db), eventRepo, userRepo, nil, nil, nil, "https://vito.local")
	triggerSvc := bots.NewTriggerService(bots.NewTriggerRepository(db))
	confGate := service.NewConfirmationGateService(db)
	scopeGuard := service.NewScopeGuard()

	reg := toolsets.NewToolsetsRegistry()
	reg.Register(tasks.NewTaskPendingToolset(&testAC01TodoSvc{svc: todoSvc}))
	reg.Register(calendar.NewCalendarToolset(&testAC03CalSvc{svc: calSvc}))
	reg.Register(calendar.NewMeetingBookingToolset(&testAC03BookingSvc{svc: bookingSvc}))
	reg.Register(bots.NewBotTriggerToolset(&testAC03TriggerSvc{svc: triggerSvc}))

	ctx := context.Background()

	// 1. Modo Proativo (direto): create_todo + create_event + create_booking_link + create_bot
	_ = aiSettingsRepo.UpsertSettings(&domain.AISettings{
		UserID:       userID,
		AutonomyMode: domain.AutonomyModeProactive,
	})

	providerDirect := &fakeAgentProvider{
		name:          "Fake-Direct",
		model:         "gemini-2.5-flash",
		tier:          3,
		supportsTools: true,
		responses: []*ai.AgentChatResponse{
			{
				ProviderName: "Fake-Direct",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "tr1", Name: "transfer_to_agent", Arguments: json.RawMessage(`{"agent_name":"vito_routine_agent"}`)},
				},
			},
			{
				ProviderName: "Fake-Direct",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "t1", Name: "todo_create_todo", Arguments: json.RawMessage(`{"title":"Revisar orçamento"}`)},
				},
			},
			{Text: "Tarefa criada!", ProviderName: "Fake-Direct", ModelName: "gemini-2.5-flash"},
			{
				ProviderName: "Fake-Direct",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "tr2", Name: "transfer_to_agent", Arguments: json.RawMessage(`{"agent_name":"vito_routine_agent"}`)},
				},
			},
			{
				ProviderName: "Fake-Direct",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "t2", Name: "calendar_create_event", Arguments: json.RawMessage(`{"title":"Reunião Trimestral","start_time":"2026-12-01T15:00:00-03:00","end_time":"2026-12-01T16:00:00-03:00"}`)},
				},
			},
			{Text: "Evento agendado!", ProviderName: "Fake-Direct", ModelName: "gemini-2.5-flash"},
			{
				ProviderName: "Fake-Direct",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "tr3", Name: "transfer_to_agent", Arguments: json.RawMessage(`{"agent_name":"vito_routine_agent"}`)},
				},
			},
			{
				ProviderName: "Fake-Direct",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "t3", Name: "booking_create_link", Arguments: json.RawMessage(`{"title":"Café 30 min","duration_minutes":30}`)},
				},
			},
			{Text: "Link de agendamento criado!", ProviderName: "Fake-Direct", ModelName: "gemini-2.5-flash"},
			{
				ProviderName: "Fake-Direct",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "tr4", Name: "transfer_to_agent", Arguments: json.RawMessage(`{"agent_name":"vito_bots_architect"}`)},
				},
			},
			{
				ProviderName: "Fake-Direct",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "t4", Name: "bot_create_bot", Arguments: json.RawMessage(`{"title":"Monitor Dólar","goal":"Avisar quando dólar cair"}`)},
				},
			},
			{Text: "Bot criado!", ProviderName: "Fake-Direct", ModelName: "gemini-2.5-flash"},
		},
	}

	facadeDirect, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		Router:           ai.NewModelRouter(providerDirect),
		Registry:         reg,
		ScopeGuard:       scopeGuard,
		ConfirmationGate: confGate,
		ConvRepo:         convRepo,
		UserRepo:         userRepo,
		AISettingsRepo:   aiSettingsRepo,
	})
	if err != nil {
		t.Fatalf("falha ao criar facadeDirect: %v", err)
	}

	// Tarefa direta
	rTodo, err := facadeDirect.Run(ctx, domain.UnifiedAssistantRequest{UserID: userID, ThreadID: "th-1", Channel: "app_mobile", Message: "Crie tarefa"})
	if err != nil {
		t.Fatalf("create_todo direto falhou: %v", err)
	}
	if rTodo.Todo == nil || rTodo.Todo.ID == "" {
		t.Fatalf("AC-03 esperava resp.Todo populado no modo direto, obteve %+v", rTodo)
	}
	todosDB, _ := todoSvc.ListTodos(userID, "")
	if len(todosDB) == 0 || todosDB[0].ID != rTodo.Todo.ID {
		t.Errorf("AC-03 ID fantasma em todo: resp=%q db=%+v", rTodo.Todo.ID, todosDB)
	}

	// Event direto
	rEvt, err := facadeDirect.Run(ctx, domain.UnifiedAssistantRequest{UserID: userID, ThreadID: "th-2", Channel: "app_mobile", Message: "Agende reunião"})
	if err != nil {
		t.Fatalf("create_event direto falhou: %v", err)
	}
	if rEvt.Event == nil || rEvt.Event.ID == "" {
		t.Fatalf("AC-03 esperava resp.Event populado no modo direto, obteve %+v", rEvt)
	}

	// Booking direto
	rBook, err := facadeDirect.Run(ctx, domain.UnifiedAssistantRequest{UserID: userID, ThreadID: "th-3", Channel: "app_mobile", Message: "Crie link de booking"})
	if err != nil {
		t.Fatalf("create_booking_link direto falhou: %v", err)
	}
	if rBook.Booking == nil || rBook.Booking.ID == "" || rBook.BookingURL == "" {
		t.Fatalf("AC-03 esperava resp.Booking e BookingURL populados, obteve booking=%+v url=%q", rBook.Booking, rBook.BookingURL)
	}

	// Bot direto
	rBot, err := facadeDirect.Run(ctx, domain.UnifiedAssistantRequest{UserID: userID, ThreadID: "th-4", Channel: "app_mobile", Message: "Crie bot"})
	if err != nil {
		t.Fatalf("create_bot direto falhou: %v", err)
	}
	if rBot.Trigger == nil || rBot.Trigger.ID == "" {
		t.Fatalf("AC-03 esperava resp.Trigger populado no modo direto, obteve %+v", rBot)
	}

	// 2. Modo Assistido (HITL via ConfirmPendingID): create_todo
	_ = aiSettingsRepo.UpsertSettings(&domain.AISettings{
		UserID:       userID,
		AutonomyMode: domain.AutonomyModeAssisted,
	})
	providerHITL := &fakeAgentProvider{
		name:          "Fake-HITL",
		model:         "gemini-2.5-flash",
		tier:          3,
		supportsTools: true,
		responses: []*ai.AgentChatResponse{
			{
				ProviderName: "Fake-HITL",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "trh1", Name: "transfer_to_agent", Arguments: json.RawMessage(`{"agent_name":"vito_routine_agent"}`)},
				},
			},
			{
				ProviderName: "Fake-HITL",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "h1", Name: "todo_create_todo", Arguments: json.RawMessage(`{"title":"Tarefa HITL"}`)},
				},
			},
			{Text: "Confirma?", ProviderName: "Fake-HITL", ModelName: "gemini-2.5-flash"},
		},
	}
	facadeHITL, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		Router:           ai.NewModelRouter(providerHITL),
		Registry:         reg,
		ScopeGuard:       scopeGuard,
		ConfirmationGate: confGate,
		ConvRepo:         convRepo,
		UserRepo:         userRepo,
		AISettingsRepo:   aiSettingsRepo,
	})
	if err != nil {
		t.Fatalf("falha ao criar facadeHITL: %v", err)
	}

	susp, err := facadeHITL.Run(ctx, domain.UnifiedAssistantRequest{UserID: userID, ThreadID: "th-hitl", Channel: "app_mobile", Message: "Crie tarefa HITL"})
	if err != nil || !susp.RequiresConfirmation || susp.PendingConfirmationID == "" {
		t.Fatalf("AC-03 esperava suspensão HITL, obteve err=%v susp=%+v", err, susp)
	}

	confirmed, err := facadeHITL.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:           userID,
		ThreadID:         "th-hitl",
		Channel:          "app_mobile",
		ConfirmPendingID: susp.PendingConfirmationID,
	})
	if err != nil {
		t.Fatalf("AC-03 confirmação HITL falhou: %v", err)
	}
	rawJSON, _ := json.Marshal(confirmed)
	if confirmed.Todo == nil || confirmed.Todo.ID == "" || len(confirmed.Cards) == 0 {
		t.Fatalf("AC-03 confirmação HITL deveria retornar Todo real e Cards: %s", string(rawJSON))
	}

	// Regressão: bot_create_bot com goal vazio faz fallback para title e não falha no TriggerService
	ts, ok := reg.Get(domain.ToolsetRadarTrigger)
	if !ok || ts == nil {
		t.Fatalf("ToolsetRadarTrigger não registrado")
	}
	botRes, botErr := ts.Execute(ctx, &domain.ToolExecutionContext{UserID: userID}, "create_bot", json.RawMessage(`{"title":"Rastreador Poco x8 Pro"}`))
	if botErr != nil || botRes == nil || botRes.Status != "COMPLETED" {
		t.Fatalf("create_bot com fallback de goal deveria concluir, obteve res=%+v err=%v", botRes, botErr)
	}

	// Regressão: vito_executive deve conseguir invocar bot_create_bot diretamente sem transfer_to_agent
	_ = aiSettingsRepo.UpsertSettings(&domain.AISettings{
		UserID:       userID,
		AutonomyMode: domain.AutonomyModeProactive,
	})
	providerRootBot := &fakeAgentProvider{
		name:          "Fake-RootBot",
		model:         "gemini-2.5-flash",
		tier:          3,
		supportsTools: true,
		responses: []*ai.AgentChatResponse{
			{
				ProviderName: "Fake-RootBot",
				ModelName:    "gemini-2.5-flash",
				ToolCalls: []ai.ToolCall{
					{ID: "rb1", Name: "bot_create_bot", Arguments: json.RawMessage(`{"title":"Bot Direto Root","goal":"Monitorar promoções"}`)},
				},
			},
			{Text: "Bot Direto Root criado!", ProviderName: "Fake-RootBot", ModelName: "gemini-2.5-flash"},
		},
	}
	facadeRootBot, err := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		Router:           ai.NewModelRouter(providerRootBot),
		Registry:         reg,
		ScopeGuard:       scopeGuard,
		ConfirmationGate: confGate,
		ConvRepo:         convRepo,
		UserRepo:         userRepo,
		AISettingsRepo:   aiSettingsRepo,
	})
	if err != nil {
		t.Fatalf("facadeRootBot: %v", err)
	}
	rRootBot, err := facadeRootBot.Run(ctx, domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: "th-root-bot",
		Channel:  "app_mobile",
		Message:  "Crie um bot para monitorar promoções",
	})
	if err != nil {
		t.Fatalf("vito_executive bot_create_bot direto falhou: %v", err)
	}
	if rRootBot.Trigger == nil || rRootBot.Trigger.ID == "" {
		t.Fatalf("esperava Trigger criado diretamente por vito_executive, obteve %+v", rRootBot)
	}
}
