package service

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service/assistant"
)

type captureInputGateway struct {
	lastInput ai.UserInput
	intent    *ai.ParsedIntent
}

func (g *captureInputGateway) ParseIntent(_ context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	g.lastInput = input
	return g.intent, nil
}

// 1. Testa se MemoryRepositorySQLite.Create persiste Importance e Confidence reais (não apenas os defaults da tabela).
func TestMemoryRepository_CreatePersistsImportanceAndConfidence(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{ID: "u-cog-1", Name: "Alice", Email: "alice@test.com", PasswordHash: "x"})

	repo := repository.NewMemoryRepository(db)
	mem := &domain.Memory{
		ID:         "mem-imp-5",
		UserID:     "u-cog-1",
		Category:   "rotina",
		Content:    "Prefere reuniões estratégicas apenas no período da tarde",
		Importance: 5,
		Confidence: 0.92,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	if err := repo.Create(mem); err != nil {
		t.Fatalf("create memory: %v", err)
	}

	got, err := repo.GetByID("mem-imp-5", "u-cog-1")
	if err != nil {
		t.Fatalf("get memory: %v", err)
	}
	if got.Importance != 5 {
		t.Errorf("expected Importance=5, got %d", got.Importance)
	}
	if got.Confidence < 0.91 || got.Confidence > 0.93 {
		t.Errorf("expected Confidence=0.92, got %f", got.Confidence)
	}
}

// 2. Testa se enrichInputContext popula CoreProfile, [ID: ...] em eventos/tarefas e janelas livres (ComputeFreeSlotsSummary).
func TestEnrichInputContext_CoreProfileIDsAndFreeSlots(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{ID: "u-cog-2", Name: "Bruno", Email: "bruno@test.com", PasswordHash: "x"})

	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memRepo := repository.NewMemoryRepository(db)
	coreRepo := repository.NewCoreProfileRepository(db)

	if err := coreRepo.Set("u-cog-2", "profissao", "Arquiteto de Software"); err != nil {
		t.Fatalf("set core profile: %v", err)
	}
	if err := coreRepo.Set("u-cog-2", "regra_ouro", "Sem reuniões antes das 10h"); err != nil {
		t.Fatalf("set core profile 2: %v", err)
	}

	loc, _ := time.LoadLocation("America/Sao_Paulo")
	nowLocal := time.Date(2026, 10, 20, 9, 0, 0, 0, loc)

	calSvc := NewCalendarService(eventRepo)
	todoSvc := NewTodoService(todoRepo)

	// Cria um evento hoje das 10:00 às 11:00
	ev := &domain.Event{
		ID:      "evt-exact-123",
		UserID:  "u-cog-2",
		Title:   "Daily Backend",
		StartAt: time.Date(2026, 10, 20, 10, 0, 0, 0, loc).UTC(),
		EndAt:   time.Date(2026, 10, 20, 11, 0, 0, 0, loc).UTC(),
	}
	if err := eventRepo.Create(ev); err != nil {
		t.Fatalf("create event: %v", err)
	}

	td, err := todoSvc.CreateTodo("u-cog-2", "Revisar PR #42", "high", nil)
	if err != nil {
		t.Fatalf("create todo: %v", err)
	}

	gw := &captureInputGateway{
		intent: &ai.ParsedIntent{
			Action:  ai.ActionGeneralChat,
			Message: "Tudo pronto.",
		},
	}

	astSvc := NewAssistantService(gw, calSvc, todoSvc, memRepo)
	astSvc.SetCoreProfileRepository(coreRepo)

	_, err = astSvc.Process(context.Background(), "u-cog-2", ai.UserInput{
		Text:     "Como está meu dia?",
		Timezone: "America/Sao_Paulo",
		Now:      nowLocal.UTC(),
	})
	if err != nil {
		t.Fatalf("process error: %v", err)
	}

	// Verifica CoreProfile populado
	if len(gw.lastInput.CoreProfile) != 2 {
		t.Fatalf("expected 2 CoreProfile items, got %d: %v", len(gw.lastInput.CoreProfile), gw.lastInput.CoreProfile)
	}

	// Verifica [ID: evt-exact-123] na ActiveSchedule
	if len(gw.lastInput.ActiveSchedule) == 0 || !strings.Contains(gw.lastInput.ActiveSchedule[0], "[ID: evt-exact-123]") {
		t.Errorf("expected ActiveSchedule to contain [ID: evt-exact-123], got %v", gw.lastInput.ActiveSchedule)
	}

	// Verifica [ID: <todo-id>] em PendingTodos
	if len(gw.lastInput.PendingTodos) == 0 || !strings.Contains(gw.lastInput.PendingTodos[0], "[ID: "+td.ID+"]") {
		t.Errorf("expected PendingTodos to contain [ID: %s], got %v", td.ID, gw.lastInput.PendingTodos)
	}

	// Verifica janelas livres pré-calculadas em AppStateFlags
	flagsJoined := strings.Join(gw.lastInput.AppStateFlags, " | ")
	if !strings.Contains(flagsJoined, "08:00-10:00") || !strings.Contains(flagsJoined, "11:00-20:00") {
		t.Errorf("expected AppStateFlags to contain precalculated free slots (08:00-10:00, 11:00-20:00), got %v", gw.lastInput.AppStateFlags)
	}
}

// 3. Testa resolução por ID exato em DELETE_EVENT mesmo quando existem múltiplos eventos com títulos parecidos.
func TestExecuteAction_DeleteEventByExactID(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{ID: "u-cog-3", Name: "Carla", Email: "carla@test.com", PasswordHash: "x"})

	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memRepo := repository.NewMemoryRepository(db)
	calSvc := NewCalendarService(eventRepo)
	todoSvc := NewTodoService(todoRepo)

	now := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	ev1 := &domain.Event{
		ID:      "evt-keep-001",
		UserID:  "u-cog-3",
		Title:   "Reunião de Alinhamento",
		StartAt: now.Add(2 * time.Hour),
		EndAt:   now.Add(3 * time.Hour),
	}
	ev2 := &domain.Event{
		ID:      "evt-del-002",
		UserID:  "u-cog-3",
		Title:   "Reunião de Alinhamento",
		StartAt: now.Add(5 * time.Hour),
		EndAt:   now.Add(6 * time.Hour),
	}
	if err := eventRepo.Create(ev1); err != nil {
		t.Fatalf("create ev1: %v", err)
	}
	if err := eventRepo.Create(ev2); err != nil {
		t.Fatalf("create ev2: %v", err)
	}

	gw := &captureInputGateway{
		intent: &ai.ParsedIntent{
			Action:  ai.ActionDeleteEvent,
			Message: "Cancelei a reunião das 17h.",
			Event: &ai.ParsedEvent{
				Title:       "Reunião de Alinhamento",
				TargetQuery: "evt-del-002",
			},
		},
	}

	astSvc := NewAssistantService(gw, calSvc, todoSvc, memRepo)
	_, err = astSvc.Process(context.Background(), "u-cog-3", ai.UserInput{
		Text: "Cancele a segunda reunião",
		Now:  now,
	})
	if err != nil {
		t.Fatalf("process delete by exact ID: %v", err)
	}

	remaining, _ := calSvc.ListEvents("u-cog-3", now.Add(-1*time.Hour), now.Add(24*time.Hour))
	if len(remaining) != 1 || remaining[0].ID != "evt-keep-001" {
		t.Fatalf("expected only evt-keep-001 to remain, got %+v", remaining)
	}
}

// 4. Testa Compound Intents (AdditionalActions): criar evento + criar tarefa no mesmo turno.
func TestProcess_CompoundActionsExecutesAll(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{ID: "u-cog-4", Name: "Diego", Email: "diego@test.com", PasswordHash: "x"})

	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memRepo := repository.NewMemoryRepository(db)
	calSvc := NewCalendarService(eventRepo)
	todoSvc := NewTodoService(todoRepo)

	now := time.Date(2026, 10, 20, 12, 0, 0, 0, time.UTC)
	gw := &captureInputGateway{
		intent: &ai.ParsedIntent{
			Action:  ai.ActionCreateEvent,
			Message: "Agendei a reunião com o cliente e adicionei a tarefa de preparar a proposta.",
			Event: &ai.ParsedEvent{
				Title:   "Reunião Cliente Alpha",
				StartAt: now.Add(2 * time.Hour),
				EndAt:   now.Add(3 * time.Hour),
			},
			AdditionalActions: []ai.ParsedIntent{
				{
					Action: ai.ActionCreateTodo,
					Todo: &ai.ParsedTodo{
						Title:    "Preparar proposta comercial Alpha",
						Priority: "high",
					},
				},
			},
		},
	}

	astSvc := NewAssistantService(gw, calSvc, todoSvc, memRepo)
	res, err := astSvc.Process(context.Background(), "u-cog-4", ai.UserInput{
		Text: "Marque reunião com Cliente Alpha hoje às 14h e crie tarefa para preparar a proposta comercial",
		Now:  now,
	})
	if err != nil {
		t.Fatalf("compound process failed: %v", err)
	}
	if res.Event == nil || res.Event.Title != "Reunião Cliente Alpha" {
		t.Errorf("expected res.Event to be populated, got %+v", res.Event)
	}
	if res.Todo == nil || res.Todo.Title != "Preparar proposta comercial Alpha" {
		t.Errorf("expected res.Todo to be populated from AdditionalActions, got %+v", res.Todo)
	}

	// Confirma persistência real no banco
	todos, _ := todoSvc.ListTodos("u-cog-4", domain.TodoStatusPending)
	if len(todos) != 1 {
		t.Errorf("expected 1 todo in DB, got %d", len(todos))
	}
	events, _ := calSvc.ListEvents("u-cog-4", now, now.Add(24*time.Hour))
	if len(events) != 1 {
		t.Errorf("expected 1 event in DB, got %d", len(events))
	}
}

// 5. Testa ComputeFreeSlotsSummary diretamente.
func TestComputeFreeSlotsSummary(t *testing.T) {
	loc := time.FixedZone("BRT", -3*3600)
	now := time.Date(2026, 10, 20, 9, 0, 0, 0, loc)
	events := []domain.Event{
		{
			ID:      "e1",
			Title:   "Alinhamento",
			StartAt: time.Date(2026, 10, 20, 9, 0, 0, 0, loc),
			EndAt:   time.Date(2026, 10, 20, 10, 30, 0, 0, loc),
		},
		{
			ID:      "e2",
			Title:   "Almoço Executivo",
			StartAt: time.Date(2026, 10, 20, 12, 0, 0, 0, loc),
			EndAt:   time.Date(2026, 10, 20, 13, 0, 0, 0, loc),
		},
	}

	summary := assistant.ComputeFreeSlotsSummary(events, now, loc)
	joined := strings.Join(summary, " | ")
	if !strings.Contains(joined, "08:00-09:00") || !strings.Contains(joined, "10:30-12:00") || !strings.Contains(joined, "13:00-20:00") {
		t.Errorf("unexpected free slots summary: %v", summary)
	}
}
