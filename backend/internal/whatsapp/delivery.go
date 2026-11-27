package whatsapp

import (
	"context"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/ai/voice"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/whatsapp/evolution"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// SetAttentionBudget injeta o controlador de orçamento de atenção para notificações do WhatsApp.
func (s *WhatsAppService) SetAttentionBudget(ab *service.AttentionBudgetService) {
	s.attentionBudget = ab
}

// SetNotificationSender injeta o serviço de notificações push no WhatsAppService.
func (s *WhatsAppService) SetNotificationSender(sender NotificationSender) {
	s.notifSender = sender
}

// SetAudioTranscriber injeta o transcritor de áudio (Groq Whisper) no WhatsAppService.
func (s *WhatsAppService) SetAudioTranscriber(transcriber voice.AudioTranscriber) {
	s.audioTranscriber = transcriber
}

// SetUserRepo injeta o repositório de usuários para discovery social de contatos.
func (s *WhatsAppService) SetUserRepo(userRepo domain.UserRepository) {
	s.userRepo = userRepo
}

// learnOwnerAndLIDFromMessage registra mapeamentos @lid -> PN e o @lid do próprio dono em self-chat.
func (s *WhatsAppService) learnOwnerAndLIDFromMessage(instanceName string, integration *domain.WhatsAppIntegration, msg *inboundMessage) {
	if s == nil || msg == nil {
		return
	}
	s.rememberLIDMapping(msg.RawRemoteJID, msg.RemoteJIDAlt)
	s.rememberLIDMapping(msg.RawParticipant, msg.ParticipantAlt)

	if s.ownerCache == nil {
		return
	}
	if msg.FromMe && strings.HasSuffix(msg.Participant, "@lid") {
		s.ownerCache.SetLID(instanceName, msg.Participant)
	}
	if msg.FromMe && msg.Participant == "" && strings.HasSuffix(msg.RemoteJID, "@lid") {
		ownerJID, _ := s.ownerCache.JID(instanceName)
		phone := ""
		if integration != nil {
			phone = integration.Phone
		}
		isOwnerAlt := msg.RemoteJIDAlt != "" && IsOwnerSender(msg.RemoteJIDAlt, phone, ownerJID)
		calledByOwner, _ := hasVitoCall(msg.Text)
		if isOwnerAlt || (calledByOwner && s.lookupLIDMapping(msg.RemoteJID) == "") {
			s.ownerCache.SetLID(instanceName, msg.RemoteJID)
		}
	}
}

// rememberLIDMapping registra o mapeamento @lid -> @s.whatsapp.net quando ambos são conhecidos.
func (s *WhatsAppService) rememberLIDMapping(lidJID, pnJID string) {
	if s == nil {
		return
	}
	lid := strings.TrimSpace(lidJID)
	pn := NormalizeJIDForSend(pnJID)
	if !strings.HasSuffix(lid, "@lid") || !strings.HasSuffix(pn, "@s.whatsapp.net") {
		return
	}
	s.lidMu.Lock()
	if s.lidToPN == nil {
		s.lidToPN = make(map[string]string)
	}
	s.lidToPN[strings.ToLower(lid)] = pn
	s.lidMu.Unlock()
}

// lookupLIDMapping consulta o mapa local LID -> PN.
func (s *WhatsAppService) lookupLIDMapping(lidJID string) string {
	if s == nil || lidJID == "" {
		return ""
	}
	s.lidMu.RLock()
	defer s.lidMu.RUnlock()
	if s.lidToPN == nil {
		return ""
	}
	return s.lidToPN[strings.ToLower(strings.TrimSpace(lidJID))]
}

// resolveTargetJIDForMessage resolve o destino real para envio na Evolution API,
// garantindo que @lid em conversas diretas seja convertido para @s.whatsapp.net via mapa local ou FindContacts.
func (s *WhatsAppService) resolveTargetJIDForMessage(
	ctx context.Context,
	instanceName string,
	msg *inboundMessage,
	chatKind, ownerJID, ownerPhone string,
) string {
	if msg == nil {
		return ""
	}
	targetJID := ResolveReplyJID(msg.RemoteJID, msg.RemoteJIDAlt, chatKind, ownerJID, ownerPhone)
	if !strings.HasSuffix(targetJID, "@lid") {
		return targetJID
	}

	if pn := s.lookupLIDMapping(targetJID); pn != "" {
		return pn
	}

	if s.client != nil && instanceName != "" {
		findCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
		contacts, err := s.client.FindContacts(findCtx, instanceName)
		cancel()
		if err == nil {
			for _, c := range contacts {
				if strings.EqualFold(strings.TrimSpace(c.ID), targetJID) {
					if digits := domain.PhoneDigits(c.Number); digits != "" {
						pn := digits + "@s.whatsapp.net"
						s.rememberLIDMapping(targetJID, pn)
						return pn
					}
				}
			}
		}
	}

	return targetJID
}

// sendWhatsAppReplyWithFallback executa o envio real na Evolution API com cadeia de fallback:
// - Em grupos (@g.us): tenta SendTextWithQuotedRef completo e faz fallback para SendText sem citação.
// - Em 1-on-1 (self/direct): tenta SendText; em 400 (exists:false) alterna o 9º dígito BR (12<->13).
// - Em self/self_group apenas: pode tentar canonicalOwnerJID como último recurso; NUNCA em direct.
func (s *WhatsAppService) sendWhatsAppReplyWithFallback(
	ctx context.Context,
	instanceName, targetJID, canonicalOwnerJID, chatKind, formattedReply string,
	msg *inboundMessage,
) error {
	isGroupJID := strings.HasSuffix(targetJID, "@g.us")
	if isGroupJID && msg != nil && msg.MessageID != "" {
		var quotedErr error
		if quotedSender, ok := s.client.(evolution.QuotedRefEvolutionClient); ok {
			quotedErr = quotedSender.SendTextWithQuotedRef(ctx, instanceName, targetJID, formattedReply, evolution.QuotedMessageRef{
				ID:        msg.MessageID,
				RemoteJID: targetJID,
				FromMe:    msg.FromMe,
				Text:      msg.Text,
			})
		} else {
			quotedErr = s.client.SendTextWithQuoted(ctx, instanceName, targetJID, formattedReply, msg.MessageID)
		}
		if quotedErr == nil {
			return nil
		}
		log.Printf("⚠️ [WhatsAppService] sendText com citação falhou para %s (%v); tentando fallback sem citação", targetJID, quotedErr)
		return s.client.SendText(ctx, instanceName, targetJID, formattedReply)
	}

	err := s.client.SendText(ctx, instanceName, targetJID, formattedReply)
	if err == nil {
		return nil
	}

	if isEvolutionNumberNotExistsError(err) {
		if altJID, ok := toggleBrazil9thDigitJID(targetJID); ok {
			log.Printf("⚠️ [WhatsAppService] 400 exists:false para %s; tentando variação de 9º dígito BR %s", targetJID, altJID)
			if retryErr := s.client.SendText(ctx, instanceName, altJID, formattedReply); retryErr == nil {
				return nil
			} else {
				err = retryErr
			}
		}
	}

	if (chatKind == domain.WhatsAppChatKindSelf || chatKind == domain.WhatsAppChatKindSelfGroup) &&
		canonicalOwnerJID != "" && canonicalOwnerJID != targetJID {
		log.Printf("⚠️ [WhatsAppService] tentativa inicial falhou para %s (%v); tentando fallback para ownerJID %s", targetJID, err, canonicalOwnerJID)
		if ownerErr := s.client.SendText(ctx, instanceName, canonicalOwnerJID, formattedReply); ownerErr == nil {
			return nil
		} else if isEvolutionNumberNotExistsError(ownerErr) {
			if altOwnerJID, ok := toggleBrazil9thDigitJID(canonicalOwnerJID); ok {
				if retryOwnerErr := s.client.SendText(ctx, instanceName, altOwnerJID, formattedReply); retryOwnerErr == nil {
					return nil
				}
			}
			err = ownerErr
		} else {
			err = ownerErr
		}
	}

	return err
}

func isEvolutionNumberNotExistsError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "\"exists\":false") ||
		strings.Contains(msg, "\"exists\": false") ||
		strings.Contains(msg, "status 400")
}

func toggleBrazil9thDigitJID(jid string) (string, bool) {
	trimmed := strings.TrimSpace(jid)
	if trimmed == "" || strings.HasSuffix(trimmed, "@g.us") || strings.HasSuffix(trimmed, "@lid") {
		return "", false
	}
	suffix := ""
	userPart := trimmed
	if idx := strings.Index(trimmed, "@"); idx != -1 {
		userPart = trimmed[:idx]
		suffix = trimmed[idx:]
	}
	userPart = strings.Split(userPart, ":")[0]
	digits := domain.PhoneDigits(userPart)
	if !strings.HasPrefix(digits, "55") {
		return "", false
	}
	switch len(digits) {
	case 13:
		if digits[4] == '9' {
			return digits[:4] + digits[5:] + suffix, true
		}
	case 12:
		return digits[:4] + "9" + digits[4:] + suffix, true
	}
	return "", false
}

func truncateUTF8Runes(s string, maxRunes int) string {
	if maxRunes <= 0 {
		return ""
	}
	runes := []rune(s)
	if len(runes) <= maxRunes {
		return s
	}
	if maxRunes <= 3 {
		return string(runes[:maxRunes])
	}
	return string(runes[:maxRunes-3]) + "..."
}

// notifyWhatsAppReplyIfAllowed envia push de auditoria apenas em grupos de terceiros,
// passando pelo service.AttentionBudgetService com DedupKey por MessageID e truncamento UTF-8 seguro.
func (s *WhatsAppService) notifyWhatsAppReplyIfAllowed(
	ctx context.Context,
	userID, chatKind string,
	msg *inboundMessage,
	replyText string,
) {
	if s.notifSender == nil || msg == nil || chatKind != domain.WhatsAppChatKindGroup {
		return
	}
	notifBody := truncateUTF8Runes(fmt.Sprintf("Respondeu no grupo: %s", replyText), 150)
	if s.attentionBudget != nil {
		allowed, _ := s.attentionBudget.ShouldDeliver(ctx, service.AttentionCandidate{
			UserID:       userID,
			SourceWorker: "whatsapp_reply",
			Category:     "whatsapp",
			Urgency:      "normal",
			DedupKey:     "wa_reply:" + msg.MessageID,
			Title:        "💬 Vito (WhatsApp)",
			Body:         notifBody,
			Now:          time.Now().UTC(),
		})
		if !allowed {
			return
		}
	}
	_, _ = s.notifSender.SendPushToUser(userID, "💬 Vito (WhatsApp)", notifBody, "default", map[string]interface{}{
		"type":      "whatsapp_response",
		"remoteJid": msg.RemoteJID,
	})
}
