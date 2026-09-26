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
	astSvc *service.AssistantService
}

func NewAssistantHandler(astSvc *service.AssistantService) *AssistantHandler {
	return &AssistantHandler{astSvc: astSvc}
}

type assistantChatRequest struct {
	Text      string `json:"text,omitempty"`
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

	if req.Text == "" && req.AudioB64 == "" && req.ImageB64 == "" {
		http.Error(w, `{"error":"forneça texto, áudio ou imagem para o assistente"}`, http.StatusBadRequest)
		return
	}

	input := ai.UserInput{
		Text:      req.Text,
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
