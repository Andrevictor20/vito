package service

import (
	"context"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// SetContactRepository injeta o repositório de contatos persistidos no diretório.
func (s *WhatsAppDirectoryService) SetContactRepository(repo domain.SyncedContactRepository) {
	if s != nil {
		s.contactRepo = repo
	}
}

// resolveFromSyncedContacts resolve contatos salvos na agenda mesmo sem histórico no shadow inbox.
func (s *WhatsAppDirectoryService) resolveFromSyncedContacts(ctx context.Context, userID, query string) (*domain.WhatsAppChatSummary, error) {
	if s == nil || s.contactRepo == nil || strings.TrimSpace(userID) == "" || strings.TrimSpace(query) == "" {
		return nil, &ErrChatNotFound{Query: query}
	}

	synced, err := s.contactRepo.FindByNameOrPhone(ctx, userID, query)
	if err != nil || len(synced) == 0 {
		return nil, &ErrChatNotFound{Query: query}
	}

	// 1) Match exato por nome salvo
	var exactMatches []domain.SyncedContact
	for i := range synced {
		if contactNameMatches(synced[i].SavedName, query) {
			exactMatches = append(exactMatches, synced[i])
		}
	}

	var best *domain.SyncedContact
	if len(exactMatches) == 1 {
		best = &exactMatches[0]
	} else if len(exactMatches) > 1 {
		candidates := make([]string, 0, len(exactMatches))
		for _, em := range exactMatches {
			label := em.SavedName
			if em.Phone != "" {
				label += " (" + em.Phone + ")"
			}
			candidates = append(candidates, label)
		}
		return nil, &ErrAmbiguousChat{Query: query, Candidates: candidates}
	} else {
		// Pega o primeiro match aproximado
		best = &synced[0]
	}

	jid := strings.TrimSpace(best.JID)
	if jid == "" {
		digits := phoneDigits(best.PhoneDigits)
		if digits == "" {
			digits = phoneDigits(best.Phone)
		}
		if digits != "" {
			jid = digits + "@s.whatsapp.net"
		}
	}
	if jid == "" && best.LID != "" {
		jid = best.LID
	}
	if jid == "" {
		return nil, &ErrChatNotFound{Query: query}
	}

	label := strings.TrimSpace(best.SavedName)
	if label == "" {
		label = strings.TrimSpace(best.ProfileName)
	}
	if label == "" {
		label = "Contato"
	}

	return &domain.WhatsAppChatSummary{
		ChatJID:    jid,
		ChatLabel:  label,
		ChatKind:   domain.WhatsAppChatKindDirect,
		LastFromMe: true,
		LastAt:     time.Now().UTC(),
	}, nil
}
