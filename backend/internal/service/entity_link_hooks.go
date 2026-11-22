package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

var reEmailInText = regexp.MustCompile(`(?i)[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}`)

// SetEntityLinkRepository conecta o repositório de resolução cruzada de entidades ao TodoService.
func (s *TodoService) SetEntityLinkRepository(repo *repository.EntityLinkRepository) {
	s.entityLinkRepo = repo
}

func (s *TodoService) linkTodoEventEntity(todo *domain.Todo) {
	if s.entityLinkRepo == nil || todo == nil || strings.TrimSpace(todo.EventID) == "" {
		return
	}
	name := strings.TrimSpace(todo.EventTitle)
	if name == "" {
		name = strings.TrimSpace(todo.Title)
	}
	if name == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = s.entityLinkRepo.Upsert(ctx, &repository.EntityLink{
		ID:            "todo-event-" + todo.ID,
		UserID:        todo.UserID,
		CanonicalName: name,
		EntityType:    "project",
		Aliases:       []string{todo.Title},
		ExternalIDs: map[string]string{
			"todo_id":  todo.ID,
			"event_id": todo.EventID,
		},
		Confidence: 0.95,
	})
}

// SetEntityLinkRepository conecta o repositório de resolução cruzada de entidades ao PendingService.
func (s *PendingService) SetEntityLinkRepository(repo *repository.EntityLinkRepository) {
	s.entityLinkRepo = repo
}

func (s *PendingService) linkPendingEntity(item *domain.PendingItem) {
	if s.entityLinkRepo == nil || item == nil || strings.TrimSpace(item.ScheduledDate) == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = s.entityLinkRepo.Upsert(ctx, &repository.EntityLink{
		ID:            "pending-" + item.ID,
		UserID:        item.UserID,
		CanonicalName: item.Title,
		EntityType:    "project",
		ExternalIDs: map[string]string{
			"pending_id":     item.ID,
			"scheduled_date": item.ScheduledDate,
		},
		Confidence: 0.9,
	})
}

// SetEntityLinkRepository conecta o repositório de resolução cruzada de entidades ao CalendarService.
func (s *CalendarService) SetEntityLinkRepository(repo *repository.EntityLinkRepository) {
	s.entityLinkRepo = repo
}

func (s *CalendarService) linkEventEntity(event *domain.Event) {
	if s.entityLinkRepo == nil || event == nil || strings.TrimSpace(event.UserID) == "" {
		return
	}
	email := reEmailInText.FindString(event.Title + " " + event.Description)
	if email == "" {
		return
	}
	name := strings.Split(email, "@")[0]
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	_ = s.entityLinkRepo.Upsert(ctx, &repository.EntityLink{
		ID:            "event-email-" + event.ID,
		UserID:        event.UserID,
		CanonicalName: name,
		EntityType:    "person",
		Email:         email,
		Aliases:       []string{event.Title},
		ExternalIDs: map[string]string{
			"event_id": event.ID,
		},
		Confidence: 0.85,
	})
}

// SetEntityLinkRepository conecta o repositório de resolução cruzada de entidades ao WhatsAppService.
func (s *WhatsAppService) SetEntityLinkRepository(repo *repository.EntityLinkRepository) {
	s.entityLinkRepo = repo
}

func (s *WhatsAppService) recordWhatsAppEntityLink(ctx context.Context, userID string, msg *inboundMessage) {
	if s == nil || s.entityLinkRepo == nil || msg == nil || strings.TrimSpace(userID) == "" {
		return
	}
	jid := strings.TrimSpace(firstNonEmpty(msg.Participant, msg.RemoteJID))
	name := strings.TrimSpace(msg.PushName)
	if jid == "" || name == "" || strings.HasSuffix(jid, "@g.us") {
		return
	}
	phone := ""
	if at := strings.Index(jid, "@"); at > 0 {
		phone = jid[:at]
	}
	_ = s.entityLinkRepo.Upsert(ctx, &repository.EntityLink{
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
