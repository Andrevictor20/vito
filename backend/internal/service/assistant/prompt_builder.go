package assistant

import (
	"fmt"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// PromptBuilder helpers puros de formatação (BACK-01: extraído de assistant_service.go).
// Mantém AssistantService como orquestrador fino; formatação testável isoladamente.

func FormatScheduleLine(ev domain.Event, loc *time.Location) string {
	evStart, evEnd := ev.StartAt.In(loc), ev.EndAt.In(loc)
	return fmt.Sprintf("%s (%s, das %s às %s): %s",
		evStart.Format("02/01/2006"),
		ai.WeekdayPT(evStart.Weekday()),
		evStart.Format("15:04"),
		evEnd.Format("15:04"),
		ev.Title,
	)
}

func FormatTodoLine(td domain.Todo, loc *time.Location) string {
	dueStr := "Sem prazo"
	if td.DueDate != nil {
		dueStr = td.DueDate.In(loc).Format("02/01 15:04")
	}
	return fmt.Sprintf("[%s - %s] %s", td.Priority, dueStr, td.Title)
}

func FormatTriggerLine(tr domain.Trigger) string {
	schedule := string(tr.Frequency)
	if tr.ScheduledTime != "" {
		schedule = fmt.Sprintf("%s às %s", schedule, tr.ScheduledTime)
	}
	return fmt.Sprintf("[%s - %s] %s (%s)", tr.Category, schedule, tr.Title, tr.Query)
}

func FormatBookingLine(title string, dur int, sh, eh, url string) string {
	return fmt.Sprintf("%s (%d min, %s às %s): %s", title, dur, sh, eh, url)
}
