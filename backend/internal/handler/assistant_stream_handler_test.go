package handler_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
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

type streamMockTTSSynthesizer struct {
	lastText  string
	lastVoice string
}

func (m *streamMockTTSSynthesizer) Synthesize(text, voice string) ([]byte, string, error) {
	m.lastText = text
	m.lastVoice = voice
	return []byte("RIFF-fake-wav-gemini"), "audio/wav", nil
}

func TestAssistantStreamHandler_AudioChat_InlineTTSAndContext(t *testing.T) {
	h, userID := setupStreamHandlerTest(t)
	h.SetTranscriber(&streamMockTranscriber{})

	mockSynth := &streamMockTTSSynthesizer{}
	ttsSvc := ai.NewTTSService(mockSynth, t.TempDir(), "Puck")
	h.SetTTSService(ttsSvc)

	bodyBytes, _ := json.Marshal(map[string]any{
		"audio_b64":          base64.StdEncoding.EncodeToString([]byte("RIFF-user-wav")),
		"audio_mime":         "audio/wav",
		"filename":           "audio.wav",
		"timezone":           "America/Sao_Paulo",
		"current_local_time": "2026-10-31T10:55:00-03:00",
		"screen_context":     "WhatsApp · Mariana: Consegue falar às 15h?",
		"voice":              "Kore",
		"include_tts":        true,
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/audio", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	h.AudioChat(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava status 200 para AudioChat com TTS inline, obteve %d (%s)", rec.Code, rec.Body.String())
	}
	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("falha ao decodificar json: %v", err)
	}
	if res["tts_audio_b64"] == nil || res["tts_audio_b64"] == "" {
		t.Fatalf("esperava tts_audio_b64 preenchido no retorno de AudioChat, obteve %v", res["tts_audio_b64"])
	}
	if res["tts_audio_mime"] != "audio/wav" {
		t.Errorf("esperava tts_audio_mime 'audio/wav', obteve %v", res["tts_audio_mime"])
	}
	if mockSynth.lastVoice != "Kore" {
		t.Errorf("esperava voz 'Kore' passada ao sintetizador, obteve %q", mockSynth.lastVoice)
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

type emptyMockTranscriber struct{}

func (m *emptyMockTranscriber) Transcribe(ctx context.Context, audio io.Reader, filename string) (string, error) {
	return "", nil
}

func TestAssistantStreamHandler_AudioChat_EmptyTranscript_ReturnsImmediateNotice(t *testing.T) {
	h, userID := setupStreamHandlerTest(t)
	h.SetTranscriber(&emptyMockTranscriber{})

	bodyBytes, _ := json.Marshal(map[string]any{
		"audio_b64": base64.StdEncoding.EncodeToString([]byte("silence")),
		"filename":  "audio.m4a",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/audio", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	h.AudioChat(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d", rec.Code)
	}
	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("falha ao decodificar json: %v", err)
	}
	reply := fmt.Sprintf("%v", res["reply"])
	if !strings.Contains(reply, "Não consegui captar sua voz") {
		t.Errorf("esperava aviso de voz não captada, obteve %s", reply)
	}
	if strings.Contains(reply, "compromisso") || strings.Contains(reply, "pendente") {
		t.Errorf("não deve mencionar compromissos ou pendências em áudio silencioso: %s", reply)
	}
}

type markdownMockProvider struct{}

func (m *markdownMockProvider) Name() string          { return "markdown-provider" }
func (m *markdownMockProvider) ModelName() string     { return "markdown-model" }
func (m *markdownMockProvider) SupportsTools() bool   { return false }
func (m *markdownMockProvider) SupportsVision() bool  { return false }
func (m *markdownMockProvider) QualityTier() int      { return 3 }
func (m *markdownMockProvider) MaxContextTokens() int { return 100000 }
func (m *markdownMockProvider) Chat(ctx context.Context, req ai.AgentChatRequest) (*ai.AgentChatResponse, error) {
	return &ai.AgentChatResponse{Text: "**Bom dia, André!** Você tem **2 compromissos** marcados hoje."}, nil
}
func (m *markdownMockProvider) StreamChat(ctx context.Context, req ai.AgentChatRequest, onDelta func(ai.StreamDelta) error) (*ai.AgentChatResponse, error) {
	return m.Chat(ctx, req)
}

func TestAssistantStreamHandler_AudioChat_CleansMarkdownAndIsolatesThread(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_markdown.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "user-voice-1"
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "André Santos",
		Email:     "andre@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	convRepo := repository.NewConversationStoreRepository(db)
	router := ai.NewModelRouter(&markdownMockProvider{})
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)
	reg := toolsets.NewToolsetsRegistry()
	loop := service.NewAgentLoop(router, reg, guard, gate, convRepo, nil)
	loop.SetUserRepositories(userRepo, nil)

	h := handler.NewAssistantStreamHandler(loop)
	h.SetTranscriber(&streamMockTranscriber{})

	bodyBytes, _ := json.Marshal(map[string]any{
		"audio_b64": base64.StdEncoding.EncodeToString([]byte("fake-audio")),
		"filename":  "audio.wav",
		"thread_id": "isolated-voice-thread-99",
		"channel":   "voice",
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/audio", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	req = req.WithContext(ctx)

	rec := httptest.NewRecorder()
	h.AudioChat(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d", rec.Code)
	}
	var res map[string]any
	if err := json.Unmarshal(rec.Body.Bytes(), &res); err != nil {
		t.Fatalf("falha ao decodificar json: %v", err)
	}

	reply := fmt.Sprintf("%v", res["reply"])
	if strings.Contains(reply, "**") {
		t.Errorf("resposta de voz não deve conter asteriscos de markdown (**): %s", reply)
	}
	if !strings.Contains(reply, "Bom dia, André!") || !strings.Contains(reply, "2 compromissos") {
		t.Errorf("resposta deve preservar o texto limpo sem formatação, obteve: %s", reply)
	}
	if res["thread_id"] != "isolated-voice-thread-99" {
		t.Errorf("esperava thread_id 'isolated-voice-thread-99', obteve %v", res["thread_id"])
	}
}
