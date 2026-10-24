package handler

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

type AssistantHandler struct {
	astSvc      *service.AssistantService
	transcriber ai.AudioTranscriber
	contextSvc  *service.WhatsAppContextService
}

func NewAssistantHandler(astSvc *service.AssistantService, transcriber ai.AudioTranscriber) *AssistantHandler {
	return &AssistantHandler{
		astSvc:      astSvc,
		transcriber: transcriber,
	}
}

// SetContextService injeta o contexto conversacional do WhatsApp.
//
// O app e o desktop também se beneficiam do shadow inbox: a resposta é vista
// apenas pelo próprio usuário, então o escopo "Todos os meus chats" pode ser
// aplicado com segurança nessas surfaces (no WhatsApp ele é restrito a
// conversas pessoais, porque a resposta seria entregue a terceiros).
func (h *AssistantHandler) SetContextService(contextSvc *service.WhatsAppContextService) {
	h.contextSvc = contextSvc
}

// whatsappWindow monta a janela de contexto do WhatsApp para as surfaces do
// app/desktop. Falha de leitura nunca impede a resposta (fail-open).
func (h *AssistantHandler) whatsappWindow(ctx context.Context, userID, currentText string) []ai.ChatMessageContext {
	if h.contextSvc == nil {
		return nil
	}
	return h.contextSvc.SelfWindow(ctx, userID, currentText)
}

type ChatMessagePayload struct {
	Sender string `json:"sender"`
	Text   string `json:"text"`
}

func convertHistory(history []ChatMessagePayload) []ai.ChatMessageContext {
	var convHistory []ai.ChatMessageContext
	for _, h := range history {
		if strings.TrimSpace(h.Text) != "" {
			convHistory = append(convHistory, ai.ChatMessageContext{
				Sender: h.Sender,
				Text:   h.Text,
			})
		}
	}
	return convHistory
}

type assistantChatRequest struct {
	Text             string               `json:"text,omitempty"`
	Prompt           string               `json:"prompt,omitempty"`
	AudioB64         string               `json:"audio_b64,omitempty"`
	AudioMime        string               `json:"audio_mime,omitempty"`
	ImageB64         string               `json:"image_b64,omitempty"`
	Timezone         string               `json:"timezone,omitempty"`
	CurrentLocalTime string               `json:"current_local_time,omitempty"`
	History          []ChatMessagePayload `json:"history,omitempty"`
	FocusMode        string               `json:"focus_mode,omitempty"`
}

func parseClientNow(rawTime, tz string) (time.Time, string) {
	if tz == "" || tz == "UTC" || tz == "Etc/UTC" {
		tz = "America/Sao_Paulo"
	}
	if rawTime != "" {
		layouts := []string{
			time.RFC3339Nano,
			time.RFC3339,
			"2006-01-02T15:04:05-07:00",
			"2006-01-02T15:04:05Z",
			"2006-01-02T15:04:05",
		}
		for _, layout := range layouts {
			if t, err := time.Parse(layout, rawTime); err == nil {
				return t, tz
			}
		}
	}
	return time.Now().UTC(), tz
}

func (h *AssistantHandler) Chat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 15<<20) // 15MB
	var req assistantChatRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			http.Error(w, `{"error":"payload excede o limite máximo permitido (15MB)"}`, http.StatusRequestEntityTooLarge)
			return
		}
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

	nowRef, tz := parseClientNow(req.CurrentLocalTime, req.Timezone)
	convHistory := convertHistory(req.History)

	input := ai.UserInput{
		Text:                 rawText,
		AudioB64:             req.AudioB64,
		AudioMime:            req.AudioMime,
		ImageB64:             req.ImageB64,
		Timezone:             tz,
		Now:                  nowRef,
		ConversationHistory:  convHistory,
		ConversationWindow:   h.whatsappWindow(r.Context(), userID, rawText),
		WhatsAppPrivateScope: true, // o chat do app e do desktop e privado
		FocusMode:            req.FocusMode,
	}

	resp, err := h.astSvc.Process(r.Context(), userID, input)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("❌ [Assistant] falha ao processar comando (user=%s): %v", userID, err)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": ai.FriendlyAIMessage(ai.ClassifyAIError(err))})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// AudioChat processa um arquivo de áudio enviado via multipart/form-data ou payload JSON com audio_b64.
// Transcreve com Whisper e processa o comando, aplicando fallback para áudio nativo se necessário.
func (h *AssistantHandler) AudioChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 25<<20) // 25MB

	var fileBytes []byte

	var filename string
	var mime string
	var clientTime string
	var tzVal string
	var historyPayload []ChatMessagePayload
	var focusMode string

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		var req struct {
			AudioB64         string               `json:"audio_b64"`
			AudioMime        string               `json:"audio_mime,omitempty"`
			Filename         string               `json:"filename,omitempty"`
			Timezone         string               `json:"timezone,omitempty"`
			CurrentLocalTime string               `json:"current_local_time,omitempty"`
			History          []ChatMessagePayload `json:"history,omitempty"`
			FocusMode        string               `json:"focus_mode,omitempty"`
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
			http.Error(w, `{"error":"falha ao decodificar base64 do áudio: `+err.Error()+`"}`, http.StatusBadRequest)
			return
		}
		fileBytes = decoded
		filename = req.Filename
		if filename == "" {
			filename = "audio.m4a"
		}
		mime = req.AudioMime
		clientTime = req.CurrentLocalTime
		tzVal = req.Timezone
		historyPayload = req.History
		focusMode = req.FocusMode
	} else {
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

		readBytes, err := io.ReadAll(file)
		if err != nil {
			http.Error(w, `{"error":"falha ao ler arquivo de áudio: `+err.Error()+`"}`, http.StatusBadRequest)
			return
		}
		fileBytes = readBytes
		filename = header.Filename
		mime = header.Header.Get("Content-Type")
		clientTime = r.FormValue("current_local_time")
		tzVal = r.FormValue("timezone")
		focusMode = r.FormValue("focus_mode")
		if rawHist := r.FormValue("history"); rawHist != "" {
			_ = json.Unmarshal([]byte(rawHist), &historyPayload)
		}
	}

	var transcript string
	var err error
	var input ai.UserInput
	if h.transcriber != nil {
		transcript, err = h.transcriber.Transcribe(r.Context(), bytes.NewReader(fileBytes), filename)
	} else {
		err = errors.New("transcritor Whisper não configurado")
	}

	nowRef, tz := parseClientNow(clientTime, tzVal)
	convHistory := convertHistory(historyPayload)

	if err != nil || strings.TrimSpace(transcript) == "" || strings.TrimSpace(transcript) == "." {
		if err != nil {
			log.Printf("⚠️ [AudioChat] Transcrição Whisper falhou (%v). Acionando fallback para áudio nativo...", err)
		} else {
			log.Println("⚠️ [AudioChat] Transcrição Whisper retornou vazia. Acionando fallback para áudio nativo...")
		}
		if mime == "" {
			mime = "audio/m4a"
		}
		input = ai.UserInput{
			Text:                "Ouça atentamente esta mensagem de voz e extraia compromissos para a agenda ou tarefas a realizar.",
			AudioB64:            base64.StdEncoding.EncodeToString(fileBytes),
			AudioMime:           mime,
			Timezone:            tz,
			Now:                 nowRef,
			ConversationHistory: convHistory,
			FocusMode:           focusMode,
		}
	} else {
		input = ai.UserInput{
			Text:                transcript,
			Timezone:            tz,
			Now:                 nowRef,
			ConversationHistory: convHistory,
			FocusMode:           focusMode,
		}
	}
	input.ConversationWindow = h.whatsappWindow(r.Context(), userID, input.Text)
	input.WhatsAppPrivateScope = true

	resp, err := h.astSvc.Process(r.Context(), userID, input)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("❌ [AudioChat] falha ao processar comando (user=%s): %v", userID, err)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": ai.FriendlyAIMessage(ai.ClassifyAIError(err)), "transcript": transcript})
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

// VisionChat processa upload de imagem (recibos, fotos de documentos ou anotações) via multipart/form-data ou JSON com image_b64.
func (h *AssistantHandler) VisionChat(w http.ResponseWriter, r *http.Request) {
	userID, ok := middleware.UserIDFromContext(r.Context())
	if !ok {
		http.Error(w, `{"error":"não autorizado"}`, http.StatusUnauthorized)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, 25<<20) // 25MB

	var imageB64 string
	var mime string
	var prompt string
	var clientTime string
	var tzVal string
	var historyPayload []ChatMessagePayload
	var focusMode string

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "application/json") {
		var req struct {
			ImageB64         string               `json:"image_b64"`
			ImageMime        string               `json:"image_mime,omitempty"`
			Prompt           string               `json:"prompt,omitempty"`
			Text             string               `json:"text,omitempty"`
			Timezone         string               `json:"timezone,omitempty"`
			CurrentLocalTime string               `json:"current_local_time,omitempty"`
			History          []ChatMessagePayload `json:"history,omitempty"`
			FocusMode        string               `json:"focus_mode,omitempty"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, `{"error":"payload JSON inválido"}`, http.StatusBadRequest)
			return
		}
		if req.ImageB64 == "" {
			http.Error(w, `{"error":"campo 'image_b64' obrigatório"}`, http.StatusBadRequest)
			return
		}
		imageB64 = req.ImageB64
		mime = req.ImageMime
		if mime == "" {
			mime = "image/jpeg"
		}
		prompt = req.Prompt
		if prompt == "" {
			prompt = req.Text
		}
		clientTime = req.CurrentLocalTime
		tzVal = req.Timezone
		historyPayload = req.History
		focusMode = req.FocusMode
	} else {
		// Limite de 15MB para upload de imagem multipart
		if err := r.ParseMultipartForm(15 << 20); err != nil {
			http.Error(w, `{"error":"falha ao processar formulário multipart: `+err.Error()+`"}`, http.StatusBadRequest)
			return
		}

		file, header, err := r.FormFile("image")
		if err != nil {
			file, header, err = r.FormFile("file")
			if err != nil {
				http.Error(w, `{"error":"campo 'image' ou 'file' não encontrado"}`, http.StatusBadRequest)
				return
			}
		}
		defer file.Close()

		fileBytes, err := io.ReadAll(file)
		if err != nil {
			http.Error(w, `{"error":"falha ao ler bytes da imagem"}`, http.StatusBadRequest)
			return
		}

		mime = header.Header.Get("Content-Type")
		if mime == "" {
			mime = http.DetectContentType(fileBytes)
		}
		imageB64 = base64.StdEncoding.EncodeToString(fileBytes)
		prompt = r.FormValue("prompt")
		if prompt == "" {
			prompt = r.FormValue("text")
		}
		clientTime = r.FormValue("current_local_time")
		tzVal = r.FormValue("timezone")
		focusMode = r.FormValue("focus_mode")
		if rawHist := r.FormValue("history"); rawHist != "" {
			_ = json.Unmarshal([]byte(rawHist), &historyPayload)
		}
	}

	if prompt == "" {
		prompt = "Analise esta imagem e extraia eventos para a agenda ou tarefas a realizar."
	}

	// Normaliza a imagem: mime real (o app mandava "image/jpeg" fixo, mesmo para
	// PNG/WEBP/HEIC) e tamanho (fotos de celular viravam payload de vários MB).
	preparedB64, preparedMime, err := ai.PrepareImage(imageB64, mime)
	if err != nil {
		log.Printf("❌ [Assistant] imagem inválida (user=%s): %v", userID, err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": "Não consegui ler esta imagem. Envie um arquivo de imagem válido (JPG, PNG ou WEBP)."})
		return
	}
	imageB64 = preparedB64
	mime = preparedMime

	nowRef, tzVision := parseClientNow(clientTime, tzVal)

	input := ai.UserInput{
		Text:                prompt,
		ImageB64:            imageB64,
		ImageMime:           mime,
		Timezone:            tzVision,
		Now:                 nowRef,
		ConversationHistory: convertHistory(historyPayload),
		FocusMode:           focusMode,
	}
	input.ConversationWindow = h.whatsappWindow(r.Context(), userID, prompt)
	input.WhatsAppPrivateScope = true

	resp, err := h.astSvc.Process(r.Context(), userID, input)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		log.Printf("❌ [Assistant] falha ao processar comando (user=%s): %v", userID, err)
		_ = json.NewEncoder(w).Encode(map[string]string{"error": ai.FriendlyAIMessage(ai.ClassifyAIError(err))})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}
