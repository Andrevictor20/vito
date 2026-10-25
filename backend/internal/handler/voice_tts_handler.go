package handler

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

// VoiceTTSHandler processa requisições de síntese de fala (TTS).
type VoiceTTSHandler struct {
	ttsSvc ai.TTSService
}

// NewVoiceTTSHandler cria uma nova instância do handler.
func NewVoiceTTSHandler(ttsSvc ai.TTSService) *VoiceTTSHandler {
	return &VoiceTTSHandler{ttsSvc: ttsSvc}
}

// ttsRequest representa o corpo da requisição de TTS.
type ttsRequest struct {
	Text  string `json:"text"`
	Voice string `json:"voice,omitempty"`
}

// ttsResponse representa a resposta de síntese de fala.
type ttsResponse struct {
	AudioB64 string `json:"audio_b64"`
	Mime     string `json:"mime"`
	Voice    string `json:"voice"`
}

const (
	// maxTTSRequestBody é o limite de corpo da requisição TTS (só texto).
	maxTTSRequestBody = 15 * 1024 // 15 KB
	// maxTTSChars é o limite de caracteres por síntese de áudio.
	maxTTSChars = 2000
)

// HandleTTS sintetiza texto em áudio e retorna base64 para reprodução no cliente.
func (h *VoiceTTSHandler) HandleTTS(w http.ResponseWriter, r *http.Request) {
	_, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "não autorizado"})
		return
	}

	if r.Body == nil {
		writeTTSError(w, http.StatusBadRequest, "corpo da requisição vazio")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxTTSRequestBody)

	var req ttsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeTTSError(w, http.StatusBadRequest, "payload JSON inválido")
		return
	}

	text := strings.TrimSpace(req.Text)
	if text == "" {
		writeTTSError(w, http.StatusBadRequest, "texto não pode ser vazio")
		return
	}
	if len(text) > maxTTSChars {
		writeTTSError(w, http.StatusBadRequest, "texto excede o limite de 2000 caracteres")
		return
	}

	audio, mime, err := h.ttsSvc.Synthesize(r.Context(), text, req.Voice)
	if err != nil {
		writeTTSError(w, http.StatusBadGateway, "serviço de síntese de fala indisponível no momento")
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(ttsResponse{
		AudioB64: base64.StdEncoding.EncodeToString(audio),
		Mime:     mime,
		Voice:    req.Voice,
	})
}

func writeTTSError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
