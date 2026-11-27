package whatsapp

import (
	"context"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/whatsapp/evolution"
	"strings"

	"github.com/andrevmp/vito/backend/internal/repository"
)

// SetEntityLinkRepository conecta o repositório de resolução cruzada de entidades ao WhatsAppService.
func (s *WhatsAppService) SetEntityLinkRepository(repo *repository.EntityLinkRepository) {
	s.entityLinkRepo = repo
}

func (s *WhatsAppService) recordWhatsAppEntityLink(ctx context.Context, userID string, msg *inboundMessage) {
	if s == nil || s.entityLinkRepo == nil || msg == nil || strings.TrimSpace(userID) == "" {
		return
	}
	jid := strings.TrimSpace(evolution.FirstNonEmpty(msg.Participant, msg.RemoteJID))
	name := strings.TrimSpace(msg.PushName)
	if jid == "" || name == "" || strings.HasSuffix(jid, "@g.us") {
		return
	}
	phone := ""
	if at := strings.Index(jid, "@"); at > 0 {
		phone = jid[:at]
	}
	_ = s.entityLinkRepo.Upsert(ctx, &domain.EntityLink{
		ID:            "wa-" + userID + "-" + jid,
		UserID:        userID,
		CanonicalName: name,
		EntityType:    "person",
		WhatsAppJID:   jid,
		Phone:         phone,
		Aliases:       []string{name},
		ExternalIDs: map[string]string{
			"whatsapp_msg_id": msg.MessageID,
		},
		Confidence: 0.9,
	})
}
