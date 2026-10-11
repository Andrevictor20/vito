package service

import (
	"errors"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

var (
	ErrPendingTitleEmpty = errors.New("o título da pendência não pode estar vazio")
)

// PendingService gerencia as regras de negócio da Incubadora de Pendências.
type PendingService struct {
	repo domain.PendingRepository
}

// NewPendingService cria uma nova instância de PendingService.
func NewPendingService(repo domain.PendingRepository) *PendingService {
	return &PendingService{repo: repo}
}

func (s *PendingService) CreatePending(userID string, input domain.CreatePendingInput) (*domain.PendingItem, error) {
	title := strings.TrimSpace(input.Title)
	if title == "" {
		return nil, ErrPendingTitleEmpty
	}

	category := strings.TrimSpace(input.Category)
	if category == "" {
		category = "geral"
	}

	now := time.Now().UTC()
	status := domain.PendingStatusInbox
	if strings.TrimSpace(input.ScheduledDate) != "" {
		status = domain.PendingStatusScheduled
	}

	item := &domain.PendingItem{
		ID:            uuid.New().String(),
		UserID:        userID,
		Title:         title,
		Description:   strings.TrimSpace(input.Description),
		Category:      category,
		Status:        status,
		ScheduledDate: strings.TrimSpace(input.ScheduledDate),
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.repo.Create(item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *PendingService) GetByID(id, userID string) (*domain.PendingItem, error) {
	return s.repo.GetByID(id, userID)
}

func (s *PendingService) ListByUser(userID string, status *domain.PendingStatus, category string) ([]domain.PendingItem, error) {
	return s.repo.ListByUser(userID, status, category)
}

func (s *PendingService) UpdatePending(id, userID string, input domain.UpdatePendingInput) (*domain.PendingItem, error) {
	item, err := s.repo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}

	if input.Title != nil {
		trimmed := strings.TrimSpace(*input.Title)
		if trimmed == "" {
			return nil, ErrPendingTitleEmpty
		}
		item.Title = trimmed
	}

	if input.Description != nil {
		item.Description = strings.TrimSpace(*input.Description)
	}

	if input.Category != nil {
		cat := strings.TrimSpace(*input.Category)
		if cat != "" {
			item.Category = cat
		}
	}

	if input.Status != nil {
		item.Status = *input.Status
	}

	if input.ScheduledDate != nil {
		item.ScheduledDate = strings.TrimSpace(*input.ScheduledDate)
		if item.ScheduledDate != "" && item.Status == domain.PendingStatusInbox {
			item.Status = domain.PendingStatusScheduled
		}
	}

	if err := s.repo.Update(item); err != nil {
		return nil, err
	}

	return item, nil
}

func (s *PendingService) SchedulePending(id, userID, scheduledDate string) (*domain.PendingItem, error) {
	status := domain.PendingStatusScheduled
	return s.UpdatePending(id, userID, domain.UpdatePendingInput{
		Status:        &status,
		ScheduledDate: &scheduledDate,
	})
}

func (s *PendingService) CompletePending(id, userID string) (*domain.PendingItem, error) {
	status := domain.PendingStatusDone
	return s.UpdatePending(id, userID, domain.UpdatePendingInput{
		Status: &status,
	})
}

func (s *PendingService) DeletePending(id, userID string) error {
	return s.repo.Delete(id, userID)
}
