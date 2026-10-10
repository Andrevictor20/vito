package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockTranscriber struct {
	text string
	err  error
}

func (m *mockTranscriber) Transcribe(ctx context.Context, audioReader io.Reader, filename string) (string, error) {
	if m.err != nil {
		return "", m.err
	}
	return m.text, nil
}

type mockAIGateway struct {
	intent        *ai.ParsedIntent
	capturedInput ai.UserInput
}

func (m *mockAIGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	m.capturedInput = input
	return m.intent, nil
}


func TestAssistantHandler_AudioChat(t *testing.T) {
	mockTrans := &mockTranscriber{text: "Lembrar de comprar leite"}
	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:       ai.ActionSaveMemory,
			Message:      "Anotado na memória!",
			ProviderUsed: "MockAI",
		},
	}

	astSvc := service.NewAssistantService(mockAI, nil, nil, nil)
	astHandler := handler.NewAssistantHandler(astSvc, mockTrans)

	// Prepara multipart body
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("audio", "audio.m4a")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	_, _ = part.Write([]byte("fake-audio-bytes"))
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/audio", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())

	// Injeta UserID no contexto simulando JWT
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-123")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	astHandler.AudioChat(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Action     string `json:"action"`
		Transcript string `json:"transcript"`
		Message    string `json:"message"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Transcript != "Lembrar de comprar leite" {
		t.Errorf("expected transcript 'Lembrar de comprar leite', got '%s'", resp.Transcript)
	}
	if resp.Action != string(ai.ActionSaveMemory) {
		t.Errorf("expected action %s, got %s", ai.ActionSaveMemory, resp.Action)
	}
}

func TestAssistantHandler_AudioChat_FallbackToNative(t *testing.T) {
	// Simula erro no Whisper
	mockTrans := &mockTranscriber{err: io.ErrUnexpectedEOF}
	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:       ai.ActionGeneralChat,
			Message:      "Áudio nativo processado via fallback!",
			ProviderUsed: "Gemini Native Audio",
		},
	}

	astSvc := service.NewAssistantService(mockAI, nil, nil, nil)
	astHandler := handler.NewAssistantHandler(astSvc, mockTrans)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("audio", "sample.m4a")
	if err != nil {
		t.Fatalf("failed to create form file: %v", err)
	}
	_, _ = part.Write([]byte("fake-audio-bytes"))
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/audio", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-123")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	astHandler.AudioChat(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 via fallback, got %d. Body: %s", rr.Code, rr.Body.String())
	}
}

func TestAssistantHandler_VisionChat(t *testing.T) {
	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:       ai.ActionCreateTodo,
			Message:      "Recibo processado com sucesso!",
			ProviderUsed: "Gemini Vision",
		},
	}

	astSvc := service.NewAssistantService(mockAI, nil, nil, nil)
	astHandler := handler.NewAssistantHandler(astSvc, nil)

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	_ = writer.WriteField("prompt", "Extraia os itens deste recibo")
	part, err := writer.CreateFormFile("image", "receipt.jpg")
	if err != nil {
		t.Fatalf("failed to create image form file: %v", err)
	}
	_, _ = part.Write([]byte("fake-jpeg-data"))
	_ = writer.Close()

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/vision", body)
	req.Header.Set("Content-Type", writer.FormDataContentType())
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-vision-1")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	astHandler.VisionChat(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Action       string `json:"action"`
		Message      string `json:"message"`
		ProviderUsed string `json:"provider_used"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse json response: %v", err)
	}

	if resp.Action != string(ai.ActionCreateTodo) {
		t.Errorf("expected ActionCreateTodo, got %s", resp.Action)
	}
}

func TestAssistantHandler_Chat_CurrentLocalTime(t *testing.T) {
	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:       ai.ActionCreateEvent,
			Message:      "Reunião agendada!",
			ProviderUsed: "MockAI",
		},
	}

	astSvc := service.NewAssistantService(mockAI, nil, nil, nil)
	astHandler := handler.NewAssistantHandler(astSvc, nil)

	// Simula cliente enviando às 21:32 do dia 05/10/2026 em Brasília (-03:00)
	clientLocalTime := "2026-10-05T21:32:00-03:00"
	reqPayload := map[string]string{
		"text":               "Marque reunião para amanhã",
		"current_local_time": clientLocalTime,
		"timezone":           "America/Sao_Paulo",
	}
	bodyBytes, _ := json.Marshal(reqPayload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/chat", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-chat-1")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	astHandler.Chat(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	// Verifica se o UserInput recebido pelo gateway ancorou o Now na data/hora informada pelo cliente
	captured := mockAI.capturedInput
	if captured.Now.IsZero() {
		t.Fatalf("captured.Now não deveria ser zero")
	}

	// Converte para o fuso informado e verifica o dia civil
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}
	nowInLoc := captured.Now.In(loc)
	if nowInLoc.Day() != 5 || nowInLoc.Month() != 10 || nowInLoc.Year() != 2026 {
		t.Fatalf("Dia local do usuário capturado incorretamente: %v (esperava 2026-10-05)", nowInLoc)
	}
	if nowInLoc.Hour() != 21 || nowInLoc.Minute() != 32 {
		t.Fatalf("Hora local do usuário capturada incorretamente: %v (esperava 21:32)", nowInLoc)
	}
}

func TestAssistantHandler_AudioChat_JSON(t *testing.T) {
	mockTrans := &mockTranscriber{text: "Reunião de alinhamento amanhã"}
	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:       ai.ActionCreateEvent,
			Message:      "Reunião agendada!",
			ProviderUsed: "MockAI",
		},
	}

	astSvc := service.NewAssistantService(mockAI, nil, nil, nil)
	astHandler := handler.NewAssistantHandler(astSvc, mockTrans)

	// Simula payload JSON com audio_b64 (sem multipart)
	jsonPayload := map[string]string{
		"audio_b64":          "ZmFrZS1hdWRpby1ieXRlcw==", // base64 de "fake-audio-bytes"
		"timezone":           "America/Sao_Paulo",
		"current_local_time": "2026-10-08T19:00:00-03:00",
	}
	bodyBytes, _ := json.Marshal(jsonPayload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/audio", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-audio-json")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	astHandler.AudioChat(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Action     string `json:"action"`
		Transcript string `json:"transcript"`
		Message    string `json:"message"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Transcript != "Reunião de alinhamento amanhã" {
		t.Errorf("expected transcript 'Reunião de alinhamento amanhã', got '%s'", resp.Transcript)
	}
	if resp.Action != string(ai.ActionCreateEvent) {
		t.Errorf("expected action %s, got %s", ai.ActionCreateEvent, resp.Action)
	}
}

func TestAssistantHandler_VisionChat_JSON(t *testing.T) {
	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:       ai.ActionCreateEvent,
			Message:      "Evento extraído da imagem!",
			ProviderUsed: "MockAI",
		},
	}

	astSvc := service.NewAssistantService(mockAI, nil, nil, nil)
	astHandler := handler.NewAssistantHandler(astSvc, nil)

	// Simula payload JSON com image_b64 (sem multipart)
	jsonPayload := map[string]string{
		"image_b64":          "LzlqLzRBQVFza1pJRmdBQkFRRUFTQUJJQUFE...",
		"prompt":             "Analise o convite",
		"timezone":           "America/Sao_Paulo",
		"current_local_time": "2026-10-08T19:00:00-03:00",
	}
	bodyBytes, _ := json.Marshal(jsonPayload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/vision", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-vision-json")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	astHandler.VisionChat(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	var resp struct {
		Action  string `json:"action"`
		Message string `json:"message"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if resp.Action != string(ai.ActionCreateEvent) {
		t.Errorf("expected action %s, got %s", ai.ActionCreateEvent, resp.Action)
	}
}

func TestAssistantHandler_ChatWithHistory(t *testing.T) {
	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:       ai.ActionGeneralChat,
			Message:      "Continuando nossa conversa sobre estudos...",
			ProviderUsed: "MockAI",
		},
	}

	astSvc := service.NewAssistantService(mockAI, nil, nil, nil)
	astHandler := handler.NewAssistantHandler(astSvc, nil)

	payload := map[string]interface{}{
		"prompt": "Qual foi a última dica que você me deu?",
		"history": []map[string]string{
			{"sender": "user", "text": "Quero estudar cálculo"},
			{"sender": "vito", "text": "Recomendo começar por derivadas"},
		},
	}
	bodyBytes, _ := json.Marshal(payload)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/chat", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-chat-hist")
	req = req.WithContext(ctx)

	rr := httptest.NewRecorder()
	astHandler.Chat(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d. Body: %s", rr.Code, rr.Body.String())
	}

	if len(mockAI.capturedInput.ConversationHistory) != 2 {
		t.Fatalf("expected 2 history items in captured input, got %d", len(mockAI.capturedInput.ConversationHistory))
	}
	if mockAI.capturedInput.ConversationHistory[0].Text != "Quero estudar cálculo" {
		t.Errorf("expected history item text 'Quero estudar cálculo', got: %s", mockAI.capturedInput.ConversationHistory[0].Text)
	}
}


