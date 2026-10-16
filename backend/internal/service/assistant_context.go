package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/assistant"
)

// holidayQueryKeywords espelha ClassifyEvent/CheckConflict: termos que, combinados
// com categoria holiday ou duração de dia inteiro, identificam feriados e datas
// comemorativas vindos do Google — que não são compromissos.
var holidayQueryKeywords = []string{
	"feriado", "nossa senhora", "aparecida", "ano novo", "confraternização",
	"carnaval", "quarta-feira de cinzas", "quarta de cinzas", "sexta-feira santa",
	"paixão de cristo", "páscoa", "pascoa", "tiradentes", "dia do trabalho",
	"dia do trabalhador", "corpus christi", "independência", "independencia",
	"finados", "proclamação da república", "proclamacao da republica",
	"consciência negra", "consciencia negra", "natal", "véspera de natal",
	"vespera de natal", "véspera de ano novo", "vespera de ano novo",
	"dia das mães", "dia dos pais", "dia das crianças", "holiday",
	"réveillon", "reveillon",
}

// enrichInputContext injeta dados contextuais dinâmicos (memória, agenda, tarefas, radares e bookings)
// no input do usuário antes de enviar ao gateway de IA.
func (s *AssistantService) enrichInputContext(ctx context.Context, userID string, input *ai.UserInput) {
	// Carrega preferências de autonomia da IA se não estiverem definidas no input
	if input.AutonomyMode == "" && s.aiSettingsRepo != nil {
		if aiSettings, err := s.aiSettingsRepo.GetSettings(userID); err == nil && aiSettings != nil {
			input.AutonomyMode = string(aiSettings.AutonomyMode)
		}
	}

	// Carrega nome do usuário para contextualização e tratamento pessoal
	if input.UserName == "" && s.userRepo != nil {
		if u, err := s.userRepo.GetByID(userID); err == nil && u != nil && strings.TrimSpace(u.Name) != "" {
			input.UserName = strings.TrimSpace(u.Name)
		}
	}

	// Memória episódica sob demanda: top relevantes (similaridade+importância+recência).
	if len(input.ContextMemories) == 0 && s.memoryRepo != nil {
		if mems, err := s.memoryRepo.SearchRelevant(userID, input.Text, 8); err == nil && len(mems) > 0 {
			for _, m := range mems {
				input.ContextMemories = append(input.ContextMemories, fmt.Sprintf("[%s] %s", m.Category, m.Content))
			}
		}
	}

	// Carrega compromissos ativos próximos na agenda (Camada 2 - Próximos 14 dias, até 15)
	if len(input.ActiveSchedule) == 0 && s.calSvc != nil {
		start := input.Now
		end := input.Now.Add(14 * 24 * time.Hour)
		if events, err := s.calSvc.ListEvents(userID, start, end); err == nil && len(events) > 0 {
			limit := 15
			if len(events) < limit {
				limit = len(events)
			}
			loc := userLocation(input.Timezone)
			for _, ev := range events[:limit] {
				line := assistant.FormatScheduleLine(ev, loc)
				if isHolidayLikeEvent(ev) {
					line += " [feriado/data comemorativa — NÃO é um compromisso]"
				}
				input.ActiveSchedule = append(input.ActiveSchedule, line)
			}
		}
	}

	// Carrega tarefas pendentes mais urgentes (Camada 2 - Até 5 não concluídas)
	if len(input.PendingTodos) == 0 && s.todoSvc != nil {
		if todos, err := s.todoSvc.ListTodos(userID, domain.TodoStatusPending); err == nil && len(todos) > 0 {
			limit := 5
			if len(todos) < limit {
				limit = len(todos)
			}
			for _, td := range todos[:limit] {
				input.PendingTodos = append(input.PendingTodos, assistant.FormatTodoLine(td, userLocation(input.Timezone)))
			}
		}
	}

	// Carrega disparadores e vigílias ativas do usuário (Camada 2 - Até 8 vigílias ativas)
	if len(input.ActiveTriggers) == 0 && s.triggerSvc != nil {
		if trigs, err := s.triggerSvc.ListTriggers(userID, "", domain.TriggerStatusActive); err == nil && len(trigs) > 0 {
			limit := 8
			if len(trigs) < limit {
				limit = len(trigs)
			}
			for _, tr := range trigs[:limit] {
				input.ActiveTriggers = append(input.ActiveTriggers, assistant.FormatTriggerLine(tr))
			}
			// Alertas não lidos (Fase 3): top 3 viram base do chat para propor
			// eventos e analisar conflitos — nunca criação automática.
			if len(input.ActiveTriggerAlerts) == 0 {
				logsByTrigger := map[string][]domain.TriggerLog{}
				for _, tr := range trigs[:limit] {
					if logs, err := s.triggerSvc.ListTriggerLogs(tr.ID, userID); err == nil && len(logs) > 0 {
						logsByTrigger[tr.ID] = logs
					}
				}
				input.ActiveTriggerAlerts = assistant.CollectTriggerAlerts(trigs[:limit], logsByTrigger, 3)
			}
			// Telemetria compacta de radares (§8.5).
			input.AppStateFlags = append(input.AppStateFlags,
				fmt.Sprintf("radares_ativos:%d", len(trigs[:limit])),
				fmt.Sprintf("alertas_radar_nao_lidos:%d", len(input.ActiveTriggerAlerts)),
			)
		}
	}

	// Carrega links de agendamento ativos do usuário (Vito Booking)
	if len(input.ActiveBookings) == 0 && s.bookingSvc != nil {
		if bts, err := s.bookingSvc.ListBookingTypes(ctx, userID); err == nil && len(bts) > 0 {
			for _, bt := range bts {
				if bt.IsActive {
					url := bt.ShortURL
					if url == "" {
						url = bt.PublicURL
					}
					input.ActiveBookings = append(input.ActiveBookings, assistant.FormatBookingLine(bt.Title, bt.DurationMinutes, bt.StartHour, bt.EndHour, url))
				}
			}
		}
	}

	// Carrega agendamentos recebidos de convidados (Vito Booking)
	if len(input.UpcomingAppointments) == 0 && s.bookingSvc != nil {
		from := input.Now.Add(-1 * 24 * time.Hour)
		to := input.Now.Add(30 * 24 * time.Hour)
		if appts, err := s.bookingSvc.ListAppointments(ctx, userID, from, to); err == nil && len(appts) > 0 {
			loc := userLocation(input.Timezone)
			for _, ap := range appts {
				if ap.Status != "cancelled" {
					apStart, apEnd := ap.StartAt.In(loc), ap.EndAt.In(loc)
					input.UpcomingAppointments = append(input.UpcomingAppointments, fmt.Sprintf("Convidado %s (%s, %s às %s - %s) [ID: %s]",
						ap.GuestName, ap.GuestEmail, apStart.Format("02/01/2006"), apStart.Format("15:04"), apEnd.Format("15:04"), ap.ID,
					))
				}
			}
		}
	}
}

func userLocation(timezone string) *time.Location {
	if timezone != "" {
		if loc, err := time.LoadLocation(timezone); err == nil {
			return loc
		}
	}
	return time.FixedZone("BRT", -3*3600)
}

// isHolidayLikeEvent identifica feriados/datas comemorativas (ex: calendário de
// feriados do Google): categoria holiday/feriado sempre; por título, só quando
// dia inteiro (dura >= 20h ou ancora na meia-noite) para não excluir
// compromissos reais com nome parecido ("Jantar de Natal 20h" continua evento).
func isHolidayLikeEvent(ev domain.Event) bool {
	cat := strings.ToLower(strings.TrimSpace(ev.Category))
	if cat == "holiday" || cat == "feriado" {
		return true
	}
	combined := strings.ToLower(strings.TrimSpace(ev.Title + " " + ev.Description))
	matched := false
	for _, kw := range holidayQueryKeywords {
		if strings.Contains(combined, kw) {
			matched = true
			break
		}
	}
	if !matched {
		return false
	}
	if ev.EndAt.Sub(ev.StartAt) >= 20*time.Hour {
		return true
	}
	if ev.StartAt.Hour() == 0 && ev.StartAt.Minute() == 0 {
		return true
	}
	return false
}

// queryDayLabel rotula o dia consultado em linguagem natural: hoje/amanhã ou
// dia da semana com data (ex: "sábado (17/10)"). Sem data-alvo, vale hoje.
func queryDayLabel(now, target time.Time) string {
	ymd := func(t time.Time) string { return t.Format("2006-01-02") }
	switch ymd(target) {
	case ymd(now):
		return "hoje"
	case ymd(now.Add(24 * time.Hour)):
		return "amanhã"
	default:
		return fmt.Sprintf("no %s (%s)",
			strings.ToLower(ai.WeekdayPT(target.Weekday())), target.Format("02/01"))
	}
}
