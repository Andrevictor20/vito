package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// transcribeAudio baixa o áudio da Evolution API e transcreve com o Whisper.
func (s *WhatsAppService) transcribeAudio(ctx context.Context, instanceName string, data json.RawMessage) string {
	b64, err := s.client.GetMediaBase64(ctx, instanceName, data)
	if err != nil || b64 == "" {
		return ""
	}
	audioBytes, decodeErr := base64.StdEncoding.DecodeString(b64)
	if decodeErr != nil || len(audioBytes) == 0 {
		return ""
	}
	transcribed, trErr := s.audioTranscriber.Transcribe(ctx, bytes.NewReader(audioBytes), "audio.ogg")
	if trErr != nil {
		return ""
	}
	return strings.TrimSpace(transcribed)
}

// archiveMessage persiste a mensagem no shadow inbox (idempotente por id).
func (s *WhatsAppService) archiveMessage(ctx context.Context, userID, instanceName string, msg *inboundMessage, chatKind, text, senderRole string) {
	if s.contextSvc == nil || msg.MessageID == "" || userID == "" {
		return
	}
	timestamp := msg.Timestamp
	if timestamp.IsZero() {
		timestamp = time.Now().UTC()
	}
	fromMe := msg.FromMe
	kind := messageKind(msg)
	if senderRole == "vito" {
		fromMe = true
		kind = messageKindVito
	}

	// Mídia: o tipo, o mime e o envelope de download (a Evolution precisa dele
	// para devolver a mídia quando o Vito for enricher a mensagem).
	mediaKind := ""
	mediaMime := ""
	mediaStatus := domain.WhatsAppMediaStatusNone
	mediaPayload := ""
	switch {
	case msg.IsImage:
		mediaKind = domain.WhatsAppMediaKindImage
		mediaMime = msg.ImageMime
	case msg.IsAudio:
		mediaKind = domain.WhatsAppMediaKindAudio
	}
	if mediaKind != "" {
		if raw, ok := msg.MediaPayload.(json.RawMessage); ok {
			mediaPayload = string(raw)
		}
		if mediaPayload != "" {
			mediaStatus = domain.WhatsAppMediaStatusPending
		}
	}

	entry := &domain.WhatsAppConversationMessage{
		ID:               msg.MessageID,
		UserID:           userID,
		InstanceName:     instanceName,
		ChatJID:          msg.RemoteJID,
		ChatKind:         chatKind,
		ChatLabel:        s.resolveChatLabel(chatKind, msg),
		SenderJID:        firstNonEmpty(msg.Participant, msg.RemoteJID),
		SenderName:       msg.PushName,
		FromMe:           fromMe,
		Kind:             kind,
		Text:             text,
		QuotedText:       strings.TrimSpace(msg.QuotedText),
		QuotedID:         strings.TrimSpace(msg.QuotedID),
		MediaKind:        mediaKind,
		MediaMime:        mediaMime,
		MediaStatus:      mediaStatus,
		MediaPayload:     mediaPayload,
		MessageTimestamp: timestamp,
		CreatedAt:        time.Now().UTC(),
	}
	if err := s.contextSvc.Archive(ctx, entry); err != nil {
		log.Printf("⚠️ [WhatsAppService] falha ao arquivar mensagem: %v", err)
	}
}

// buildContext monta a mensagem citada e a janela de contexto do WhatsApp.
func (s *WhatsAppService) buildContext(ctx context.Context, userID string, msg *inboundMessage, chatKind, text string) (string, []ai.ChatMessageContext) {
	if s.contextSvc == nil {
		return "", nil
	}
	settings, err := s.contextSvc.Settings(ctx, userID)
	if err != nil {
		return "", nil
	}
	quoted := ""
	if settings.Scope != domain.WhatsAppContextScopeOff {
		quoted = s.resolveQuoted(ctx, userID, msg)
	}
	window := s.contextSvc.Window(ctx, userID, msg.RemoteJID, chatKind, text, msg.MessageID)
	return quoted, window
}

// resolveQuoted resolve a mensagem marcada ("responder a esta mensagem").
func (s *WhatsAppService) resolveQuoted(ctx context.Context, userID string, msg *inboundMessage) string {
	if msg == nil {
		return ""
	}
	if s.contextSvc != nil && msg.QuotedID != "" {
		if archived, err := s.contextSvc.MessageByID(ctx, userID, msg.QuotedID); err == nil && archived != nil {
			if text := quotedTextOf(archived); text != "" {
				return text
			}
		}
	}
	return strings.TrimSpace(msg.QuotedText)
}

// resolveChatLabel define o rótulo do chat exibido no contexto (ex.: "Você", "Família", "Ana").
func (s *WhatsAppService) resolveChatLabel(chatKind string, msg *inboundMessage) string {
	switch chatKind {
	case domain.WhatsAppChatKindSelf:
		return "Você"
	case domain.WhatsAppChatKindSelfGroup, domain.WhatsAppChatKindGroup:
		if s.groupMeta != nil {
			if subject := s.groupMeta.Subject(msg.RemoteJID); subject != "" {
				return subject
			}
		}
		return "Grupo"
	default:
		if s.contactsCache != nil {
			if name := s.contactsCache.Name(msg.RemoteJID); name != "" {
				s.labelsMu.Lock()
				if s.chatLabels == nil {
					s.chatLabels = make(map[string]string)
				}
				s.chatLabels[msg.RemoteJID] = name
				s.labelsMu.Unlock()
				return name
			}
		}
		s.labelsMu.Lock()
		defer s.labelsMu.Unlock()
		if s.chatLabels == nil {
			s.chatLabels = make(map[string]string)
		}
		if !msg.FromMe && strings.TrimSpace(msg.PushName) != "" {
			s.chatLabels[msg.RemoteJID] = msg.PushName
			s.contactsCache.SetProfile(msg.RemoteJID, msg.PushName)
		}
		if label, ok := s.chatLabels[msg.RemoteJID]; ok {
			return label
		}
		return "Contato"
	}
}

// messageKind classifica o tipo da mensagem arquivada.
func messageKind(msg *inboundMessage) string {
	switch {
	case msg.IsAudio:
		return "audio"
	case strings.Contains(strings.ToLower(msg.MessageType), "image"):
		return "image"
	case strings.TrimSpace(msg.Text) != "":
		return "text"
	default:
		return "other"
	}
}

// WhatsAppMessageSender envia uma mensagem do WhatsApp em nome do usuário.
type WhatsAppMessageSender interface {
	SendWhatsAppMessage(ctx context.Context, userID, chatJID, text string) error
}

// SendWhatsAppMessage envia uma mensagem a uma conversa, em nome do usuário.
func (s *WhatsAppService) SendWhatsAppMessage(ctx context.Context, userID, chatJID, text string) error {
	if strings.TrimSpace(chatJID) == "" || strings.TrimSpace(text) == "" {
		return fmt.Errorf("conversa e texto são obrigatórios")
	}
	integration, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return err
	}
	if integration == nil || integration.Status != domain.WhatsAppStatusConnected {
		return fmt.Errorf("WhatsApp não está conectado")
	}
	return s.client.SendText(ctx, integration.InstanceName, chatJID, text)
}

// markOutboundReply registra uma resposta gerada pelo Vito para evitar loops de reprocessamento.
func (s *WhatsAppService) markOutboundReply(text string) {
	if s == nil {
		return
	}
	s.outboundMu.Lock()
	defer s.outboundMu.Unlock()
	if s.recentOutboundTexts == nil {
		s.recentOutboundTexts = make(map[string]time.Time)
	}
	now := time.Now()
	for k, exp := range s.recentOutboundTexts {
		if now.Sub(exp) > 2*time.Minute {
			delete(s.recentOutboundTexts, k)
		}
	}
	trimmed := strings.TrimSpace(text)
	if trimmed != "" {
		s.recentOutboundTexts[trimmed] = now
	}
}

// isOutboundReply verifica se a mensagem foi originada recentemente pelo próprio Vito.
func (s *WhatsAppService) isOutboundReply(text string) bool {
	if s == nil {
		return false
	}
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return false
	}
	s.outboundMu.Lock()
	defer s.outboundMu.Unlock()
	if s.recentOutboundTexts == nil {
		return false
	}
	now := time.Now()
	if t, ok := s.recentOutboundTexts[trimmed]; ok {
		if now.Sub(t) <= 2*time.Minute {
			return true
		}
		delete(s.recentOutboundTexts, trimmed)
	}
	return false
}

// markMessageIDProcessed registra o ID de mensagem para evitar reprocessamento em caso de webhooks duplicados.
func (s *WhatsAppService) markMessageIDProcessed(id string) {
	if s == nil || id == "" {
		return
	}
	s.outboundMu.Lock()
	defer s.outboundMu.Unlock()
	if s.processedMsgIDs == nil {
		s.processedMsgIDs = make(map[string]time.Time)
	}
	now := time.Now()
	for k, exp := range s.processedMsgIDs {
		if now.Sub(exp) > 5*time.Minute {
			delete(s.processedMsgIDs, k)
		}
	}
	s.processedMsgIDs[id] = now
}

// isMessageIDProcessed verifica se a mensagem já foi processada recentemente.
func (s *WhatsAppService) isMessageIDProcessed(id string) bool {
	if s == nil || id == "" {
		return false
	}
	s.outboundMu.Lock()
	defer s.outboundMu.Unlock()
	if s.processedMsgIDs == nil {
		return false
	}
	if t, ok := s.processedMsgIDs[id]; ok {
		if time.Since(t) <= 5*time.Minute {
			return true
		}
		delete(s.processedMsgIDs, id)
	}
	return false
}
