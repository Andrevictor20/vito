package service_test

import (
	"context"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupExtendedCrudTest(t *testing.T) (*service.AssistantService, *mockAIGateway, *service.TodoService, *service.TriggerService, *service.BookingService, domain.UserRepository, domain.AISettingsRepository, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_extended_crud.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	bookingRepo := repository.NewBookingRepositorySQLite(db)
	aiSettingsRepo := repository.NewAISettingsRepository(db)

	userID := "user-ext-crud-1"
	_ = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "André",
		Email:        "andre@vito.local",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)
	triggerSvc := service.NewTriggerService(triggerRepo)
	bookingSvc := service.NewBookingService(bookingRepo, eventRepo, userRepo, nil, nil, nil, "https://vito.app")

	mockAI := &mockAIGateway{}
	astSvc := service.NewAssistantService(mockAI, calSvc, todoSvc, memoryRepo, triggerSvc)
	astSvc.SetBookingService(bookingSvc)
	astSvc.SetUserRepository(userRepo)
	astSvc.SetAISettingsRepository(aiSettingsRepo)

	return astSvc, mockAI, todoSvc, triggerSvc, bookingSvc, userRepo, aiSettingsRepo, userID
}

func TestAssistantService_UpdateTodo(t *testing.T) {
	astSvc, mockAI, todoSvc, _, _, _, _, userID := setupExtendedCrudTest(t)
	ctx := context.Background()

	// 1. Cria tarefa inicial
	initialDate := time.Date(2026, 10, 24, 18, 0, 0, 0, time.UTC)
	created, err := todoSvc.CreateTodo(userID, "Pagar condomínio", "medium", &initialDate)
	if err != nil {
		t.Fatalf("falha ao criar tarefa: %v", err)
	}

	// 2. Simula ação UPDATE_TODO via IA (mover para amanhã às 9h e prioridade alta)
	newDate := time.Date(2026, 10, 25, 9, 0, 0, 0, time.UTC)
	mockAI.intent = &ai.ParsedIntent{
		Action:  ai.ActionUpdateTodo,
		Message: "Movi para amanhã, 9h.",
		TodoUpdate: &ai.ParsedTodoUpdate{
			TargetQuery: "condomínio",
			DueDate:     &newDate,
			Priority:    "high",
		},
	}

	res, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Move 'Pagar condomínio' para amanhã às 9h", Now: time.Now()})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if res.Todo == nil {
		t.Fatalf("esperava retorno da tarefa atualizada em res.Todo")
	}
	if res.Todo.Priority != "high" {
		t.Errorf("esperava prioridade 'high', obteve %q", res.Todo.Priority)
	}

	// Valida persistência
	todos, _ := todoSvc.ListTodos(userID, domain.TodoStatusPending)
	if len(todos) != 1 {
		t.Fatalf("esperava 1 tarefa pendente, obteve %d", len(todos))
	}
	if todos[0].ID != created.ID {
		t.Errorf("ID divergiu: %s vs %s", todos[0].ID, created.ID)
	}
	if todos[0].DueDate == nil || !todos[0].DueDate.Equal(newDate) {
		t.Errorf("due_date não foi atualizada para nova data: %v", todos[0].DueDate)
	}
}

func TestAssistantService_UpdateTrigger_PauseAndResume(t *testing.T) {
	astSvc, mockAI, _, triggerSvc, _, _, _, userID := setupExtendedCrudTest(t)
	ctx := context.Background()

	// 1. Cria radar ativo
	created, err := triggerSvc.CreateTrigger(userID, domain.CreateTriggerInput{
		Title:         "Editais de concurso",
		Category:      domain.CategoryCareer,
		Query:         "editais ti",
		Frequency:     domain.FrequencyDailyMorning,
		ScheduledTime: "08:00",
	})
	if err != nil {
		t.Fatalf("falha ao criar radar: %v", err)
	}

	// 2. Pausar vigília
	fFalse := false
	mockAI.intent = &ai.ParsedIntent{
		Action:  ai.ActionUpdateTrigger,
		Message: "Vigília pausada.",
		TriggerUpdate: &ai.ParsedTriggerUpdate{
			TargetQuery: "Editais",
			IsActive:    &fFalse,
		},
	}
	res, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Pausa a vigília dos editais", Now: time.Now()})
	if err != nil {
		t.Fatalf("erro ao pausar vigília: %v", err)
	}
	if res.Trigger == nil || res.Trigger.Status != domain.TriggerStatusPaused {
		t.Errorf("esperava trigger com status paused, obteve: %+v", res.Trigger)
	}

	// 3. Retomar vigília
	fTrue := true
	mockAI.intent = &ai.ParsedIntent{
		Action:  ai.ActionUpdateTrigger,
		Message: "Vigília retomada.",
		TriggerUpdate: &ai.ParsedTriggerUpdate{
			TargetQuery: created.ID,
			IsActive:    &fTrue,
		},
	}
	res2, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Retoma o radar dos editais", Now: time.Now()})
	if err != nil {
		t.Fatalf("erro ao retomar vigília: %v", err)
	}
	if res2.Trigger == nil || res2.Trigger.Status != domain.TriggerStatusActive {
		t.Errorf("esperava trigger ativo, obteve: %+v", res2.Trigger)
	}

	// 4. Mudar horário para 07:30
	mockAI.intent = &ai.ParsedIntent{
		Action:  ai.ActionUpdateTrigger,
		Message: "Horário atualizado para 07:30.",
		TriggerUpdate: &ai.ParsedTriggerUpdate{
			TargetQuery:   "Editais",
			ScheduledTime: "07:30",
		},
	}
	res3, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Checa 'Editais' às 7h30", Now: time.Now()})
	if err != nil {
		t.Fatalf("erro ao atualizar horário: %v", err)
	}
	if res3.Trigger == nil || res3.Trigger.ScheduledTime != "07:30" {
		t.Errorf("esperava scheduled_time 07:30, obteve: %v", res3.Trigger)
	}
}

func TestAssistantService_DeleteTrigger(t *testing.T) {
	astSvc, mockAI, _, triggerSvc, _, _, _, userID := setupExtendedCrudTest(t)
	ctx := context.Background()

	created, err := triggerSvc.CreateTrigger(userID, domain.CreateTriggerInput{
		Title:    "Passagens Rio",
		Category: domain.CategoryTravel,
		Query:    "voos baratos rio",
	})
	if err != nil {
		t.Fatalf("falha ao criar radar: %v", err)
	}

	mockAI.intent = &ai.ParsedIntent{
		Action:  ai.ActionDeleteTrigger,
		Message: "Vigília excluída.",
		TriggerDelete: &ai.ParsedTriggerDelete{
			TargetQuery: created.Title,
		},
	}

	_, err = astSvc.Process(ctx, userID, ai.UserInput{Text: "Exclui a vigília Passagens Rio", Now: time.Now()})
	if err != nil {
		t.Fatalf("erro ao excluir radar: %v", err)
	}

	// Verifica se foi removido
	list, _ := triggerSvc.ListTriggers(userID, "", "")
	if len(list) != 0 {
		t.Errorf("esperava 0 triggers após exclusão, obteve %d", len(list))
	}
}

func TestAssistantService_DeleteBooking(t *testing.T) {
	astSvc, mockAI, _, _, bookingSvc, _, _, userID := setupExtendedCrudTest(t)
	ctx := context.Background()

	bt, err := bookingSvc.CreateBookingType(ctx, userID, &domain.BookingType{
		Title:           "Conversa de 30 min",
		Slug:            "conversa-30",
		DurationMinutes: 30,
		StartHour:       "09:00",
		EndHour:         "18:00",
		DaysOfWeek:      "[1,2,3,4,5]",
		IsActive:        true,
	})
	if err != nil {
		t.Fatalf("falha ao criar booking: %v", err)
	}

	mockAI.intent = &ai.ParsedIntent{
		Action:  ai.ActionDeleteBooking,
		Message: "Link excluído.",
		BookingDelete: &ai.ParsedBookingDelete{
			TargetQuery: bt.Title,
		},
	}

	res, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Exclui o link Conversa de 30 min", Now: time.Now()})
	if err != nil {
		t.Fatalf("erro ao excluir link: %v", err)
	}
	if !strings.Contains(res.Message, "excluído") {
		t.Errorf("esperava confirmação de exclusão na message, obteve %q", res.Message)
	}

	// Confirma que não está mais listado
	bts, _ := bookingSvc.ListBookingTypes(ctx, userID)
	if len(bts) != 0 {
		t.Errorf("esperava 0 booking types, obteve %d", len(bts))
	}
}

func TestAssistantService_UpdateProfile(t *testing.T) {
	astSvc, mockAI, _, _, _, userRepo, aiSettingsRepo, userID := setupExtendedCrudTest(t)
	ctx := context.Background()

	mockAI.intent = &ai.ParsedIntent{
		Action:  ai.ActionUpdateProfile,
		Message: "Configurações atualizadas.",
		ProfileUpdate: &ai.ParsedProfileUpdate{
			Phone:        "+5598984417165",
			AutonomyMode: "proactive",
		},
	}

	res, err := astSvc.Process(ctx, userID, ai.UserInput{Text: "Muda meu telefone para (98) 98441-7165 e coloque a autonomia no nível 3", Now: time.Now()})
	if err != nil {
		t.Fatalf("erro ao atualizar perfil: %v", err)
	}
	if !strings.Contains(res.Message, "telefone atualizado") && !strings.Contains(res.Message, "autonomia") {
		t.Errorf("esperava confirmação de atualização do perfil na message, obteve %q", res.Message)
	}

	// Verifica persistência do telefone
	u, _ := userRepo.GetByID(userID)
	if u.Phone == nil || *u.Phone != "+5598984417165" {
		t.Errorf("telefone no repositório divergiu: %v", u.Phone)
	}

	// Verifica persistência da autonomia
	st, _ := aiSettingsRepo.GetSettings(userID)
	if st.AutonomyMode != domain.AutonomyModeProactive {
		t.Errorf("esperava AutonomyModeProactive, obteve %q", st.AutonomyMode)
	}
}
