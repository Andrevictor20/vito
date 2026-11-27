package handler_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"iter"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/ai/voice"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"
)

type testHandlerMockLLM struct {
	model string
	reply string
}

func (m *testHandlerMockLLM) Name() string {
	if m.model != "" {
		return m.model
	}
	return "test-model"
}

func (m *testHandlerMockLLM) GenerateContent(_ context.Context, _ *model.LLMRequest, stream bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {
		if stream {
			if !yield(&model.LLMResponse{
				Partial: true,
				Content: &genai.Content{Role: genai.RoleModel, Parts: []*genai.Part{{Text: m.reply}}},
			}, nil) {
				return
			}
		}
		yield(&model.LLMResponse{
			ModelVersion: m.Name(),
			TurnComplete: true,
			Content:      &genai.Content{Role: genai.RoleModel, Parts: []*genai.Part{{Text: m.reply}}},
		}, nil)
	}
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
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)
	reg := toolsets.NewToolsetsRegistry()
	llm := &testHandlerMockLLM{model: "test-model", reply: "Resposta do endpoint"}
	facade, fErr := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:       []adkengine.ServerPoolEntry{{ProviderKey: "gemini", DisplayName: "test-provider", ModelID: "test-model", Tier: 3, LLM: llm}},
		Registry:         reg,
		ScopeGuard:       guard,
		ConfirmationGate: gate,
		ConvRepo:         convRepo,
	})
	if fErr != nil {
		t.Fatalf("NewADKLoopFacade falhou: %v", fErr)
	}

	return handler.NewAssistantStreamHandler(facade), userID
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
	ttsSvc := voice.NewTTSService(mockSynth, t.TempDir(), "Puck")
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
	guard := service.NewScopeGuard()
	gate := service.NewConfirmationGateService(db)
	reg := toolsets.NewToolsetsRegistry()
	llm := &testHandlerMockLLM{model: "markdown-model", reply: "**Bom dia, André!** Você tem **2 compromissos** marcados hoje."}
	facade, fErr := adkengine.NewADKLoopFacade(adkengine.FacadeConfig{
		ServerPool:       []adkengine.ServerPoolEntry{{ProviderKey: "gemini", DisplayName: "markdown-provider", ModelID: "markdown-model", Tier: 3, LLM: llm}},
		Registry:         reg,
		ScopeGuard:       guard,
		ConfirmationGate: gate,
		ConvRepo:         convRepo,
		UserRepo:         userRepo,
	})
	if fErr != nil {
		t.Fatalf("NewADKLoopFacade falhou: %v", fErr)
	}

	h := handler.NewAssistantStreamHandler(facade)
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
