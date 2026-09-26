package service_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/kito/backend/internal/ai"
	"github.com/andrevmp/kito/backend/internal/database"
	"github.com/andrevmp/kito/backend/internal/domain"
	"github.com/andrevmp/kito/backend/internal/repository"
	"github.com/andrevmp/kito/backend/internal/service"
)

type mockAIGateway struct {
	intent *ai.ParsedIntent
}

func (m *mockAIGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
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

	astSvc := service.NewAssistantService(mockAI, calSvc, todoSvc)
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
