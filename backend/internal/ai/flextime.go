package ai

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// O contrato do prompt pede horário LOCAL sem offset. Valores sem offset ou com sufixo "Z"
// são tratados como horário de parede (wall clock) do usuário e convertidos em LocalizeTimes.
// Offsets explícitos (ex: -03:00) são respeitados.
var naiveLayouts = []string{
	"2006-01-02T15:04:05",
	"2006-01-02T15:04",
	"2006-01-02 15:04:05",
	"2006-01-02 15:04",
	"2006-01-02",
}

func parseFlexTime(raw string) (t time.Time, wallClock bool, err error) {
	s := strings.TrimSpace(raw)
	if s == "" || s == "null" {
		return time.Time{}, false, nil
	}
	if strings.HasSuffix(s, "Z") || strings.HasSuffix(s, "z") {
		s = s[:len(s)-1]
	} else if parsed, perr := time.Parse(time.RFC3339, s); perr == nil {
		return parsed, false, nil
	}
	for _, layout := range naiveLayouts {
		if parsed, perr := time.Parse(layout, s); perr == nil {
			return parsed, true, nil
		}
	}
	return time.Time{}, false, fmt.Errorf("data/hora inválida: %q", raw)
}

func toWallClock(t time.Time, loc *time.Location) time.Time {
	return time.Date(t.Year(), t.Month(), t.Day(), t.Hour(), t.Minute(), t.Second(), 0, loc)
}

func (e *ParsedEvent) UnmarshalJSON(data []byte) error {
	type alias ParsedEvent
	aux := struct {
		*alias
		StartAt string `json:"start_at"`
		EndAt   string `json:"end_at"`
	}{alias: (*alias)(e)}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	var err error
	if e.StartAt, e.startWallClock, err = parseFlexTime(aux.StartAt); err != nil {
		return fmt.Errorf("start_at: %w", err)
	}
	if e.EndAt, e.endWallClock, err = parseFlexTime(aux.EndAt); err != nil {
		return fmt.Errorf("end_at: %w", err)
	}
	return nil
}

func (td *ParsedTodo) UnmarshalJSON(data []byte) error {
	type alias ParsedTodo
	aux := struct {
		*alias
		DueDate  *string `json:"due_date"`
		RemindAt *string `json:"remind_at"`
	}{alias: (*alias)(td)}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	td.DueDate = nil
	if aux.DueDate == nil {
		return nil
	}
	parsed, wall, err := parseFlexTime(*aux.DueDate)
	if err != nil {
		return fmt.Errorf("due_date: %w", err)
	}
	if !parsed.IsZero() {
		td.DueDate = &parsed
		td.dueWallClock = wall
	}
	td.RemindAt = nil
	if aux.RemindAt != nil {
		rparsed, rwall, err := parseFlexTime(*aux.RemindAt)
		if err != nil {
			return fmt.Errorf("remind_at: %w", err)
		}
		if !rparsed.IsZero() {
			td.RemindAt = &rparsed
			td.remindWallClock = rwall
		}
	}
	return nil
}

// UnmarshalJSON de ParsedPending ancora remind_at flexível no fuso do usuário.
func (p *ParsedPending) UnmarshalJSON(data []byte) error {
	type alias ParsedPending
	aux := struct {
		*alias
		RemindAt *string `json:"remind_at"`
	}{alias: (*alias)(p)}
	if err := json.Unmarshal(data, &aux); err != nil {
		return err
	}
	p.RemindAt = nil
	if aux.RemindAt == nil {
		return nil
	}
	parsed, wall, err := parseFlexTime(*aux.RemindAt)
	if err != nil {
		return fmt.Errorf("remind_at: %w", err)
	}
	if !parsed.IsZero() {
		p.RemindAt = &parsed
		p.remindWallClock = wall
	}
	return nil
}

// LocalizeTimes ancora horários de parede emitidos pela IA no fuso do usuário.
func (p *ParsedIntent) LocalizeTimes(timezone string) {
	if timezone == "" {
		timezone = "America/Sao_Paulo"
	}
	loc, err := time.LoadLocation(timezone)
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}
	if ev := p.Event; ev != nil {
		if ev.startWallClock && !ev.StartAt.IsZero() {
			ev.StartAt = toWallClock(ev.StartAt, loc)
			ev.startWallClock = false
		}
		if ev.endWallClock && !ev.EndAt.IsZero() {
			ev.EndAt = toWallClock(ev.EndAt, loc)
			ev.endWallClock = false
		}
	}
	if td := p.Todo; td != nil && td.DueDate != nil && td.dueWallClock {
		local := toWallClock(*td.DueDate, loc)
		td.DueDate = &local
		td.dueWallClock = false
	}
	if td := p.Todo; td != nil && td.RemindAt != nil && td.remindWallClock {
		local := toWallClock(*td.RemindAt, loc)
		td.RemindAt = &local
		td.remindWallClock = false
	}
	if pp := p.Pending; pp != nil && pp.RemindAt != nil && pp.remindWallClock {
		local := toWallClock(*pp.RemindAt, loc)
		pp.RemindAt = &local
		pp.remindWallClock = false
	}
}
