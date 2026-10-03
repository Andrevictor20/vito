package service_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockAIGateway struct {
	intent        *ai.ParsedIntent
	capturedInput ai.UserInput
}

func (m *mockAIGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	m.capturedInput = input
	return m.intent, nil
}

func setupAssistantTest(t *testing.T) (*service.AssistantService, *service.CalendarService, *service.TodoService, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_assistant.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)

	userID := "user-ast-1"
	_ = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "André",
		Email:        "andre@ast.local",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)

	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:  ai.ActionCreateEvent,
			Message: "Agendado!",
			Event: &ai.ParsedEvent{
				Title:   "Academia",
				StartAt: time.Now().Add(2 * time.Hour),
				EndAt:   time.Now().Add(3 * time.Hour),
			},
			ProviderUsed: "Google AI Studio",
		},
	}

	astSvc := service.NewAssistantService(mockAI, calSvc, todoSvc, memoryRepo)
	return astSvc, calSvc, todoSvc, userID
}

func TestAssistantService_ProcessText(t *testing.T) {
	astSvc, calSvc, _, userID := setupAssistantTest(t)

	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{
		Text: "Marque academia hoje às 18h",
		Now:  time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("expected nil error, got: %v", err)
	}

	if resp.Action != ai.ActionCreateEvent {
		t.Errorf("expected action CREATE_EVENT, got %s", resp.Action)
	}

	// Verifica se o evento foi de fato persistido no SQLite
	events, err := calSvc.ListEvents(userID, time.Now().Add(-1*time.Hour), time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("failed to list events: %v", err)
	}
	if len(events) != 1 {
		t.Fatalf("expected 1 persisted event, got %d", len(events))
	}
	if events[0].Title != "Academia" {
		t.Errorf("expected event title 'Academia', got '%s'", events[0].Title)
	}
}

func TestAssistantService_EmptyInputReturnsGreeting(t *testing.T) {
	astSvc, _, _, userID := setupAssistantTest(t)

	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{
		Text: "   ",
		Now:  time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Action != ai.ActionGeneralChat {
		t.Errorf("expected action GENERAL_CHAT for empty input, got %s", resp.Action)
	}
	if resp.ProviderUsed != "system" {
		t.Errorf("expected ProviderUsed 'system', got %s", resp.ProviderUsed)
	}
}

func TestAssistantService_ChatPassesThroughWithoutRestrictions(t *testing.T) {
	astSvc, _, _, userID := setupAssistantTest(t)

	prompts := []string{
		"Olá, como você pode me ajudar?",
		"Quanto é 2 + 2?",
		"Conte uma piada",
		"Me fale sobre seus recursos",
	}

	for _, p := range prompts {
		t.Run(p, func(t *testing.T) {
			resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{
				Text: p,
				Now:  time.Now().UTC(),
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			// Verifica que NENHUM desses prompts foi bloqueado localmente com OUT_OF_SCOPE
			if resp.Action == ai.ActionOutOfScope && resp.ProviderUsed == "local-scope-guard" {
				t.Errorf("prompt '%s' foi indevidamente bloqueado pelo ScopeGuard!", p)
			}
		})
	}
}

func TestAssistantService_ScopeGuard_AllowsDates(t *testing.T) {
	astSvc, _, _, userID := setupAssistantTest(t)

	datePrompts := []string{
		"Marcar dentista dia 17/10 às 14h",
		"Reunião em 17/10",
		"Lembrete para 05/11/2026",
		"17/10 às 15h consulta médica",
	}

	for _, prompt := range datePrompts {
		t.Run(prompt, func(t *testing.T) {
			resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{
				Text: prompt,
				Now:  time.Now().UTC(),
			})
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if resp.Action == ai.ActionOutOfScope {
				t.Errorf("prompt '%s' foi indevidamente bloqueado pelo ScopeGuard como matemática!", prompt)
			}
		})
	}
}


func TestAssistantService_SaveMemory(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_memory.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	memRepo := repository.NewMemoryRepository(db)
	userRepo := repository.NewUserRepository(db)
	calSvc := service.NewCalendarService(repository.NewEventRepository(db))
	todoSvc := service.NewTodoService(repository.NewTodoRepository(db))

	userID := "user-mem-1"
	_ = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "André",
		Email:        "andre@mem.local",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:         ai.ActionSaveMemory,
			MemoryCategory: "família",
			MemoryContent:  "Minha mãe faz aniversário dia 15 de maio",
			Message:        "Anotado! Lembrei que sua mãe faz aniversário em 15 de maio.",
		},
	}

	astSvc := service.NewAssistantService(mockAI, calSvc, todoSvc, memRepo)

	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{
		Text: "Lembre que minha mãe faz aniversário dia 15 de maio",
		Now:  time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("expected nil error, got: %v", err)
	}

	if resp.Action != ai.ActionSaveMemory {
		t.Errorf("expected ActionSaveMemory, got: %s", resp.Action)
	}

	// Verificar se foi persistido no banco
	memories, err := memRepo.ListByUser(userID, 10)
	if err != nil {
		t.Fatalf("failed to list memories: %v", err)
	}
	if len(memories) != 1 {
		t.Fatalf("expected 1 memory, got %d", len(memories))
	}
	if memories[0].Content != "Minha mãe faz aniversário dia 15 de maio" {
		t.Errorf("unexpected content: %s", memories[0].Content)
	}
	if memories[0].Category != "família" {
		t.Errorf("unexpected category: %s", memories[0].Category)
	}
}

func TestAssistantService_ContextLayersInjection(t *testing.T) {
	_, calSvc, todoSvc, userID := setupAssistantTest(t)

	// Inserir evento futuro
	now := time.Now().UTC()
	_, _, err := calSvc.CreateEvent(userID, "Dentista Geral", "", "Consultório", now.Add(24*time.Hour), now.Add(25*time.Hour))
	if err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	// Inserir tarefa pendente
	_, err = todoSvc.CreateTodo(userID, "Comprar café em grãos", "high", nil)
	if err != nil {
		t.Fatalf("failed to create todo: %v", err)
	}

	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:  ai.ActionGeneralChat,
			Message: "Entendido!",
		},
	}
	astSvcCustom := service.NewAssistantService(mockAI, calSvc, todoSvc, nil)

	_, err = astSvcCustom.Process(context.Background(), userID, ai.UserInput{
		Text: "O que tenho para fazer?",
		Now:  now,
	})
	if err != nil {
		t.Fatalf("Process failed: %v", err)
	}

	if len(mockAI.capturedInput.ActiveSchedule) == 0 {
		t.Errorf("expected ActiveSchedule to be injected, got 0 items")
	}
	if len(mockAI.capturedInput.PendingTodos) == 0 {
		t.Errorf("expected PendingTodos to be injected, got 0 items")
	}
}
