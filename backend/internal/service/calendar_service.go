package service

import (
	"context"
	"errors"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// CalendarSyncPusher define o contrato para propagação de eventos locais para agendas remotas (ex: Google Calendar).
type CalendarSyncPusher interface {
	PushEvent(ctx context.Context, userID string, event *domain.Event) error
	DeleteEvent(ctx context.Context, userID, eventID string) error
}

// CalendarService orquestra criação, listagem e detecção de conflitos de eventos.
type CalendarService struct {
	eventRepo  domain.EventRepository
	syncPusher CalendarSyncPusher
}

// NewCalendarService instancia o serviço de calendário.
func NewCalendarService(eventRepo domain.EventRepository) *CalendarService {
	return &CalendarService{eventRepo: eventRepo}
}

// SetSyncPusher registra o serviço responsável por empurrar eventos para agendas remotas.
func (s *CalendarService) SetSyncPusher(pusher CalendarSyncPusher) {
	s.syncPusher = pusher
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

	if s.syncPusher != nil {
		go func(evt *domain.Event) {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			if err := s.syncPusher.PushEvent(ctx, userID, evt); err != nil {
				log.Printf("[CalendarService] Falha ao sincronizar novo evento '%s' na agenda remota: %v", evt.Title, err)
			}
		}(event)
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
	if s.syncPusher != nil {
		go func(eventID string) {
			ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
			defer cancel()
			_ = s.syncPusher.DeleteEvent(ctx, userID, eventID)
		}(id)
	}
	return s.eventRepo.Delete(id, userID)
}

// DeleteEventWithOption remove um evento individual ou toda a série recorrente.
func (s *CalendarService) DeleteEventWithOption(id, userID string, allSeries bool) (int, error) {
	if allSeries {
		return s.eventRepo.DeleteSeries(id, userID)
	}
	err := s.eventRepo.Delete(id, userID)
	if err != nil {
		return 0, err
	}
	return 1, nil
}

// UpdateEvent atualiza os dados de um evento ou de toda a sua série recorrente.
func (s *CalendarService) UpdateEvent(userID string, event *domain.Event, updateSeries bool) (*domain.Event, int, error) {
	if event.Title == "" {
		return nil, 0, errors.New("o título do evento é obrigatório")
	}
	if event.EndAt.Before(event.StartAt) || event.EndAt.Equal(event.StartAt) {
		return nil, 0, errors.New("o horário de término deve ser após o início")
	}
	event.UserID = userID
	if event.Category == "" {
		cat, col := ClassifyEvent(event.Title, event.Description)
		event.Category = cat
		if event.Color == "" {
			event.Color = col
		}
	}

	if updateSeries {
		count, err := s.eventRepo.UpdateSeries(event)
		if err != nil {
			return nil, 0, err
		}
		return event, count, nil
	}

	if err := s.eventRepo.Update(event); err != nil {
		return nil, 0, err
	}
	return event, 1, nil
}

// DeleteEventsByTitle remove eventos que correspondam ao termo de busca (para comandos de voz/chat).
func (s *CalendarService) DeleteEventsByTitle(userID, titleQuery string) (int, error) {
	return s.eventRepo.DeleteByTitle(userID, titleQuery)
}

// UpdateEventTimesByTitle ajusta o horário de início e término dos eventos que correspondam ao título.
func (s *CalendarService) UpdateEventTimesByTitle(userID, titleQuery string, newStart, newEnd time.Time) (int, error) {
	return s.eventRepo.UpdateTimesByTitle(userID, titleQuery, newStart, newEnd)
}

// CreateRecurringEvents gera uma série de ocorrências para um evento recorrente (ex: semanal).
func (s *CalendarService) CreateRecurringEvents(userID, title, description, location string, startAt, endAt time.Time, recurrence string, count int) ([]*domain.Event, error) {
	if count <= 0 {
		count = 8 // default: próximas 8 ocorrências
	}
	if count > 52 {
		count = 52
	}

	dur := endAt.Sub(startAt)
	var created []*domain.Event
	now := time.Now().UTC()
	cat, col := ClassifyEvent(title, description)

	for i := 0; i < count; i++ {
		var curStart, curEnd time.Time
		switch strings.ToUpper(recurrence) {
		case "DAILY":
			curStart = startAt.AddDate(0, 0, i)
		case "MONTHLY":
			curStart = startAt.AddDate(0, i, 0)
		case "WEEKLY":
			fallthrough
		default:
			curStart = startAt.AddDate(0, 0, i*7)
		}
		curEnd = curStart.Add(dur)

		ev := &domain.Event{
			ID:          uuid.New().String(),
			UserID:      userID,
			Title:       title,
			Description: description,
			Location:    location,
			StartAt:     curStart,
			EndAt:       curEnd,
			Category:    cat,
			Color:       col,
			Recurrence:  strings.ToUpper(recurrence),
			CreatedAt:   now,
			UpdatedAt:   now,
		}

		if err := s.eventRepo.Create(ev); err != nil {
			return created, err
		}
		if s.syncPusher != nil {
			go func(evt *domain.Event) {
				ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
				defer cancel()
				if err := s.syncPusher.PushEvent(ctx, userID, evt); err != nil {
					log.Printf("[CalendarService] Falha ao sincronizar evento recorrente '%s': %v", evt.Title, err)
				}
			}(ev)
		}
		created = append(created, ev)
	}

	return created, nil
}
