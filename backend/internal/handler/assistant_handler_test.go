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
	intent *ai.ParsedIntent
}

func (m *mockAIGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
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
