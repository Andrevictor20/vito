package handler

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	aivoice "github.com/andrevmp/vito/backend/internal/ai/voice"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"github.com/andrevmp/vito/backend/internal/service"
)

// AssistantStreamHandler expõe os endpoints unificados REST, SSE e multimodais para o motor ADK.
type AssistantStreamHandler struct {
	engine      service.AssistantEngine
	transcriber aivoice.AudioTranscriber
	ttsService  aivoice.TTSService
}

// NewAssistantStreamHandler cria o handler.
func NewAssistantStreamHandler(engine service.AssistantEngine) *AssistantStreamHandler {
	return &AssistantStreamHandler{engine: engine}
}

// SetTranscriber configura o transcritor Whisper para áudio.
func (h *AssistantStreamHandler) SetTranscriber(t aivoice.AudioTranscriber) {
	h.transcriber = t
}

// SetTTSService configura o serviço de síntese de voz (Gemini TTS + fallback neural) para respostas de áudio inline.
func (h *AssistantStreamHandler) SetTTSService(tts aivoice.TTSService) {
	h.ttsService = tts
}

// Chat lida com requisições síncronas REST.
func (h *AssistantStreamHandler) Chat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var req domain.UnifiedAssistantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}
	req.UserID = userID

	if h.engine == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "motor ADK v2 não configurado")
		return
	}
	resp, err := h.engine.Run(r.Context(), req)
	if err != nil {
		log.Printf("❌ [AssistantStreamHandler] Erro no motor ADK: %v", err)
		friendly := ai.FriendlyAIMessage(ai.ClassifyAIError(err))
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"reply":   friendly,
			"message": friendly,
			"text":    friendly,
			"error":   friendly,
		})
		return
	}

	httpx.WriteJSON(w, http.StatusOK, resp)
}

// Stream lida com Server-Sent Events (SSE) para streaming em tempo real no Mobile e Desktop.
func (h *AssistantStreamHandler) Stream(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		httpx.WriteJSONError(w, http.StatusInternalServerError, "streaming não suportado pelo servidor")
		return
	}

	var req domain.UnifiedAssistantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpx.WriteJSONError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}
	req.UserID = userID

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")
	flusher.Flush()

	onDelta := func(delta ai.StreamDelta) error {
		deltaBytes, err := json.Marshal(delta)
		if err != nil {
			return err
		}
		_, err = fmt.Fprintf(w, "data: %s\n\n", deltaBytes)
		if err != nil {
			return err
		}
		flusher.Flush()
		return nil
	}

	if h.engine == nil {
		_, _ = fmt.Fprintf(w, "event: error\ndata: motor ADK v2 não configurado\n\n")
		flusher.Flush()
		return
	}
	resp, err := h.engine.RunStream(r.Context(), req, onDelta)
	if err != nil {
		log.Printf("❌ [AssistantStreamHandler] Erro no stream: %v", err)
		_, _ = fmt.Fprintf(w, "event: error\ndata: %s\n\n", err.Error())
		flusher.Flush()
		return
	}

	finalBytes, _ := json.Marshal(resp)
	_, _ = fmt.Fprintf(w, "event: done\ndata: %s\n\n", finalBytes)
	flusher.Flush()
}

// Confirm executa a confirmação de uma ação pendente pelo ID.
func (h *AssistantStreamHandler) Confirm(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	var body struct {
		PendingID string `json:"pending_id"`
		Reject    bool   `json:"reject,omitempty"`
		Reason    string `json:"reason,omitempty"`
		ThreadID  string `json:"thread_id,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PendingID == "" {
		httpx.WriteJSONError(w, http.StatusBadRequest, "pending_id obrigatório")
		return
	}

	req := domain.UnifiedAssistantRequest{
		UserID:   userID,
		ThreadID: strings.TrimSpace(body.ThreadID),
		Message:  strings.TrimSpace(body.Reason),
	}
	if body.Reject {
		req.RejectPendingID = body.PendingID
		if req.Message == "" {
			req.Message = "cancelar"
		}
	} else {
		req.ConfirmPendingID = body.PendingID
	}

	if h.engine == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "motor ADK v2 não configurado")
		return
	}
	resp, err := h.engine.Run(r.Context(), req)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, err.Error())
		return
	}

	httpx.WriteJSON(w, http.StatusOK, resp)
}
