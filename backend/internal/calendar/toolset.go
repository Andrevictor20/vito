package calendar

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/platform/timeutil"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// CalendarServiceContract define o contrato necessário do CalendarService.
type CalendarServiceContract interface {
	GetEvents(ctx context.Context, userID string, start, end time.Time) ([]*domain.Event, error)
	CreateEvent(ctx context.Context, event *domain.Event) error
	DeleteEvent(ctx context.Context, id, userID string) error
}

type CalendarToolset struct {
	calService CalendarServiceContract
}

func NewCalendarToolset(svc CalendarServiceContract) *CalendarToolset {
	return &CalendarToolset{calService: svc}
}

// NewCalendarToolsetFromService constrói o CalendarToolset diretamente a partir de *CalendarService.
func NewCalendarToolsetFromService(svc *CalendarService) *CalendarToolset {
	if svc == nil {
		return NewCalendarToolset(nil)
	}
	return NewCalendarToolset(&calendarServiceAdapter{svc: svc})
}

type calendarServiceAdapter struct {
	svc *CalendarService
}

func (a *calendarServiceAdapter) GetEvents(_ context.Context, userID string, start, end time.Time) ([]*domain.Event, error) {
	events, err := a.svc.ListEvents(userID, start, end)
	if err != nil {
		return nil, err
	}
	res := make([]*domain.Event, 0, len(events))
	for i := range events {
		res = append(res, &events[i])
	}
	return res, nil
}

func (a *calendarServiceAdapter) CreateEvent(_ context.Context, event *domain.Event) error {
	_, err := a.CreateEventWithConflict(context.Background(), event)
	return err
}

func (a *calendarServiceAdapter) CreateEventWithConflict(_ context.Context, event *domain.Event) (*domain.ConflictInfo, error) {
	created, conflict, err := a.svc.CreateEvent(event.UserID, event.Title, event.Description, event.Location, event.StartAt, event.EndAt)
	if err != nil {
		return nil, err
	}
	if created != nil {
		*event = *created
	}
	return conflict, nil
}

func (a *calendarServiceAdapter) DeleteEvent(_ context.Context, id, userID string) error {
	return a.svc.DeleteEvent(id, userID)
}

func (t *CalendarToolset) Name() domain.ToolsetName {
	return domain.ToolsetCalendar
}

func (t *CalendarToolset) Description() string {
	return "Gerencia eventos, reuniões e horários na agenda do Google Calendar / SQLite do usuário."
}

func (t *CalendarToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	preview := make(map[string]any)
	_ = json.Unmarshal(rawParams, &preview)

	switch op {
	case "create_event":
		return true, false, preview
	case "delete_event":
		return true, true, preview
	default:
		return false, false, preview
	}
}

func (t *CalendarToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	var params struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		StartTime   string `json:"start_time"`
		EndTime     string `json:"end_time"`
		EventID     string `json:"event_id"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	switch op {
	case "create_event":
		title := strings.TrimSpace(params.Title)
		if title == "" {
			title = "Reunião"
		}
		start := timeutil.ParseFlexibleDateTime(params.StartTime)
		if start.IsZero() {
			start = time.Now().Add(1 * time.Hour)
		}
		end := timeutil.ParseFlexibleDateTime(params.EndTime)
		if end.IsZero() || end.Before(start) || end.Equal(start) {
			end = start.Add(1 * time.Hour)
		}
		evt := &domain.Event{
			ID:          uuid.New().String(),
			UserID:      execCtx.UserID,
			Title:       title,
			Description: params.Description,
			StartAt:     start,
			EndAt:       end,
			CreatedAt:   time.Now().UTC(),
			UpdatedAt:   time.Now().UTC(),
		}
		var conflict *domain.ConflictInfo
		if t.calService != nil {
			if conflictAware, ok := t.calService.(interface {
				CreateEventWithConflict(ctx context.Context, event *domain.Event) (*domain.ConflictInfo, error)
			}); ok {
				var err error
				conflict, err = conflictAware.CreateEventWithConflict(ctx, evt)
				if err != nil {
					return nil, err
				}
			} else if err := t.calService.CreateEvent(ctx, evt); err != nil {
				return nil, err
			}
		}
		summary := fmt.Sprintf("Evento '%s' agendado com sucesso para %s até %s.", evt.Title, evt.StartAt.Format("02/01 15:04"), evt.EndAt.Format("15:04"))
		var data any = evt
		if conflict != nil && conflict.HasConflict {
			summary = fmt.Sprintf("Evento '%s' agendado para %s até %s, mas há conflito com '%s'.", evt.Title, evt.StartAt.Format("02/01 15:04"), evt.EndAt.Format("15:04"), conflict.ConflictingTitle)
			data = map[string]any{
				"event":    evt,
				"conflict": conflict,
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			Data:          data,
			SummaryForLLM: summary,
			Cards: []domain.ChatCard{{
				ID:          evt.ID,
				Type:        "event",
				Title:       evt.Title,
				Subtitle:    fmt.Sprintf("%s - %s", evt.StartAt.Format("02/01 15:04"), evt.EndAt.Format("15:04")),
				ActionLabel: "Ver na Agenda",
			}},
		}, nil

	case "delete_event":
		eventID := strings.TrimSpace(params.EventID)
		if t.calService != nil && eventID != "" {
			err := t.calService.DeleteEvent(ctx, eventID, execCtx.UserID)
			if err != nil {
				now := time.Now()
				start := now.Add(-30 * 24 * time.Hour)
				end := now.Add(90 * 24 * time.Hour)
				if evts, listErr := t.calService.GetEvents(ctx, execCtx.UserID, start, end); listErr == nil {
					targetLower := strings.ToLower(eventID)
					for _, ev := range evts {
						if strings.Contains(strings.ToLower(ev.Title), targetLower) || strings.EqualFold(ev.ID, eventID) {
							if delErr := t.calService.DeleteEvent(ctx, ev.ID, execCtx.UserID); delErr == nil {
								eventID = ev.ID
								err = nil
								break
							}
						}
					}
				}
			}
			if err != nil {
				return nil, err
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Evento %s removido com sucesso.", eventID),
		}, nil

	default: // "list_events"
		now := time.Now()
		start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		end := start.Add(7 * 24 * time.Hour)
		var evts []*domain.Event
		if t.calService != nil {
			evts, _ = t.calService.GetEvents(ctx, execCtx.UserID, start, end)
		}
		var cards []domain.ChatCard
		var sb strings.Builder
		sb.WriteString(fmt.Sprintf("Eventos encontrados (%d):\n", len(evts)))
		for _, e := range evts {
			sb.WriteString(fmt.Sprintf("- %s: %s às %s [ID: %s]\n", e.Title, e.StartAt.Format("02/01 15:04"), e.EndAt.Format("15:04"), e.ID))
			cards = append(cards, domain.ChatCard{
				ID:          e.ID,
				Type:        "event",
				Title:       e.Title,
				Subtitle:    e.StartAt.Format("02/01 15:04"),
				ActionLabel: "Abrir Evento",
			})
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			Data:          evts,
			SummaryForLLM: sb.String(),
			Cards:         cards,
		}, nil
	}
}

// BotActions declara as ações de agenda disponíveis para Bots (Plano 04 §3 / Fase 5).
func (t *CalendarToolset) BotActions() []domain.BotActionSpec {
	return []domain.BotActionSpec{
		{
			AppKey:      "gcal",
			ActionKey:   "gcal:free",
			Label:       "Ver horários livres",
			Description: "Consulta compromissos e horários disponíveis na agenda.",
			IsWrite:     false,
			AlwaysAsk:   false,
			Operations:  []string{"list_events", "check_conflicts"},
		},
		{
			AppKey:      "gcal",
			ActionKey:   "gcal:evt",
			Label:       "Criar evento",
			Description: "Cria um novo compromisso ou lembrete na agenda.",
			IsWrite:     true,
			AlwaysAsk:   false,
			Operations:  []string{"create_event"},
		},
	}
}
