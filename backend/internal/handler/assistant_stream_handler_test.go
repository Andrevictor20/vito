package handler_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

type testHandlerMockProvider struct{}

func (m *testHandlerMockProvider) Name() string             { return "test-provider" }
func (m *testHandlerMockProvider) ModelName() string        { return "test-model" }
func (m *testHandlerMockProvider) SupportsTools() bool      { return true }
func (m *testHandlerMockProvider) SupportsVision() bool     { return false }
func (m *testHandlerMockProvider) QualityTier() int         { return 3 }
func (m *testHandlerMockProvider) MaxContextTokens() int    { return 100000 }
func (m *testHandlerMockProvider) Chat(ctx context.Context, req ai.AgentChatRequest) (*ai.AgentChatResponse, error) {
	return &ai.AgentChatResponse{Text: "Resposta do endpoint", ProviderName: "test-provider", ModelName: "test-model"}, nil
}
func (m *testHandlerMockProvider) StreamChat(ctx context.Context, req ai.AgentChatRequest, onDelta func(ai.StreamDelta) error) (*ai.AgentChatResponse, error) {
	if onDelta != nil {
		_ = onDelta(ai.StreamDelta{TextDelta: "Resposta do endpoint"})
	}
	return m.Chat(ctx, req)
}

func setupStreamHandlerTest(t *testing.T) (*handler.AssistantStreamHandler, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_handler.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "user-handler-1"
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "User Handler",
		Email:     "handler@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	convRepo := repository.NewConversationStoreRepository(db)
	router := ai.NewModelRouter(&testHandlerMockProvider{})
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)
	reg := toolsets.NewToolsetsRegistry()
	loop := service.NewAgentLoop(router, reg, guard, gate, convRepo, nil)

	return handler.NewAssistantStreamHandler(loop), userID
}

func TestAssistantStreamHandler_Chat(t *testing.T) {
	h, userID := setupStreamHandlerTest(t)

	bodyBytes, _ := json.Marshal(domain.UnifiedAssistantRequest{
		Message: "Olá Vito",
		Channel: "app_mobile",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/chat", bytes.NewReader(bodyBytes))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	h.Chat(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d (%s)", rec.Code, rec.Body.String())
	}

	var resp domain.UnifiedAssistantResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("falha ao decodificar resposta JSON: %v", err)
	}
	if resp.Text != "Resposta do endpoint" {
		t.Errorf("esperava 'Resposta do endpoint', obteve %s", resp.Text)
	}
}

func TestAssistantStreamHandler_Stream(t *testing.T) {
	h, userID := setupStreamHandlerTest(t)

	bodyBytes, _ := json.Marshal(domain.UnifiedAssistantRequest{
		Message: "Streaming teste",
		Channel: "app_desktop",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/stream", bytes.NewReader(bodyBytes))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	h.Stream(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava status 200 para SSE, obteve %d", rec.Code)
	}
	contentType := rec.Header().Get("Content-Type")
	if contentType != "text/event-stream" {
		t.Errorf("esperava text/event-stream, obteve %s", contentType)
	}
}

type streamMockTranscriber struct{}

func (m *streamMockTranscriber) Transcribe(ctx context.Context, audio io.Reader, filename string) (string, error) {
	return "Comprar leite amanhã", nil
}

func TestAssistantStreamHandler_AudioChat(t *testing.T) {
	h, userID := setupStreamHandlerTest(t)
	h.SetTranscriber(&streamMockTranscriber{})

	bodyBytes, _ := json.Marshal(map[string]any{
		"audio_b64": base64.StdEncoding.EncodeToString([]byte("fake-audio")),
		"filename":  "audio.m4a",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/audio", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	h.AudioChat(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava status 200 para AudioChat, obteve %d (%s)", rec.Code, rec.Body.String())
	}
	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("falha ao decodificar json: %v", err)
	}
	if res["transcript"] != "Comprar leite amanhã" {
		t.Errorf("transcrição esperada 'Comprar leite amanhã', obteve %v", res["transcript"])
	}
}

func TestAssistantStreamHandler_VisionChat(t *testing.T) {
	h, userID := setupStreamHandlerTest(t)

	bodyBytes, _ := json.Marshal(map[string]any{
		"image_b64": base64.StdEncoding.EncodeToString([]byte("fake-image")),
		"prompt":    "O que tem nesta imagem?",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/vision", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	h.VisionChat(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava status 200 para VisionChat, obteve %d (%s)", rec.Code, rec.Body.String())
	}
}
