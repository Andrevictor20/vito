package calendar

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

var reEmailInText = regexp.MustCompile(`(?i)[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}`)

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
