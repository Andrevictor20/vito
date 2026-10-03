package service

import (
	"errors"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// CalendarService orquestra criação, listagem e detecção de conflitos de eventos.
type CalendarService struct {
	eventRepo domain.EventRepository
}

// NewCalendarService instancia o serviço de calendário.
func NewCalendarService(eventRepo domain.EventRepository) *CalendarService {
	return &CalendarService{eventRepo: eventRepo}
}

// CreateEvent valida horários, checa conflitos e persiste o evento.
func (s *CalendarService) CreateEvent(userID, title, description, location string, startAt, endAt time.Time) (*domain.Event, *domain.ConflictInfo, error) {
	if title == "" {
		return nil, nil, errors.New("o título do evento é obrigatório")
	}
	if endAt.Before(startAt) || endAt.Equal(startAt) {
		return nil, nil, errors.New("o horário de término deve ser após o início")
	}

	// Verifica se há conflito antes de salvar
	conflict, err := s.eventRepo.CheckConflict(userID, startAt, endAt, "")
	if err != nil {
		return nil, nil, err
	}

	now := time.Now().UTC()
	cat, col := ClassifyEvent(title, description)
	event := &domain.Event{
		ID:          uuid.New().String(),
		UserID:      userID,
		Title:       title,
		Description: description,
		Location:    location,
		StartAt:     startAt,
		EndAt:       endAt,
		Category:    cat,
		Color:       col,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.eventRepo.Create(event); err != nil {
		return nil, nil, err
	}

	return event, conflict, nil
}

// ListEvents lista os eventos do usuário no intervalo especificado.
func (s *CalendarService) ListEvents(userID string, from, to time.Time) ([]domain.Event, error) {
	if to.Before(from) {
		to = from.Add(30 * 24 * time.Hour) // default para 30 dias à frente
	}
	return s.eventRepo.ListByUser(userID, from, to)
}

// DeleteEvent remove um evento pertencente ao usuário.
func (s *CalendarService) DeleteEvent(id, userID string) error {
	return s.eventRepo.Delete(id, userID)
}
