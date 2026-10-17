package assistant

import (
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// PromptBuilder helpers puros de formatação (BACK-01: extraído de assistant_service.go).
// Mantém AssistantService como orquestrador fino; formatação testável isoladamente.

func FormatScheduleLine(ev domain.Event, loc *time.Location) string {
	evStart, evEnd := ev.StartAt.In(loc), ev.EndAt.In(loc)
	line := fmt.Sprintf("%s (%s, das %s às %s): %s",
		evStart.Format("02/01/2006"),
		ai.WeekdayPT(evStart.Weekday()),
		evStart.Format("15:04"),
		evEnd.Format("15:04"),
		ev.Title,
	)
	if strings.TrimSpace(ev.ID) != "" {
		line += fmt.Sprintf(" [ID: %s]", strings.TrimSpace(ev.ID))
	}
	return line
}

func FormatTodoLine(td domain.Todo, loc *time.Location) string {
	dueStr := "Sem prazo"
	if td.DueDate != nil {
		dueStr = td.DueDate.In(loc).Format("02/01 15:04")
	}
	line := fmt.Sprintf("[%s - %s] %s", td.Priority, dueStr, td.Title)
	if strings.TrimSpace(td.ID) != "" {
		line += fmt.Sprintf(" [ID: %s]", strings.TrimSpace(td.ID))
	}
	return line
}

func FormatTriggerLine(tr domain.Trigger) string {
	schedule := string(tr.Frequency)
	if tr.ScheduledTime != "" {
		schedule = fmt.Sprintf("%s às %s", schedule, tr.ScheduledTime)
	}
	return fmt.Sprintf("[%s - %s] %s (%s)", tr.Category, schedule, tr.Title, tr.Query)
}

// FormatTriggerAlertLine resume um alerta não lido de radar para o chat (Fase 3).
func FormatTriggerAlertLine(triggerTitle, message, currentValue string) string {
	line := fmt.Sprintf("[%s] %s", triggerTitle, message)
	if strings.TrimSpace(currentValue) != "" {
		line += fmt.Sprintf(" (valor: %s)", strings.TrimSpace(currentValue))
	}
	return line
}

// CollectTriggerAlerts monta até limit linhas dos alertas não lidos (Fase 3).
func CollectTriggerAlerts(triggers []domain.Trigger, logsByTrigger map[string][]domain.TriggerLog, limit int) []string {
	if limit <= 0 {
		return nil
	}
	var out []string
	for _, tr := range triggers {
		for _, l := range logsByTrigger[tr.ID] {
			if l.IsRead {
				continue
			}
			out = append(out, FormatTriggerAlertLine(tr.Title, l.Message, tr.CurrentValue))
			if len(out) >= limit {
				return out
			}
		}
	}
	return out
}

func FormatBookingLine(title string, dur int, sh, eh, url string) string {
	return fmt.Sprintf("%s (%d min, %s às %s): %s", title, dur, sh, eh, url)
}

// ComputeFreeSlotsSummary calcula deterministicamente as janelas livres (08:00-20:00) para Hoje e Amanhã,
// evitando que a IA alucine horários ocupados como livres.
func ComputeFreeSlotsSummary(events []domain.Event, now time.Time, loc *time.Location) []string {
	if loc == nil {
		loc = time.UTC
	}
	nowLocal := now.In(loc)
	var out []string
	labels := []string{"Hoje", "Amanhã"}

	for dayOffset, label := range labels {
		day := nowLocal.AddDate(0, 0, dayOffset)
		dayStart := time.Date(day.Year(), day.Month(), day.Day(), 8, 0, 0, 0, loc)
		dayEnd := time.Date(day.Year(), day.Month(), day.Day(), 20, 0, 0, 0, loc)

		type interval struct {
			start time.Time
			end   time.Time
		}
		var busy []interval
		for _, e := range events {
			cat := strings.ToLower(strings.TrimSpace(e.Category))
			if cat == "holiday" || cat == "feriado" || e.EndAt.Sub(e.StartAt) >= 20*time.Hour {
				continue
			}
			s := e.StartAt.In(loc)
			en := e.EndAt.In(loc)
			if !en.After(dayStart) || !s.Before(dayEnd) {
				continue
			}
			if s.Before(dayStart) {
				s = dayStart
			}
			if en.After(dayEnd) {
				en = dayEnd
			}
			if en.After(s) {
				busy = append(busy, interval{start: s, end: en})
			}
		}

		sort.Slice(busy, func(i, j int) bool {
			return busy[i].start.Before(busy[j].start)
		})

		var slots []string
		cursor := dayStart
		for _, b := range busy {
			if b.start.After(cursor) {
				slots = append(slots, fmt.Sprintf("%s-%s", cursor.Format("15:04"), b.start.Format("15:04")))
			}
			if b.end.After(cursor) {
				cursor = b.end
			}
		}
		if dayEnd.After(cursor) {
			slots = append(slots, fmt.Sprintf("%s-%s", cursor.Format("15:04"), dayEnd.Format("15:04")))
		}

		if len(slots) == 0 {
			out = append(out, fmt.Sprintf("Janelas livres %s (%s, 08h-20h): sem janelas livres", label, day.Format("2006-01-02")))
		} else {
			out = append(out, fmt.Sprintf("Janelas livres %s (%s, 08h-20h): %s", label, day.Format("2006-01-02"), strings.Join(slots, ", ")))
		}
	}
	return out
}
