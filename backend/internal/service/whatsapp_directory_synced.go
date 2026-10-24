package service

import (
	"context"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
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

// enrichDirectoryWithSyncedContacts complementa o diretório de contatos para o prompt da IA:
// 1. Enriquece contatos recentes com os nomes salvos da agenda (ex: Bella -> Isa, com alias Bella);
// 2. Adiciona contatos sincronizados da agenda que ainda não tenham mensagens recentes,
//    garantindo que o assistente conheça todos os amigos salvos pelo dono.
func (s *WhatsAppDirectoryService) enrichDirectoryWithSyncedContacts(
	ctx context.Context,
	userID string,
	chats []domain.WhatsAppChatSummary,
	out []ai.ChatContactSummary,
) []ai.ChatContactSummary {
	if s == nil || s.contactRepo == nil || strings.TrimSpace(userID) == "" {
		return out
	}

	syncedList, err := s.contactRepo.ListByUserID(ctx, userID)
	if err != nil || len(syncedList) == 0 {
		return out
	}

	// Mapeia por nome já presente para evitar duplicatas
	seenNames := make(map[string]bool, len(out)+len(syncedList))
	for i, entry := range out {
		seenNames[normalizeContactName(entry.Name)] = true
		if entry.Alias != "" {
			seenNames[normalizeContactName(entry.Alias)] = true
		}

		// Se a conversa tem JID ou LID que bate com a agenda, atualiza o nome principal para o nome salvo
		if i < len(chats) {
			chat := chats[i]
			for _, sc := range syncedList {
				matched := false
				if sc.JID != "" && sc.JID == chat.ChatJID {
					matched = true
				} else if sc.LID != "" && sc.LID == chat.ChatJID {
					matched = true
				} else if sc.PhoneDigits != "" && strings.Contains(chat.ChatJID, sc.PhoneDigits) {
					matched = true
				}

				if matched && sc.SavedName != "" {
					out[i].Name = sc.SavedName
					if sc.ProfileName != "" && sc.ProfileName != sc.SavedName {
						out[i].Alias = sc.ProfileName
					} else if chat.ChatLabel != "" && chat.ChatLabel != sc.SavedName && chat.ChatLabel != "Contato" {
						out[i].Alias = chat.ChatLabel
					}
					seenNames[normalizeContactName(out[i].Name)] = true
					if out[i].Alias != "" {
						seenNames[normalizeContactName(out[i].Alias)] = true
					}
					break
				}
			}
		}
	}

	// Adiciona contatos da agenda salvos que ainda não estão no diretório
	for _, sc := range syncedList {
		savedName := strings.TrimSpace(sc.SavedName)
		if savedName == "" {
			continue
		}
		norm := normalizeContactName(savedName)
		if seenNames[norm] {
			continue
		}
		seenNames[norm] = true

		alias := strings.TrimSpace(sc.ProfileName)
		if alias == savedName {
			alias = ""
		}

		preview := "Contato salvo na agenda"
		if sc.Phone != "" {
			preview += " (" + sc.Phone + ")"
		}

		out = append(out, ai.ChatContactSummary{
			Name:    savedName,
			Alias:   alias,
			Preview: preview,
			Age:     "",
		})
	}

	return out
}
