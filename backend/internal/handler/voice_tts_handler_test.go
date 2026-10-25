package handler_test

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

const testVoiceDefault = "pt-BR-AntonioNeural"

// mockTTSService é um stub injetável para o serviço de TTS nos testes do handler.
// Implementa ai.TTSService (Synthesize com contexto). Não é um "blind mock":
// retorna valores fixos e expõe o número de chamadas e os argumentos capturados.
type mockTTSService struct {
	calls         int
	capturedText  string
	capturedVoice string
	audio         []byte
	mime          string
	err           error
}

func (m *mockTTSService) Synthesize(_ context.Context, text, voice string) ([]byte, string, error) {
	m.calls++
	m.capturedText = text
	m.capturedVoice = voice
	return m.audio, m.mime, m.err
}

func TestVoiceTTSHandler_ValidRequest(t *testing.T) {
	mock := &mockTTSService{audio: []byte("fake-audio"), mime: "audio/mpeg"}
	h := handler.NewVoiceTTSHandler(mock)

	reqBody := `{"text":"Olá, mundo","voice":"pt-BR-AntonioNeural"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/tts", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-123"))

	rr := httptest.NewRecorder()
	h.HandleTTS(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperado 200, obteve %d. Body: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		AudioB64 string `json:"audio_b64"`
		Mime     string `json:"mime"`
		Voice    string `json:"voice"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("falha ao decodir resposta JSON: %v", err)
	}
	if resp.AudioB64 == "" {
		t.Error("esperado campo audio_b64 preenchido")
	}
	if _, err := base64.StdEncoding.DecodeString(resp.AudioB64); err != nil {
		t.Errorf("audio_b64 não é base64 válido: %v", err)
	}
	if resp.Mime != "audio/mpeg" {
		t.Errorf("esperado mime audio/mpeg, obtido %q", resp.Mime)
	}
	if resp.Voice != testVoiceDefault {
		t.Errorf("esperado voice %q na resposta, obtido %q", testVoiceDefault, resp.Voice)
	}
	if mock.calls != 1 {
		t.Errorf("esperado 1 chamada ao serviço de TTS, obtido %d", mock.calls)
	}
	if mock.capturedText != "Olá, mundo" {
		t.Errorf("texto capturado deveria ser 'Olá, mundo', obtido %q", mock.capturedText)
	}
	if mock.capturedVoice != testVoiceDefault {
		t.Errorf("voz capturada deveria ser %q, obtido %q", testVoiceDefault, mock.capturedVoice)
	}
}

func TestVoiceTTSHandler_EmptyText(t *testing.T) {
	mock := &mockTTSService{audio: []byte("x"), mime: "audio/mpeg"}
	h := handler.NewVoiceTTSHandler(mock)

	reqBody := `{"text":"","voice":"pt-BR-AntonioNeural"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/tts", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-123"))

	rr := httptest.NewRecorder()
	h.HandleTTS(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("esperado 400 para texto vazio, obteve %d. Body: %s", rr.Code, rr.Body.String())
	}
	if mock.calls != 0 {
		t.Errorf("texto vazio não deve chamar o serviço (calls=0), obtido %d", mock.calls)
	}
}

func TestVoiceTTSHandler_Unauthorized(t *testing.T) {
	mock := &mockTTSService{audio: []byte("x"), mime: "audio/mpeg"}
	h := handler.NewVoiceTTSHandler(mock)

	reqBody := `{"text":"Olá","voice":"pt-BR-AntonioNeural"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/tts", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	// Sem injetar UserID no contexto → simula ausência do header Authorization.

	rr := httptest.NewRecorder()
	h.HandleTTS(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("esperado 401 sem autorização, obteve %d. Body: %s", rr.Code, rr.Body.String())
	}
	if mock.calls != 0 {
		t.Errorf("requisição não autorizada não deve chamar o serviço (calls=0), obtido %d", mock.calls)
	}
}

func TestVoiceTTSHandler_TextTooLong(t *testing.T) {
	mock := &mockTTSService{audio: []byte("x"), mime: "audio/mpeg"}
	h := handler.NewVoiceTTSHandler(mock)

	longText := strings.Repeat("a", 2001)
	reqBody := `{"text":"` + longText + `","voice":"pt-BR-AntonioNeural"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/tts", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-123"))

	rr := httptest.NewRecorder()
	h.HandleTTS(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("esperado 400 para texto muito longo, obteve %d. Body: %s", rr.Code, rr.Body.String())
	}
	if mock.calls != 0 {
		t.Errorf("texto muito longo não deve chamar o serviço (calls=0), obtido %d", mock.calls)
	}
}

func TestVoiceTTSHandler_ServiceError(t *testing.T) {
	mock := &mockTTSService{err: errors.New("edge-tts falhou")}
	h := handler.NewVoiceTTSHandler(mock)

	reqBody := `{"text":"Olá","voice":"pt-BR-AntonioNeural"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/tts", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-123"))

	rr := httptest.NewRecorder()
	h.HandleTTS(rr, req)

	if rr.Code != http.StatusBadGateway && rr.Code != http.StatusInternalServerError {
		t.Fatalf("esperado 502 ou 500 para erro do serviço, obteve %d. Body: %s", rr.Code, rr.Body.String())
	}
	body := rr.Body.String()
	if strings.Contains(body, "stack") || strings.Contains(body, "trace") || strings.Contains(body, "at ") {
		t.Error("resposta de erro não deve vazar stack trace")
	}
	if mock.calls != 1 {
		t.Errorf("esperado 1 chamada ao serviço mesmo em erro, obtido %d", mock.calls)
	}
}

func TestVoiceTTSHandler_DefaultVoice(t *testing.T) {
	mock := &mockTTSService{audio: []byte("x"), mime: "audio/mpeg"}
	h := handler.NewVoiceTTSHandler(mock)

	reqBody := `{"text":"Olá"}` // sem voice
	req := httptest.NewRequest(http.MethodPost, "/api/v1/voice/tts", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-123"))

	rr := httptest.NewRecorder()
	h.HandleTTS(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperado 200 com voice default, obteve %d. Body: %s", rr.Code, rr.Body.String())
	}
	// O handler repassa o voice como veio; o default (pt-BR-AntonioNeural) é
	// aplicado pelo serviço (coberto em TestTTSService_DefaultVoice).
	if mock.capturedVoice != "" {
		t.Errorf("quando voice não enviado, o handler deve repassar vazio (default cabe ao serviço), obtido %q", mock.capturedVoice)
	}
}
