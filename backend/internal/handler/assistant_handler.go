package handler

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type AssistantHandler struct {
	astSvc      *service.AssistantService
	transcriber ai.AudioTranscriber
}

func NewAssistantHandler(astSvc *service.AssistantService, transcriber ai.AudioTranscriber) *AssistantHandler {
	return &AssistantHandler{
		astSvc:      astSvc,
		transcriber: transcriber,
	}
}

type assistantChatRequest struct {
	Text      string `json:"text,omitempty"`
	Prompt    string `json:"prompt,omitempty"`
	AudioB64  string `json:"audio_b64,omitempty"`
	AudioMime string `json:"audio_mime,omitempty"`
	ImageB64  string `json:"image_b64,omitempty"`
	Timezone  string `json:"timezone,omitempty"`
}

func (h *AssistantHandler) Chat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req assistantChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload inválido"}`, http.StatusBadRequest)
		return
	}

	rawText := req.Text
	if rawText == "" {
		rawText = req.Prompt
	}

	if rawText == "" && req.AudioB64 == "" && req.ImageB64 == "" {
		http.Error(w, `{"error":"forneça texto ou prompt para o assistente"}`, http.StatusBadRequest)
		return
	}

	input := ai.UserInput{
		Text:      rawText,
		AudioB64:  req.AudioB64,
		AudioMime: req.AudioMime,
		ImageB64:  req.ImageB64,
		Timezone:  req.Timezone,
		Now:       time.Now().UTC(),
	}

	resp, err := h.astSvc.Process(r.Context(), userID, input)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error()})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// AudioChat processa um arquivo de áudio enviado via multipart/form-data, transcreve com Whisper e processa o comando.
func (h *AssistantHandler) AudioChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	if h.transcriber == nil {
		http.Error(w, `{"error":"serviço de transcrição de áudio não configurado"}`, http.StatusServiceUnavailable)
		return
	}

	if err := r.ParseMultipartForm(25 << 20); err != nil {
		http.Error(w, `{"error":"falha ao processar formulário multipart: `+err.Error()+`"}`, http.StatusBadRequest)
		return
	}

	file, header, err := r.FormFile("audio")
	if err != nil {
		file, header, err = r.FormFile("file")
		if err != nil {
			http.Error(w, `{"error":"campo 'audio' ou 'file' não encontrado no formulário multipart"}`, http.StatusBadRequest)
			return
		}
	}
	defer file.Close()

	transcript, err := h.transcriber.Transcribe(r.Context(), file, header.Filename)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadGateway)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "falha na transcrição de voz: " + err.Error()})
		return
	}

	input := ai.UserInput{
		Text: transcript,
		Now:  time.Now().UTC(),
	}

	resp, err := h.astSvc.Process(r.Context(), userID, input)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": err.Error(), "transcript": transcript})
		return
	}

	// Envelope com a transcrição incluída para feedback na UI
	responseMap := map[string]interface{}{
		"transcript":    transcript,
		"action":        resp.Action,
		"intent":        resp.Intent,
		"message":       resp.Message,
		"reply":         resp.Reply,
		"event":         resp.Event,
		"conflict":      resp.Conflict,
		"todo":          resp.Todo,
		"provider_used": resp.ProviderUsed,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(responseMap)
}
