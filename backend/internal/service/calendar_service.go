package service

import (
	"context"
	"errors"
	"fmt"
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
	if endAt.IsZero() || endAt.Before(startAt) || endAt.Equal(startAt) {
		endAt = startAt.Add(1 * time.Hour)
	}

	// Verifica se há conflito antes de salvar
	conflict, err := s.eventRepo.CheckConflict(userID, startAt, endAt, "")
	if err != nil {
		return nil, nil, err
	}
	if conflict != nil && conflict.HasConflict {
		conflict.SuggestedSlots = s.FindAlternativeSlots(userID, startAt, endAt, conflict)
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
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if err := s.syncPusher.PushEvent(ctx, userID, evt); err != nil {
				log.Printf("[CalendarService] Falha ao sincronizar novo evento '%s' na agenda remota: %v", evt.Title, err)
			}
		}(event)
	}

	return event, conflict, nil
}

// FindAlternativeSlots sugere até 3 janelas livres adjacentes para resolver conflitos de agenda.
func (s *CalendarService) FindAlternativeSlots(userID string, requestedStart, requestedEnd time.Time, conflict *domain.ConflictInfo) []domain.TimeSlot {
	dur := requestedEnd.Sub(requestedStart)
	if dur <= 0 {
		dur = 1 * time.Hour
	}

	dayStart := time.Date(requestedStart.Year(), requestedStart.Month(), requestedStart.Day(), 0, 0, 0, 0, requestedStart.Location())
	dayEnd := dayStart.Add(24 * time.Hour)

	events, err := s.eventRepo.ListByUser(userID, dayStart, dayEnd)
	if err != nil {
		return nil
	}

	hasOverlap := func(start, end time.Time) bool {
		for _, e := range events {
			// Feriados e eventos de dia inteiro (>= 20h) não bloqueiam horários específicos
			if e.Category == "holiday" || e.EndAt.Sub(e.StartAt) >= 20*time.Hour {
				continue
			}
			if start.Before(e.EndAt) && end.After(e.StartAt) {
				return true
			}
		}
		return false
	}

	var suggestions []domain.TimeSlot

	var confEnd time.Time
	if conflict != nil && conflict.ConflictingID != "" {
		for _, e := range events {
			if e.ID == conflict.ConflictingID {
				confEnd = e.EndAt
				break
			}
		}
	}
	if confEnd.IsZero() {
		confEnd = requestedEnd
	}

	candidates := []time.Time{
		confEnd,
		confEnd.Add(30 * time.Minute),
		time.Date(requestedStart.Year(), requestedStart.Month(), requestedStart.Day(), 10, 30, 0, 0, requestedStart.Location()),
		time.Date(requestedStart.Year(), requestedStart.Month(), requestedStart.Day(), 14, 0, 0, 0, requestedStart.Location()),
		time.Date(requestedStart.Year(), requestedStart.Month(), requestedStart.Day(), 16, 0, 0, 0, requestedStart.Location()),
	}

	seen := make(map[int64]bool)
	for _, candStart := range candidates {
		candEnd := candStart.Add(dur)
		if candStart.Hour() < 7 || candEnd.Hour() > 22 || (candEnd.Hour() == 22 && candEnd.Minute() > 0) {
			continue
		}
		if seen[candStart.Unix()] {
			continue
		}
		if !hasOverlap(candStart, candEnd) {
			seen[candStart.Unix()] = true
			suggestions = append(suggestions, domain.TimeSlot{
				StartAt: candStart,
				EndAt:   candEnd,
				Label:   fmt.Sprintf("%s às %s", candStart.Format("15:04"), candEnd.Format("15:04")),
			})
			if len(suggestions) >= 3 {
				break
			}
		}
	}

	return suggestions
}

// ListEvents lista os eventos do usuário no intervalo especificado.
func (s *CalendarService) ListEvents(userID string, from, to time.Time) ([]domain.Event, error) {
	if to.Before(from) {
		to = from.Add(30 * 24 * time.Hour) // default para 30 dias à frente
	}
	return s.eventRepo.ListByUser(userID, from, to)
}

// ListEventsPaged lista com paginação opcional (BACK-05; limit<=0 = tudo).
func (s *CalendarService) ListEventsPaged(userID string, from, to time.Time, limit, offset int) ([]domain.Event, error) {
	if to.Before(from) {
		to = from.Add(30 * 24 * time.Hour)
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}
	return s.eventRepo.ListByUserPaged(userID, from, to, limit, offset)
}

// DeleteEvent remove um evento pertencente ao usuário.
func (s *CalendarService) DeleteEvent(id, userID string) error {
	if stored, err := s.eventRepo.GetByID(id, userID); err == nil {
		if err := rejectHolidayChange(stored); err != nil {
			return err
		}
	}
	if s.syncPusher != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		_ = s.syncPusher.DeleteEvent(ctx, userID, id)
		cancel()
	}
	return s.eventRepo.Delete(id, userID)
}

// DeleteEventWithOption remove um evento individual ou toda a série recorrente.
// Com allSeries=true apaga TUDO (backend + Google + mappings) para não restar notificação órfã.
func (s *CalendarService) DeleteEventWithOption(id, userID string, allSeries bool) (int, error) {
	if stored, err := s.eventRepo.GetByID(id, userID); err == nil {
		if err := rejectHolidayChange(stored); err != nil {
			return 0, err
		}
	}
	if allSeries {
		// Lista IDs da série ANTES de apagar para propagar cada um ao Google.
		orig, err := s.eventRepo.GetByID(id, userID)
		if err != nil {
			return 0, err
		}
		from := time.Now().Add(-60 * 24 * time.Hour)
		to := time.Now().Add(180 * 24 * time.Hour)
		if events, listErr := s.eventRepo.ListByUser(userID, from, to); listErr == nil && s.syncPusher != nil {
			for _, ev := range events {
				if strings.EqualFold(strings.TrimSpace(ev.Title), strings.TrimSpace(orig.Title)) {
					ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					_ = s.syncPusher.DeleteEvent(ctx, userID, ev.ID)
					cancel()
				}
			}
		}
		return s.eventRepo.DeleteSeries(id, userID)
	}
	if s.syncPusher != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
		_ = s.syncPusher.DeleteEvent(ctx, userID, id)
		cancel()
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
	if stored, err := s.eventRepo.GetByID(event.ID, userID); err == nil {
		if err := rejectHolidayChange(stored); err != nil {
			return nil, 0, err
		}
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

	if s.syncPusher != nil {
		evCopy := *event
		go func(evt *domain.Event) {
			ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
			defer cancel()
			if pErr := s.syncPusher.PushEvent(ctx, userID, evt); pErr != nil {
				log.Printf("[CalendarService] Falha ao propagar atualização de '%s' para syncPusher: %v", evt.Title, pErr)
			}
		}(&evCopy)
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

// rejectHolidayChange barra edição/exclusão de feriados (P3: somente-leitura).
func rejectHolidayChange(ev *domain.Event) error {
	if ev != nil && ev.Category == "holiday" {
		return domain.ErrHolidayReadOnly
	}
	return nil
}

// titleMatchesHolidays informa se o termo só encontra feriados (P3).
func (s *CalendarService) titleMatchesHolidays(userID, titleQuery string) bool {
	clean := strings.ToLower(strings.TrimSpace(titleQuery))
	if clean == "" {
		return false
	}
	from := time.Now().Add(-365 * 24 * time.Hour)
	to := time.Now().Add(365 * 24 * time.Hour)
	events, err := s.eventRepo.ListByUser(userID, from, to)
	if err != nil {
		return false
	}
	found := false
	for _, ev := range events {
		if strings.Contains(strings.ToLower(ev.Title), clean) {
			found = true
			if ev.Category != "holiday" {
				return false
			}
		}
	}
	return found
}

// CountMatchingEventsByTitle conta quantos eventos não-feriado correspondem ao título informado.
func (s *CalendarService) CountMatchingEventsByTitle(userID, titleQuery string) int {
	clean := strings.ToLower(strings.TrimSpace(titleQuery))
	if clean == "" {
		return 0
	}
	from := time.Now().Add(-365 * 24 * time.Hour)
	to := time.Now().Add(365 * 24 * time.Hour)
	events, err := s.eventRepo.ListByUser(userID, from, to)
	if err != nil {
		return 0
	}
	count := 0
	for _, ev := range events {
		if ev.Category == "holiday" {
			continue
		}
		if strings.Contains(strings.ToLower(ev.Title), clean) {
			count++
		}
	}
	return count
}

// DeleteEventsByTitle remove eventos que correspondam ao termo de busca (para comandos de voz/chat).
func (s *CalendarService) DeleteEventsByTitle(userID, titleQuery string) (int, error) {
	if s.syncPusher != nil {
		from := time.Now().Add(-60 * 24 * time.Hour)
		to := time.Now().Add(180 * 24 * time.Hour)
		events, listErr := s.eventRepo.ListByUser(userID, from, to)
		if listErr == nil {
			cleanQuery := strings.ToLower(strings.TrimSpace(titleQuery))
			for _, ev := range events {
				if strings.Contains(strings.ToLower(ev.Title), cleanQuery) {
					if ev.Category == "holiday" {
						continue // feriado nunca propaga delete (P3)
					}
					ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
					_ = s.syncPusher.DeleteEvent(ctx, userID, ev.ID)
					cancel()
				}
			}
		}
	}
	n, err := s.eventRepo.DeleteByTitle(userID, titleQuery)
	if err != nil {
		return n, err
	}
	if n == 0 && s.titleMatchesHolidays(userID, titleQuery) {
		return 0, domain.ErrHolidayReadOnly
	}
	return n, nil
}

// UpdateEventTimesByTitle ajusta o horário de início e término dos eventos que correspondam ao título.
func (s *CalendarService) UpdateEventTimesByTitle(userID, titleQuery string, newStart, newEnd time.Time) (int, error) {
	count, err := s.eventRepo.UpdateTimesByTitle(userID, titleQuery, newStart, newEnd)
	if err != nil {
		// O repo filtra feriados antes de contar: ausência total pode ser só-feriado (P3).
		if err == domain.ErrEventNotFound && s.titleMatchesHolidays(userID, titleQuery) {
			return 0, domain.ErrHolidayReadOnly
		}
		return count, err
	}
	if count == 0 && s.titleMatchesHolidays(userID, titleQuery) {
		return 0, domain.ErrHolidayReadOnly
	}

	if s.syncPusher != nil {
		from := newStart.Add(-48 * time.Hour)
		to := newEnd.Add(48 * time.Hour)
		events, listErr := s.eventRepo.ListByUser(userID, from, to)
		if listErr == nil {
			cleanQuery := strings.ToLower(strings.TrimSpace(titleQuery))
			for _, ev := range events {
				if strings.Contains(strings.ToLower(ev.Title), cleanQuery) {
					if ev.Category == "holiday" {
						continue // feriado nunca é reescrito nem propagado (P3)
					}
					evCopy := ev
					go func(evt *domain.Event) {
						ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
						defer cancel()
						if pErr := s.syncPusher.PushEvent(ctx, userID, evt); pErr != nil {
							log.Printf("[CalendarService] Falha ao propagar atualização de '%s' para syncPusher: %v", evt.Title, pErr)
						}
					}(&evCopy)
				}
			}
		}
	}

	return count, nil
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
