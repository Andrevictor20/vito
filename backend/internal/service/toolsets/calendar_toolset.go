package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
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

func (t *CalendarToolset) Name() domain.ToolsetName {
	return domain.ToolsetCalendar
}

func (t *CalendarToolset) Description() string {
	return "Gerencia eventos, reuniões e horários na agenda do Google Calendar / SQLite do usuário."
}

func (t *CalendarToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["list_events", "create_event", "delete_event"],
				"description": "Operação a executar na agenda."
			},
			"params": {
				"type": "object",
				"properties": {
					"title": {"type": "string", "description": "Título do compromisso."},
					"description": {"type": "string", "description": "Detalhes adicionais."},
					"start_time": {"type": "string", "description": "Data/hora de início em formato RFC3339."},
					"end_time": {"type": "string", "description": "Data/hora de término em formato RFC3339."},
					"event_id": {"type": "string", "description": "ID do evento para exclusão."}
				}
			}
		},
		"required": ["operation"]
	}`)
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
		start := parseFlexibleDateTime(params.StartTime)
		if start.IsZero() {
			start = time.Now().Add(1 * time.Hour)
		}
		end := parseFlexibleDateTime(params.EndTime)
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
		if t.calService != nil {
			if err := t.calService.CreateEvent(ctx, evt); err != nil {
				return nil, err
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			Data:          evt,
			SummaryForLLM: fmt.Sprintf("Evento '%s' agendado com sucesso para %s até %s.", evt.Title, evt.StartAt.Format("02/01 15:04"), evt.EndAt.Format("15:04")),
			Cards: []domain.ChatCard{{
				ID:          evt.ID,
				Type:        "event",
				Title:       evt.Title,
				Subtitle:    fmt.Sprintf("%s - %s", evt.StartAt.Format("02/01 15:04"), evt.EndAt.Format("15:04")),
				ActionLabel: "Ver na Agenda",
			}},
		}, nil

	case "delete_event":
		if t.calService != nil && params.EventID != "" {
			if err := t.calService.DeleteEvent(ctx, params.EventID, execCtx.UserID); err != nil {
				return nil, err
			}
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Evento %s removido com sucesso.", params.EventID),
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
			sb.WriteString(fmt.Sprintf("- %s: %s às %s\n", e.Title, e.StartAt.Format("02/01 15:04"), e.EndAt.Format("15:04")))
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

var (
	naturalTimeRe = regexp.MustCompile(`(?i)\b(\d{1,2})(?:[:h](\d{2}))?\b`)
	brDateTimeRe  = regexp.MustCompile(`(?i)^(\d{1,2})/(\d{1,2})/(\d{4})(?:\s*(?:às|as|-|,)?\s*(\d{1,2})(?:[:h](\d{2}))?)?$`)
)

func saoPauloLocation() *time.Location {
	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		return time.FixedZone("BRT", -3*3600)
	}
	return loc
}

func parseFlexibleDateTime(raw string) time.Time {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return time.Time{}
	}
	loc := saoPauloLocation()

	// 1. Formatos com timezone explícito (RFC3339)
	for _, f := range []string{time.RFC3339, time.RFC3339Nano, "2006-01-02T15:04:05Z07:00", "2006-01-02 15:04:05 -0700"} {
		if t, err := time.Parse(f, raw); err == nil {
			return t.In(loc)
		}
	}

	// 2. Formatos locais interpretados no fuso America/Sao_Paulo
	localFormats := []string{
		"2006-01-02T15:04:05",
		"2006-01-02T15:04",
		"2006-01-02 15:04:05",
		"2006-01-02 15:04",
		"02/01/2006 15:04:05",
		"02/01/2006 15:04",
		"02/01/2006",
		"2006-01-02",
	}
	for _, f := range localFormats {
		if t, err := time.ParseInLocation(f, raw, loc); err == nil {
			return t
		}
	}

	// 3. Formato brasileiro com "às" ou "16h30" (ex: "05/11/2026 às 16h30")
	if m := brDateTimeRe.FindStringSubmatch(raw); len(m) > 0 {
		day, _ := strconv.Atoi(m[1])
		month, _ := strconv.Atoi(m[2])
		year, _ := strconv.Atoi(m[3])
		hour := 9
		min := 0
		if m[4] != "" {
			hour, _ = strconv.Atoi(m[4])
		}
		if m[5] != "" {
			min, _ = strconv.Atoi(m[5])
		}
		return time.Date(year, time.Month(month), day, hour, min, 0, 0, loc)
	}

	// 4. Expressões relativas em português ("hoje 18:30", "amanhã às 15:00", "depois de amanhã 10h")
	lower := strings.ToLower(raw)
	now := time.Now().In(loc)
	dayOffset := -1
	switch {
	case strings.Contains(lower, "depois de amanh"):
		dayOffset = 2
	case strings.Contains(lower, "amanh"):
		dayOffset = 1
	case strings.Contains(lower, "hoje"):
		dayOffset = 0
	}
	if dayOffset >= 0 {
		base := now.AddDate(0, 0, dayOffset)
		hour, min := 9, 0
		if tm := naturalTimeRe.FindStringSubmatch(lower); len(tm) > 1 {
			hour, _ = strconv.Atoi(tm[1])
			if len(tm) > 2 && tm[2] != "" {
				min, _ = strconv.Atoi(tm[2])
			}
		}
		return time.Date(base.Year(), base.Month(), base.Day(), hour, min, 0, 0, loc)
	}

	return time.Time{}
}
