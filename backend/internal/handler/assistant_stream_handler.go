package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// AssistantStreamHandler expõe os endpoints unificados REST, SSE e multimodais para o Loop de Agente.
type AssistantStreamHandler struct {
	loop        *service.AgentLoop
	transcriber ai.AudioTranscriber
	ttsService  ai.TTSService
}

// NewAssistantStreamHandler cria o handler.
func NewAssistantStreamHandler(loop *service.AgentLoop) *AssistantStreamHandler {
	return &AssistantStreamHandler{loop: loop}
}

// SetTranscriber configura o transcritor Whisper para áudio.
func (h *AssistantStreamHandler) SetTranscriber(t ai.AudioTranscriber) {
	h.transcriber = t
}

// SetTTSService configura o serviço de síntese de voz (Gemini TTS + fallback neural) para respostas de áudio inline.
func (h *AssistantStreamHandler) SetTTSService(tts ai.TTSService) {
	h.ttsService = tts
}

// Chat lida com requisições síncronas REST.
func (h *AssistantStreamHandler) Chat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var req domain.UnifiedAssistantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
		return
	}
	req.UserID = userID

	resp, err := h.loop.Run(r.Context(), req)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// Stream lida com Server-Sent Events (SSE) para streaming em tempo real no Mobile e Desktop.
func (h *AssistantStreamHandler) Stream(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, `{"error":"streaming não suportado pelo servidor"}`, http.StatusInternalServerError)
		return
	}

	var req domain.UnifiedAssistantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
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

	resp, err := h.loop.RunStream(r.Context(), req, onDelta)
	if err != nil {
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
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	var body struct {
		PendingID string `json:"pending_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.PendingID == "" {
		http.Error(w, `{"error":"pending_id obrigatório"}`, http.StatusBadRequest)
		return
	}

	req := domain.UnifiedAssistantRequest{
		UserID:           userID,
		ConfirmPendingID: body.PendingID,
	}

	resp, err := h.loop.Run(r.Context(), req)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// AudioChat processa comandos de voz transcrevendo com Whisper e passando para o AgentLoop.
func (h *AssistantStreamHandler) AudioChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 25<<20)

	var fileBytes []byte
	var filename string
	var focusMode string
	var timezone string
	var currentLocalTime string
	var screenContext string
	var voice string
	includeTTS := true

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		var req struct {
			AudioB64         string `json:"audio_b64"`
			AudioMime        string `json:"audio_mime,omitempty"`
			Filename         string `json:"filename,omitempty"`
			FocusMode        string `json:"focus_mode,omitempty"`
			Timezone         string `json:"timezone,omitempty"`
			CurrentLocalTime string `json:"current_local_time,omitempty"`
			ScreenContext    string `json:"screen_context,omitempty"`
			Voice            string `json:"voice,omitempty"`
			IncludeTTS       *bool  `json:"include_tts,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
			return
		}
		if req.AudioB64 == "" {
			http.Error(w, `{"error":"campo 'audio_b64' obrigatório"}`, http.StatusBadRequest)
			return
		}
		decoded, err := base64.StdEncoding.DecodeString(req.AudioB64)
		if err != nil {
			http.Error(w, `{"error":"falha ao decodificar base64 do áudio"}`, http.StatusBadRequest)
			return
		}
		fileBytes = decoded
		filename = req.Filename
		if filename == "" {
			if strings.Contains(strings.ToLower(req.AudioMime), "wav") || (len(decoded) >= 4 && string(decoded[:4]) == "RIFF") {
				filename = "audio.wav"
			} else {
				filename = "audio.m4a"
			}
		}
		focusMode = req.FocusMode
		timezone = req.Timezone
		currentLocalTime = req.CurrentLocalTime
		screenContext = req.ScreenContext
		voice = req.Voice
		if req.IncludeTTS != nil {
			includeTTS = *req.IncludeTTS
		}
	} else {
		if err := r.ParseMultipartForm(25 << 20); err != nil {
			http.Error(w, `{"error":"falha ao processar formulário multipart"}`, http.StatusBadRequest)
			return
		}
		file, header, err := r.FormFile("audio")
		if err != nil {
			file, header, err = r.FormFile("file")
			if err != nil {
				http.Error(w, `{"error":"campo 'audio' ou 'file' ausente"}`, http.StatusBadRequest)
				return
			}
		}
		defer file.Close()
		readBytes, err := io.ReadAll(file)
		if err != nil {
			http.Error(w, `{"error":"falha ao ler áudio"}`, http.StatusBadRequest)
			return
		}
		fileBytes = readBytes
		filename = header.Filename
		if filename == "" || (!strings.HasSuffix(strings.ToLower(filename), ".wav") && len(readBytes) >= 4 && string(readBytes[:4]) == "RIFF") {
			filename = "audio.wav"
		}
		focusMode = r.FormValue("focus_mode")
		timezone = r.FormValue("timezone")
		currentLocalTime = r.FormValue("current_local_time")
		screenContext = r.FormValue("screen_context")
		voice = r.FormValue("voice")
		if rawTTS := strings.TrimSpace(r.FormValue("include_tts")); rawTTS == "false" || rawTTS == "0" {
			includeTTS = false
		}
	}

	var transcript string
	var err error
	if h.transcriber != nil {
		transcript, err = h.transcriber.Transcribe(r.Context(), bytes.NewReader(fileBytes), filename)
	} else {
		err = errors.New("transcritor de áudio não configurado")
	}

	if err != nil || strings.TrimSpace(transcript) == "" || strings.TrimSpace(transcript) == "." {
		transcript = "Mensagem de voz recebida. Por favor, analise as informações pendentes ou compromissos."
	}

	var quotedParts []string
	if strings.TrimSpace(currentLocalTime) != "" || strings.TrimSpace(timezone) != "" {
		quotedParts = append(quotedParts, fmt.Sprintf("[Data/Hora Local do Usuário: %s (%s)]", currentLocalTime, timezone))
	}
	if strings.TrimSpace(screenContext) != "" {
		quotedParts = append(quotedParts, fmt.Sprintf("[Contexto da Tela Visível do Usuário: %s]", screenContext))
	}

	unifiedReq := domain.UnifiedAssistantRequest{
		UserID:        userID,
		Channel:       "voice",
		Message:       transcript,
		FocusMode:     focusMode,
		QuotedContext: strings.Join(quotedParts, "\n"),
	}

	resp, err := h.loop.Run(r.Context(), unifiedReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusInternalServerError)
		return
	}

	var actions []map[string]any
	for _, c := range resp.Cards {
		actions = append(actions, map[string]any{
			"id":           c.ID,
			"type":         c.Type,
			"title":        c.Title,
			"subtitle":     c.Subtitle,
			"action_label": c.ActionLabel,
		})
	}

	result := map[string]any{
		"reply":                   resp.Text,
		"text":                    resp.Text,
		"message":                 resp.Text,
		"transcript":              transcript,
		"action_performed":        "VOICE_INPUT_PROCESSED",
		"thread_id":               resp.ThreadID,
		"turn_id":                 resp.TurnID,
		"cards":                   resp.Cards,
		"actions":                 actions,
		"sources":                 resp.Sources,
		"suggested_actions":       resp.SuggestedActions,
		"requires_confirmation":   resp.RequiresConfirmation,
		"pending_confirmation_id": resp.PendingConfirmationID,
	}

	if includeTTS && h.ttsService != nil && strings.TrimSpace(resp.Text) != "" {
		speechText := ai.StripMarkdownForSpeech(resp.Text)
		if speechText != "" {
			if audioBytes, audioMime, ttsErr := h.ttsService.Synthesize(r.Context(), speechText, voice); ttsErr == nil && len(audioBytes) > 0 {
				result["tts_audio_b64"] = base64.StdEncoding.EncodeToString(audioBytes)
				result["tts_audio_mime"] = audioMime
			}
		}
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}

// VisionChat processa imagens através do AgentLoop com visão multimodal.
func (h *AssistantStreamHandler) VisionChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 15<<20)

	var imgB64 string
	var mime string
	var prompt string

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		var req struct {
			ImageB64 string `json:"image_b64"`
			MimeType string `json:"mime_type,omitempty"`
			Prompt   string `json:"prompt,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
			return
		}
		imgB64 = req.ImageB64
		mime = req.MimeType
		prompt = req.Prompt
	} else {
		if err := r.ParseMultipartForm(15 << 20); err != nil {
			http.Error(w, `{"error":"falha ao processar formulário multipart"}`, http.StatusBadRequest)
			return
		}
		file, header, err := r.FormFile("image")
		if err != nil {
			file, header, err = r.FormFile("file")
			if err != nil {
				http.Error(w, `{"error":"campo 'image' ou 'file' ausente"}`, http.StatusBadRequest)
				return
			}
		}
		defer file.Close()
		readBytes, err := io.ReadAll(file)
		if err != nil {
			http.Error(w, `{"error":"falha ao ler imagem"}`, http.StatusBadRequest)
			return
		}
		imgB64 = base64.StdEncoding.EncodeToString(readBytes)
		mime = header.Header.Get("Content-Type")
		prompt = r.FormValue("prompt")
	}

	if prompt == "" {
		prompt = "Analise esta imagem e extraia quaisquer dados relevantes, comprovantes ou tarefas."
	}

	unifiedReq := domain.UnifiedAssistantRequest{
		UserID:    userID,
		Channel:   "app_mobile",
		Message:   prompt,
		ImageB64:  imgB64,
		ImageMime: mime,
	}

	resp, err := h.loop.Run(r.Context(), unifiedReq)
	if err != nil {
		http.Error(w, fmt.Sprintf(`{"error":%q}`, err.Error()), http.StatusInternalServerError)
		return
	}

	result := map[string]any{
		"reply":                   resp.Text,
		"text":                    resp.Text,
		"message":                 resp.Text,
		"action_performed":        "VISION_ANALYZED",
		"thread_id":               resp.ThreadID,
		"turn_id":                 resp.TurnID,
		"cards":                   resp.Cards,
		"sources":                 resp.Sources,
		"suggested_actions":       resp.SuggestedActions,
		"requires_confirmation":   resp.RequiresConfirmation,
		"pending_confirmation_id": resp.PendingConfirmationID,
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}
