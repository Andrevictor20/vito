package handler_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestAssistantHandler_AudioChat_ForwardsHistoryAndFocusMode_JSON(t *testing.T) {
	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:       ai.ActionGeneralChat,
			Message:      "Entendido com áudio.",
			ProviderUsed: "MockAI",
		},
	}
	astSvc := service.NewAssistantService(mockAI, nil, nil, nil)
	astHandler := handler.NewAssistantHandler(astSvc, &mockTranscriber{text: "Criar relatório"})

	audioPayload := base64.StdEncoding.EncodeToString([]byte("fake-audio-bytes"))
	reqBody := map[string]interface{}{
		"audio_b64":  audioPayload,
		"audio_mime": "audio/m4a",
		"timezone":   "America/Sao_Paulo",
		"focus_mode": "briefing",
		"history": []map[string]string{
			{"sender": "user", "text": "Mensagem anterior"},
			{"sender": "vito", "text": "Resposta anterior"},
		},
	}
	jsonBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/audio", bytes.NewReader(jsonBytes))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-audio-test"))

	rr := httptest.NewRecorder()
	astHandler.AudioChat(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperava 200, obteve %d: %s", rr.Code, rr.Body.String())
	}

	captured := mockAI.capturedInput
	if captured.FocusMode != "briefing" {
		t.Errorf("esperava FocusMode='briefing', obteve %q", captured.FocusMode)
	}
	if len(captured.ConversationHistory) != 2 {
		t.Fatalf("esperava 2 itens de histórico, obteve %d", len(captured.ConversationHistory))
	}
	if captured.ConversationHistory[0].Text != "Mensagem anterior" {
		t.Errorf("primeiro item de histórico incorreto: %v", captured.ConversationHistory[0])
	}
}

func TestAssistantHandler_VisionChat_ForwardsHistoryAndFocusMode_JSON(t *testing.T) {
	mockAI := &mockAIGateway{
		intent: &ai.ParsedIntent{
			Action:       ai.ActionGeneralChat,
			Message:      "Entendido com imagem.",
			ProviderUsed: "MockAI",
		},
	}
	astSvc := service.NewAssistantService(mockAI, nil, nil, nil)
	astHandler := handler.NewAssistantHandler(astSvc, nil)

	// Imagem 1x1 GIF válida base64
	tinyGIF := "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
	reqBody := map[string]interface{}{
		"image_b64":  tinyGIF,
		"image_mime": "image/gif",
		"prompt":     "O que é isso?",
		"timezone":   "America/Sao_Paulo",
		"focus_mode": "calendar",
		"history": []map[string]string{
			{"sender": "user", "text": "Analise o cupom fiscal"},
		},
	}
	jsonBytes, _ := json.Marshal(reqBody)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/vision", bytes.NewReader(jsonBytes))
	req.Header.Set("Content-Type", "application/json")
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-vision-test"))

	rr := httptest.NewRecorder()
	astHandler.VisionChat(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("esperava 200, obteve %d: %s", rr.Code, rr.Body.String())
	}

	captured := mockAI.capturedInput
	if captured.FocusMode != "calendar" {
		t.Errorf("esperava FocusMode='calendar', obteve %q", captured.FocusMode)
	}
	if len(captured.ConversationHistory) != 1 {
		t.Fatalf("esperava 1 item de histórico, obteve %d", len(captured.ConversationHistory))
	}
	if captured.ConversationHistory[0].Text != "Analise o cupom fiscal" {
		t.Errorf("item de histórico incorreto: %v", captured.ConversationHistory[0])
	}
}
