package tasks

import (
	"context"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

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
	_ = s.entityLinkRepo.Upsert(ctx, &domain.EntityLink{
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
	_ = s.entityLinkRepo.Upsert(ctx, &domain.EntityLink{
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
