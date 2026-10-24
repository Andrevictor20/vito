package handler

import (
	"context"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// SetContactRepository injeta o repositório de contatos persistidos.
func (h *WhatsAppHandler) SetContactRepository(repo domain.SyncedContactRepository) {
	h.contactRepo = repo
}

// persistSyncedContacts grava os contatos na tabela relacional synced_contacts.
func (h *WhatsAppHandler) persistSyncedContacts(ctx context.Context, userID string, names []service.SavedContactName) int64 {
	if h.contactRepo == nil || len(names) == 0 {
		return 0
	}

	synced := make([]domain.SyncedContact, 0, len(names))
	now := time.Now().UTC()
	for _, n := range names {
		phone := strings.TrimSpace(n.Phone)
		name := strings.TrimSpace(n.Name)
		if phone == "" || name == "" {
			continue
		}
		digits := extractDigits(phone)
		if digits == "" {
			continue
		}
		synced = append(synced, domain.SyncedContact{
			UserID:      userID,
			Phone:       phone,
			PhoneDigits: digits,
			JID:         digits + "@s.whatsapp.net",
			SavedName:   name,
			Source:      "phonebook",
			CreatedAt:   now,
			UpdatedAt:   now,
		})
	}

	if len(synced) == 0 {
		return 0
	}
	n, err := h.contactRepo.UpsertBatch(ctx, synced)
	if err != nil {
		return 0
	}
	return n
}

func extractDigits(raw string) string {
	var b strings.Builder
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			b.WriteRune(r)
		}
	}
	return b.String()
}
