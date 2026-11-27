package handler

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/ai"
	aivoice "github.com/andrevmp/vito/backend/internal/ai/voice"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
)

// AudioChat processa comandos de voz transcrevendo com Whisper e passando para o motor ADK v2.
func (h *AssistantStreamHandler) AudioChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, middleware.MediaBodyLimitBytes)

	var fileBytes []byte
	var filename string
	var focusMode string
	var timezone string
	var currentLocalTime string
	var screenContext string
	var voice string
	var threadID string
	channel := "voice"
	includeTTS := true

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		var req struct {
			ThreadID         string `json:"thread_id,omitempty"`
			Channel          string `json:"channel,omitempty"`
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
			httpx.WriteJSONError(w, http.StatusBadRequest, "payload JSON inválido")
			return
		}
		if req.AudioB64 == "" {
			httpx.WriteJSONError(w, http.StatusBadRequest, "campo 'audio_b64' obrigatório")
			return
		}
		decoded, err := base64.StdEncoding.DecodeString(req.AudioB64)
		if err != nil {
			httpx.WriteJSONError(w, http.StatusBadRequest, "falha ao decodificar base64 do áudio")
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
		threadID = strings.TrimSpace(req.ThreadID)
		if c := strings.TrimSpace(req.Channel); c != "" {
			channel = c
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
			httpx.WriteJSONError(w, http.StatusBadRequest, "falha ao processar formulário multipart")
			return
		}
		file, header, err := r.FormFile("audio")
		if err != nil {
			file, header, err = r.FormFile("file")
			if err != nil {
				httpx.WriteJSONError(w, http.StatusBadRequest, "campo 'audio' ou 'file' ausente")
				return
			}
		}
		defer file.Close()
		readBytes, err := io.ReadAll(file)
		if err != nil {
			httpx.WriteJSONError(w, http.StatusBadRequest, "falha ao ler áudio")
			return
		}
		fileBytes = readBytes
		filename = header.Filename
		if filename == "" || (!strings.HasSuffix(strings.ToLower(filename), ".wav") && len(readBytes) >= 4 && string(readBytes[:4]) == "RIFF") {
			filename = "audio.wav"
		}
		threadID = strings.TrimSpace(r.FormValue("thread_id"))
		if c := strings.TrimSpace(r.FormValue("channel")); c != "" {
			channel = c
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

	// Isolamento estrito de contexto em modo voz: se nenhum thread_id foi enviado, gera um UUID isolado
	if threadID == "" {
		threadID = uuid.New().String()
	}

	var transcript string
	var err error
	if h.transcriber != nil {
		transcript, err = h.transcriber.Transcribe(r.Context(), bytes.NewReader(fileBytes), filename)
	} else {
		err = errors.New("transcritor de áudio não configurado")
	}

	trimmedTranscript := strings.TrimSpace(transcript)
	if err != nil || trimmedTranscript == "" || trimmedTranscript == "." {
		msg := "Não consegui captar sua voz com clareza. Pode falar de novo?"
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"reply":      msg,
			"message":    msg,
			"text":       msg,
			"transcript": "",
			"actions":    []any{},
		})
		return
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
		ThreadID:      threadID,
		Channel:       channel,
		Message:       transcript,
		FocusMode:     focusMode,
		QuotedContext: strings.Join(quotedParts, "\n"),
	}

	if h.engine == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "motor ADK v2 não configurado")
		return
	}
	resp, err := h.engine.Run(r.Context(), unifiedReq)
	if err != nil {
		log.Printf("❌ [AssistantStreamHandler] Erro no AudioChat: %v", err)
		friendly := ai.FriendlyAIMessage(ai.ClassifyAIError(err))
		httpx.WriteJSON(w, http.StatusOK, map[string]any{
			"reply":      friendly,
			"message":    friendly,
			"text":       friendly,
			"transcript": transcript,
			"actions":    []any{},
		})
		return
	}

	// Sanitiza formatação markdown para canal de voz, eliminando asteriscos e títulos das legendas
	cleanReplyText := resp.Text
	if strings.Contains(strings.ToLower(channel), "voice") {
		cleanReplyText = aivoice.StripMarkdownForSpeech(resp.Text)
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
		"reply":                   cleanReplyText,
		"text":                    cleanReplyText,
		"message":                 cleanReplyText,
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
	enrichAssistantEntityFields(result, resp)

	if includeTTS && h.ttsService != nil && strings.TrimSpace(cleanReplyText) != "" {
		speechText := aivoice.StripMarkdownForSpeech(cleanReplyText)
		if speechText != "" {
			if audioBytes, audioMime, ttsErr := h.ttsService.Synthesize(r.Context(), speechText, voice); ttsErr == nil && len(audioBytes) > 0 {
				result["tts_audio_b64"] = base64.StdEncoding.EncodeToString(audioBytes)
				result["tts_audio_mime"] = audioMime
			} else if ttsErr != nil {
				log.Printf("⚠️ [AssistantStreamHandler] Falha na síntese TTS inline (voz=%s): %v", voice, ttsErr)
			}
		}
	}

	httpx.WriteJSON(w, http.StatusOK, result)
}

// VisionChat processa imagens através do motor ADK v2 com visão multimodal.
func (h *AssistantStreamHandler) VisionChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok || userID == "" {
		httpx.WriteJSONError(w, http.StatusUnauthorized, "não autorizado")
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 15<<20)

	var imgB64 string
	var mime string
	var prompt string
	var threadID string

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		var req struct {
			ThreadID  string `json:"thread_id,omitempty"`
			ImageB64  string `json:"image_b64"`
			MimeType  string `json:"mime_type,omitempty"`
			ImageMime string `json:"image_mime,omitempty"`
			Prompt    string `json:"prompt,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			httpx.WriteJSONError(w, http.StatusBadRequest, "payload JSON inválido")
			return
		}
		threadID = strings.TrimSpace(req.ThreadID)
		imgB64 = req.ImageB64
		mime = req.MimeType
		if mime == "" {
			mime = req.ImageMime
		}
		prompt = req.Prompt
	} else {
		if err := r.ParseMultipartForm(15 << 20); err != nil {
			httpx.WriteJSONError(w, http.StatusBadRequest, "falha ao processar formulário multipart")
			return
		}
		file, header, err := r.FormFile("image")
		if err != nil {
			file, header, err = r.FormFile("file")
			if err != nil {
				httpx.WriteJSONError(w, http.StatusBadRequest, "campo 'image' ou 'file' ausente")
				return
			}
		}
		defer file.Close()
		readBytes, err := io.ReadAll(file)
		if err != nil {
			httpx.WriteJSONError(w, http.StatusBadRequest, "falha ao ler imagem")
			return
		}
		imgB64 = base64.StdEncoding.EncodeToString(readBytes)
		mime = header.Header.Get("Content-Type")
		prompt = r.FormValue("prompt")
		threadID = strings.TrimSpace(r.FormValue("thread_id"))
	}

	if prompt == "" {
		prompt = "Analise esta imagem e extraia quaisquer dados relevantes, comprovantes ou tarefas."
	}

	unifiedReq := domain.UnifiedAssistantRequest{
		UserID:    userID,
		ThreadID:  threadID,
		Channel:   "app_mobile",
		Message:   prompt,
		ImageB64:  imgB64,
		ImageMime: mime,
	}

	if h.engine == nil {
		httpx.WriteJSONError(w, http.StatusServiceUnavailable, "motor ADK v2 não configurado")
		return
	}
	resp, err := h.engine.Run(r.Context(), unifiedReq)
	if err != nil {
		httpx.WriteJSONError(w, http.StatusInternalServerError, err.Error())
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
	enrichAssistantEntityFields(result, resp)

	httpx.WriteJSON(w, http.StatusOK, result)
}

func enrichAssistantEntityFields(result map[string]any, resp *domain.UnifiedAssistantResponse) {
	if result == nil || resp == nil {
		return
	}
	if resp.Event != nil {
		result["event"] = resp.Event
	}
	if resp.Conflict != nil {
		result["conflict"] = resp.Conflict
	}
	if resp.Todo != nil {
		result["todo"] = resp.Todo
	}
	if resp.Trigger != nil {
		result["trigger"] = resp.Trigger
	}
	if resp.Pending != nil {
		result["pending"] = resp.Pending
	}
	if resp.Booking != nil {
		result["booking"] = resp.Booking
		result["booking_url"] = resp.BookingURL
		result["booking_short_url"] = resp.BookingShortURL
	}
	if resp.Meeting != nil {
		result["meeting"] = resp.Meeting
		result["meeting_url"] = resp.MeetingURL
		result["meeting_short_url"] = resp.MeetingShortURL
	}
	if resp.WhatsAppMessage != nil {
		result["whatsapp_message"] = resp.WhatsAppMessage
	}
	if resp.GmailMessage != nil {
		result["gmail_message"] = resp.GmailMessage
	}
	if resp.ModelUsed != "" {
		result["model_used"] = resp.ModelUsed
	}
	if resp.FallbackNotice != "" {
		result["fallback_notice"] = resp.FallbackNotice
	}
}
