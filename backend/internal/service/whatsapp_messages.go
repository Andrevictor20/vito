package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// reVitoTrigger detecta menções explícitas ao Vito nas mensagens.
var reVitoTrigger = regexp.MustCompile(`(?i)(@vito|!vito|/vito|vito:)\s*`)

// handleMessagesEvent processa um evento `messages.upsert` da Evolution API.
//
// Fluxo (SPEC §5):
//  1. parse da mensagem e transcrição de áudio (Groq Whisper)
//  2. classificação do chat (self | self_group | group | direct)
//  3. arquivamento no shadow inbox — SEMPRE, mesmo em mensagens que não acionam o Vito
//  4. decisão de resposta conforme o gatilho do tipo de chat
//  5. montagem do contexto (mensagem citada + janela) e chamada ao assistente
func (s *WhatsAppService) handleMessagesEvent(ctx context.Context, instanceName string, data json.RawMessage) error {
	msg, err := parseInboundMessage(data)
	if err != nil {
		return err
	}

	rawText := strings.TrimSpace(msg.Text)
	if rawText == "" && msg.IsAudio && s.audioTranscriber != nil {
		rawText = s.transcribeAudio(ctx, instanceName, data)
	}
	if rawText == "" {
		return nil
	}

	integration, err := s.repo.GetByInstanceName(ctx, instanceName)
	if err != nil || integration == nil {
		return nil
	}

	chatKind := s.classifyChat(ctx, instanceName, integration, msg.RemoteJID)
	if strings.HasSuffix(msg.RemoteJID, "@g.us") && s.groupMeta != nil {
		// Nomes dos grupos são buscados em background (1 chamada de avatar por grupo).
		s.groupMeta.EnsureLabels(ctx, instanceName)
	}

	// Diagnóstico de entrada: expõe o JID, o telefone da integração e o tipo de chat
	// classificado (essencial para auditar a classificação do chat "Você").
	log.Printf("🧭 [WhatsAppContext] instance=%s jid=%s phone=%s kind=%s tipo=%s texto=%d citada=%v",
		instanceName, msg.RemoteJID, integration.Phone, chatKind, msg.MessageType, len(rawText), msg.QuotedText != "")

	// Mensagem gerada pelo próprio Vito: arquiva (faz parte do contexto) e encerra (anti-loop).
	if IsVitoMessage(rawText) {
		clean, _ := StripVitoSignature(rawText)
		s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, clean, "vito")
		return nil
	}

	// Em grupos e conversas com terceiros o Vito só responde quando é citado.
	hasTrigger := reVitoTrigger.MatchString(rawText)
	if RequiresTrigger(chatKind) && !hasTrigger {
		s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
		return nil
	}
	if hasTrigger {
		rawText = strings.TrimSpace(reVitoTrigger.ReplaceAllString(rawText, ""))
		if rawText == "" {
			rawText = "olá"
		}
	}

	s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")

	if s.assistantSvc == nil {
		return nil
	}

	// Feedback visual imediato: reagir com olhinho para confirmar leitura.
	if msg.MessageID != "" && msg.RemoteJID != "" {
		_ = s.client.SendReaction(ctx, instanceName, msg.RemoteJID, msg.MessageID, "👀")
	}

	quoted, window := s.buildContext(ctx, integration.UserID, msg, chatKind, rawText)

	// Métricas do contexto (SPEC §10.2 P7): permitem auditar no Pi o que o Vito enxergou.
	log.Printf("🧠 [WhatsAppContext] kind=%s janela=%d cross_chat=%v citada=%v chats=%s msg_id=%s",
		chatKind, len(window), AllowsCrossChat(chatKind), quoted != "", describeWindowChats(window), msg.MessageID)

	convKey := fmt.Sprintf("%s:%s", instanceName, msg.RemoteJID)
	history := s.memory.GetHistory(convKey)
	if len(window) > 0 {
		// A janela é superset do histórico da conversa: evita duplicar tokens no prompt.
		history = nil
	}

	resp, err := s.assistantSvc.Process(ctx, integration.UserID, ai.UserInput{
		Text:                rawText,
		ConversationHistory: history,
		QuotedContext:       quoted,
		ConversationWindow:  window,
	})
	if err != nil {
		log.Printf("⚠️ [WhatsAppService] Erro ao processar mensagem do WhatsApp: %v", err)
		return nil
	}

	s.memory.AddMessage(convKey, "user", rawText)

	replyText := resp.Reply
	if replyText == "" {
		replyText = resp.Message
	}
	if replyText == "" {
		return nil
	}
	s.memory.AddMessage(convKey, "vito", replyText)

	formattedReply := fmt.Sprintf("💼 Vito:\n\n%s", replyText)
	isGroup := strings.HasSuffix(msg.RemoteJID, "@g.us")
	if isGroup && msg.MessageID != "" {
		_ = s.client.SendTextWithQuoted(ctx, instanceName, msg.RemoteJID, formattedReply, msg.MessageID)
	} else {
		_ = s.client.SendText(ctx, instanceName, msg.RemoteJID, formattedReply)
	}

	if s.notifSender != nil {
		notifBody := replyText
		if isGroup {
			notifBody = fmt.Sprintf("Respondeu no grupo: %s", replyText)
		}
		if len(notifBody) > 150 {
			notifBody = notifBody[:147] + "..."
		}
		_, _ = s.notifSender.SendPushToUser(integration.UserID, "💬 Vito (WhatsApp)", notifBody, "default", map[string]interface{}{
			"type":      "whatsapp_response",
			"remoteJid": msg.RemoteJID,
		})
	}

	return nil
}

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

// classifyChat classifica a conversa e agenda a atualização do cache de participantes.
//
// A referência para reconhecer o chat "Você" é o **JID do owner** da instância
// (o número realmente pareado), e não o telefone cadastrado na conta Vito — que
// pode ser outro número. Sem o owner, o fallback é o telefone cadastrado.
func (s *WhatsAppService) classifyChat(ctx context.Context, instanceName string, integration *domain.WhatsAppIntegration, remoteJID string) string {
	participants, fresh := 0, false
	if strings.HasSuffix(remoteJID, "@g.us") && s.groupMeta != nil {
		participants, fresh = s.groupMeta.ParticipantsCount(remoteJID)
		if !fresh {
			s.groupMeta.EnsureParticipants(ctx, instanceName, remoteJID)
		}
	}

	selfReference := integration.Phone
	if s.ownerCache != nil {
		if ownerJID, ownerFresh := s.ownerCache.JID(instanceName); ownerFresh {
			selfReference = ownerJID
		} else {
			s.ownerCache.Ensure(ctx, instanceName)
		}
	}
	return ClassifyChat(remoteJID, selfReference, participants, fresh)
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
		quoted = strings.TrimSpace(msg.QuotedText)
	}
	window := s.contextSvc.Window(ctx, userID, msg.RemoteJID, chatKind, text, msg.MessageID)
	return quoted, window
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
		s.labelsMu.Lock()
		defer s.labelsMu.Unlock()
		if s.chatLabels == nil {
			s.chatLabels = make(map[string]string)
		}
		if !msg.FromMe && strings.TrimSpace(msg.PushName) != "" {
			s.chatLabels[msg.RemoteJID] = msg.PushName
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
