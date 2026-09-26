package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/kito/backend/internal/ai"
	"github.com/andrevmp/kito/backend/internal/database"
	"github.com/andrevmp/kito/backend/internal/handler"
	"github.com/andrevmp/kito/backend/internal/repository"
	"github.com/andrevmp/kito/backend/internal/server"
	"github.com/andrevmp/kito/backend/internal/service"
)

type mockGatewaySuccess struct{}

func (m *mockGatewaySuccess) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	return &ai.ParsedIntent{
		Action:  ai.ActionCreateEvent,
		Message: "Evento marcado para amanhã!",
		Event: &ai.ParsedEvent{
			Title:   "Academia com Personal",
			StartAt: time.Date(2026, 9, 29, 8, 0, 0, 0, time.UTC),
			EndAt:   time.Date(2026, 9, 29, 9, 0, 0, 0, time.UTC),
		},
		ProviderUsed: "Google AI Studio Mock",
	}, nil
}

func setupAssistantIntegrationServer(t *testing.T) (*httptest.Server, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_ast_http.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	jwtSecret := "integration-test-secret"
	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)

	authSvc := service.NewAuthService(userRepo, jwtSecret)
	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)
	astSvc := service.NewAssistantService(&mockGatewaySuccess{}, calSvc, todoSvc)

	authHandler := handler.NewAuthHandler(authSvc, userRepo)
	calHandler := handler.NewCalendarHandler(calSvc)
	todoHandler := handler.NewTodoHandler(todoSvc)
	astHandler := handler.NewAssistantHandler(astSvc)

	srv := server.New(server.Config{
		AuthHandler: authHandler,
		CalHandler:  calHandler,
		TodoHandler: todoHandler,
		AstHandler:  astHandler,
		AuthSvc:     authSvc,
	})

	ts := httptest.NewServer(srv.Router())
	t.Cleanup(func() { ts.Close() })

	// Cria usuário e obtém token
	_, token, _ := authSvc.Register("André", "andre@ai.test", "senha12345")
	return ts, token
}

func TestAssistantHandler_ChatEndpoint(t *testing.T) {
	ts, token := setupAssistantIntegrationServer(t)

	chatPayload := map[string]string{
		"text": "Marque academia amanhã às 8h",
	}
	jsonBody, _ := json.Marshal(chatPayload)

	req, _ := http.NewRequest("POST", ts.URL+"/api/v1/assistant/chat", bytes.NewBuffer(jsonBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d", resp.StatusCode)
	}

	var astResp service.AssistantResponse
	if err := json.NewDecoder(resp.Body).Decode(&astResp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if astResp.Action != ai.ActionCreateEvent {
		t.Errorf("expected action CREATE_EVENT, got %s", astResp.Action)
	}
	if astResp.Event == nil || astResp.Event.Title != "Academia com Personal" {
		t.Errorf("expected event title 'Academia com Personal', got %v", astResp.Event)
	}
}
