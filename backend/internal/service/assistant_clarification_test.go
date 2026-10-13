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

// setupClarify monta AssistantService com intent mockada específica.
func setupClarify(t *testing.T, intent *ai.ParsedIntent) (*service.AssistantService, *service.CalendarService, *service.TodoService, string) {
	t.Helper()
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "clarify.db"))
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)

	userID := "user-clarify-1"
	_ = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "André",
		Email:        "clarify@local",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)
	mockAI := &mockAIGateway{intent: intent}
	astSvc := service.NewAssistantService(mockAI, calSvc, todoSvc, memoryRepo)
	return astSvc, calSvc, todoSvc, userID
}

// Pedidos vagos viram pergunta (NEEDS_CLARIFICATION) em vez de criação
// silenciosa com defaults ou erro 500 genérico.

func TestAssistantService_VagueEventAsksClarification(t *testing.T) {
	now := time.Now().UTC()
	astSvc, calSvc, _, userID := setupClarify(t, &ai.ParsedIntent{
		Action:  ai.ActionCreateEvent,
		Message: "",
		Event:   &ai.ParsedEvent{Title: "", StartAt: now.Add(2 * time.Hour)},
	})
	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{Text: "crie um evento", Now: now})
	if err != nil {
		t.Fatalf("clarificação não deve retornar erro, got: %v", err)
	}
	if resp.Action != ai.ActionNeedsClarification {
		t.Errorf("expected NEEDS_CLARIFICATION, got %s", resp.Action)
	}
	if resp.Message == "" {
		t.Errorf("expected pergunta de esclarecimento, got empty")
	}
	events, _ := calSvc.ListEvents(userID, now.Add(-time.Hour), now.Add(48*time.Hour))
	if len(events) != 0 {
		t.Errorf("nada deve ser criado em clarificação, got %d events", len(events))
	}
}

func TestAssistantService_EventWithoutDateAsksClarification(t *testing.T) {
	now := time.Now().UTC()
	astSvc, _, _, userID := setupClarify(t, &ai.ParsedIntent{
		Action:  ai.ActionCreateEvent,
		Message: "",
		Event:   &ai.ParsedEvent{Title: "Dentista"},
	})
	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{Text: "crie evento Dentista", Now: now})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Action != ai.ActionNeedsClarification {
		t.Errorf("expected NEEDS_CLARIFICATION sem data, got %s", resp.Action)
	}
}

func TestAssistantService_NeedsClarificationPassthrough(t *testing.T) {
	astSvc, _, _, userID := setupClarify(t, &ai.ParsedIntent{
		Action:  ai.ActionNeedsClarification,
		Message: "Qual o nome do evento?",
	})
	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{Text: "crie um evento", Now: time.Now().UTC()})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Action != ai.ActionNeedsClarification {
		t.Errorf("expected passthrough NEEDS_CLARIFICATION, got %s", resp.Action)
	}
	if resp.Message != "Qual o nome do evento?" {
		t.Errorf("expected pergunta preservada, got %q", resp.Message)
	}
}

func TestAssistantService_VagueTodoAsksClarification(t *testing.T) {
	astSvc, _, _, userID := setupClarify(t, &ai.ParsedIntent{
		Action: ai.ActionCreateTodo,
		Todo:   &ai.ParsedTodo{Title: ""},
	})
	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{Text: "cria uma tarefa", Now: time.Now().UTC()})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Action != ai.ActionNeedsClarification {
		t.Errorf("expected NEEDS_CLARIFICATION para tarefa vaga, got %s", resp.Action)
	}
}

func TestAssistantService_VagueTriggerAsksClarification(t *testing.T) {
	astSvc, _, _, userID := setupClarify(t, &ai.ParsedIntent{
		Action:  ai.ActionCreateTrigger,
		Trigger: &ai.ParsedTrigger{},
	})
	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{Text: "quero um radar", Now: time.Now().UTC()})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Action != ai.ActionNeedsClarification {
		t.Errorf("expected NEEDS_CLARIFICATION para radar vago, got %s", resp.Action)
	}
}

func TestAssistantService_VagueBookingAsksClarification(t *testing.T) {
	astSvc, _, _, userID := setupClarify(t, &ai.ParsedIntent{
		Action:  ai.ActionCreateBookingLink,
		Booking: &ai.ParsedBooking{},
	})
	resp, err := astSvc.Process(context.Background(), userID, ai.UserInput{Text: "crie um booking", Now: time.Now().UTC()})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if resp.Action != ai.ActionNeedsClarification {
		t.Errorf("expected NEEDS_CLARIFICATION para booking vago, got %s (msg=%q)", resp.Action, resp.Message)
	}
}

func TestAssistantService_FailureReturnsFriendlyMessageNotError(t *testing.T) {
	now := time.Now().UTC()
	// Título válido + data válida, mas sem TodoService (nil) simula indisponibilidade:
	// deve retornar mensagem amigável, nunca erro 500 opaco.
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "clarify-nil.db"))
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })
	eventRepo := repository.NewEventRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)
	calSvc := service.NewCalendarService(eventRepo)
	mockAI := &mockAIGateway{intent: &ai.ParsedIntent{
		Action:  ai.ActionCreateTodo,
		Message: "",
		Todo:    &ai.ParsedTodo{Title: "Comprar café", Priority: "medium"},
	}}
	astSvc := service.NewAssistantService(mockAI, calSvc, nil, memoryRepo)
	resp, err := astSvc.Process(context.Background(), "user-x", ai.UserInput{Text: "lembrar de comprar café", Now: now})
	if err != nil {
		t.Fatalf("falha deve virar mensagem amigável, não erro: %v", err)
	}
	if resp.Message == "" {
		t.Errorf("expected mensagem explicando a falha, got empty")
	}
}
