package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"

	"github.com/andrevmp/vito/backend/internal/repository"
)

var reEmailInText = regexp.MustCompile(`(?i)[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}`)

// SetEntityLinkRepository conecta o repositório de resolução cruzada de entidades ao AssistantContextEnricher.
func (e *AssistantContextEnricher) SetEntityLinkRepository(repo *repository.EntityLinkRepository) {
	e.entityLinkRepo = repo
}

func (e *AssistantContextEnricher) resolveEntityLinksInMessage(ctx context.Context, userID, userMessage string) []string {
	if e.entityLinkRepo == nil || strings.TrimSpace(userID) == "" || strings.TrimSpace(userMessage) == "" {
		return nil
	}
	tokens := strings.FieldsFunc(userMessage, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= 'A' && r <= 'Z' || r >= '0' && r <= '9' || r >= 'À' && r <= 'ÿ' || r == '@' || r == '.')
	})
	seenIDs := make(map[string]bool)
	var out []string
	for _, tok := range tokens {
		if len(tok) < 3 {
			continue
		}
		links, err := e.entityLinkRepo.Resolve(ctx, userID, tok)
		if err != nil {
			continue
		}
		for _, el := range links {
			if seenIDs[el.ID] {
				continue
			}
			seenIDs[el.ID] = true
			var details []string
			if el.Email != "" {
				details = append(details, "email="+el.Email)
			}
			if el.WhatsAppJID != "" {
				details = append(details, "whatsapp="+el.WhatsAppJID)
			}
			if el.Phone != "" {
				details = append(details, "tel="+el.Phone)
			}
			for k, v := range el.ExternalIDs {
				if v != "" {
					details = append(details, k+"="+v)
				}
			}
			out = append(out, fmt.Sprintf("%s [%s] (%s)", el.CanonicalName, el.EntityType, strings.Join(details, ", ")))
			if len(out) >= 4 {
				return out
			}
		}
	}
	return out
}
