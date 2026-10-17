package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// executeAction despacha a ação pretendida pela IA para os serviços correspondentes do sistema.
func (s *AssistantService) executeAction(ctx context.Context, userID string, intent *ai.ParsedIntent, input ai.UserInput, res *AssistantResponse) (*AssistantResponse, error) {
	switch intent.Action {
	case ai.ActionCreateEvent:
		if intent.Event == nil {
			return clarificationResponse(intent, "Claro! Para criar seu evento preciso de 3 coisas: 1) Qual o nome do evento? 2) Qual dia (ex: amanhã, 20/10 ou sexta)? 3) Qual horário (ex: 14h)? Se não souber o horário, sugiro 09:00, 14:00 ou 19:00 — qual prefere?"), nil
		}
		if strings.TrimSpace(intent.Event.Title) == "" || intent.Event.StartAt.IsZero() {
			missing := []string{}
			if strings.TrimSpace(intent.Event.Title) == "" {
				missing = append(missing, "o nome do evento")
			}
			if intent.Event.StartAt.IsZero() {
				missing = append(missing, "a data e o horário (ex: amanhã às 14h)")
			}
			return clarificationResponse(intent, fmt.Sprintf("Quase lá! Para agendar, só me diga %s. Se não souber o horário, sugiro 09:00, 14:00 ou 19:00 — qual prefere? E é evento único ou recorrente (todo dia/semana/mês)?", strings.Join(missing, " e "))), nil
		}
		if s.calSvc == nil {
			log.Printf("⚠️ [AssistantService] CalendarService indisponível para CREATE_EVENT (user=%s)", userID)
			res.Message = "Não consegui acessar sua agenda agora por instabilidade interna. Nada foi criado. Tente novamente em instantes ou diga o evento completo (ex: 'Dentista amanhã às 14h')."
			res.Reply = res.Message
			return res, nil
		}
		if intent.Event.EndAt.IsZero() || intent.Event.EndAt.Before(intent.Event.StartAt) || intent.Event.EndAt.Equal(intent.Event.StartAt) {
			intent.Event.EndAt = intent.Event.StartAt.Add(1 * time.Hour)
		}
		if intent.Event.Recurrence != "" {
			count := occurrencesUntil(intent.Event.StartAt, intent.Event.RecurrenceUntil, intent.Event.Recurrence, 8)
			events, err := s.calSvc.CreateRecurringEvents(
				userID,
				intent.Event.Title,
				intent.Event.Description,
				intent.Event.Location,
				intent.Event.StartAt,
				intent.Event.EndAt,
				intent.Event.Recurrence,
				count,
			)
			if err != nil {
				log.Printf("⚠️ [AssistantService] Falha ao criar série recorrente (user=%s, title=%q): %v", userID, intent.Event.Title, err)
				res.Message = fmt.Sprintf("Não consegui criar a série '%s' agora (%v). Nada foi agendado. Confira os dados ou tente de novo em instantes — ex: 'Aula de inglês todo sábado das 8h às 11h'.", intent.Event.Title, err)
				res.Reply = res.Message
				return res, nil
			}
			if len(events) > 0 {
				res.Event = events[0]
			}
			if res.Message == "" || res.Message == defaultMessageFor(ai.ActionCreateEvent) {
				res.Message = fmt.Sprintf("Agendei '%s' como compromisso recorrente (%s) na sua agenda!", intent.Event.Title, strings.ToLower(intent.Event.Recurrence))
				res.Reply = res.Message
			}
		} else {
			event, conflict, err := s.calSvc.CreateEvent(
				userID,
				intent.Event.Title,
				intent.Event.Description,
				intent.Event.Location,
				intent.Event.StartAt,
				intent.Event.EndAt,
			)
			if err != nil {
				log.Printf("⚠️ [AssistantService] Falha ao criar evento (user=%s, title=%q): %v", userID, intent.Event.Title, err)
				if strings.Contains(err.Error(), "título do evento é obrigatório") {
					return clarificationResponse(intent, "Para agendar, qual o nome do evento? Ex: 'Dentista', 'Reunião com João'. E qual dia e horário (ex: amanhã às 14h)?"), nil
				}
				res.Message = fmt.Sprintf("Não consegui criar '%s' agora (%v). Nada foi agendado. Tente de novo em instantes ou diga o evento completo (ex: 'Dentista amanhã às 14h').", intent.Event.Title, err)
				res.Reply = res.Message
				return res, nil
			}

			res.Event = event
			res.Conflict = conflict
			if conflict != nil && conflict.HasConflict {
				res.Message += fmt.Sprintf("\n\n⚠️ Conflito de agenda: você já tem '%s' nesse mesmo horário.", conflict.ConflictingTitle)
				if len(conflict.SuggestedSlots) > 0 {
					var slotLabels []string
					for _, sl := range conflict.SuggestedSlots {
						slotLabels = append(slotLabels, sl.Label)
					}
					res.Message += fmt.Sprintf(" Para evitar o choque, sugiro remanejar para %s. Deseja que eu agende em algum desses horários ou prefere remarcar o compromisso anterior?", strings.Join(slotLabels, " ou "))
				} else {
					res.Message += " Deseja que eu procure outro horário livre para você ou prefere que eu altere o compromisso anterior?"
				}
			}
			res.Reply = res.Message
		}

	case ai.ActionDeleteEvent:
		if intent.Event == nil {
			return clarificationResponse(intent, "Qual compromisso devo excluir? Me diga o nome (ex: 'exclua a aula de inglês')."), nil
		}
		target := intent.Event.TargetQuery
		if target == "" {
			target = intent.Event.Title
		}
		if strings.TrimSpace(target) == "" {
			return clarificationResponse(intent, "Qual compromisso devo excluir? Me diga o nome (ex: 'exclua a aula de inglês')."), nil
		}
		if s.calSvc == nil {
			log.Printf("⚠️ [AssistantService] CalendarService indisponível para DELETE_EVENT (user=%s)", userID)
			res.Message = "Não consegui acessar sua agenda agora. Nada foi excluído. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}
		// 1) Tenta resolução determinística por ID exato ([ID: ...]) antes de cair em substring de título.
		cleanID := normalizeTargetID(target)
		if existing, err := s.calSvc.GetEventByID(cleanID, userID); err == nil && existing != nil {
			if err := s.calSvc.DeleteEvent(existing.ID, userID); err != nil {
				res.Message = fmt.Sprintf("Não consegui excluir '%s' agora (%v). Nada foi alterado.", existing.Title, err)
				res.Reply = res.Message
				return res, nil
			}
			if res.Message == "" || res.Message == defaultMessageFor(ai.ActionDeleteEvent) {
				res.Message = fmt.Sprintf("Pronto! Removi o compromisso '%s' da sua agenda.", existing.Title)
			}
			res.Reply = res.Message
			return res, nil
		}
		matchingCount := s.calSvc.CountMatchingEventsByTitle(userID, target)
		if matchingCount > 1 && strings.EqualFold(strings.TrimSpace(input.AutonomyMode), "proactive") && !isExplicitDeleteConfirmation(input.Text) {
			msg := fmt.Sprintf("Identifiquei %d compromissos de '%s' na sua agenda. Por segurança, confirme abaixo se deseja realmente remover toda a série.", matchingCount, target)
			res.Action = ai.ActionNeedsClarification
			res.Intent = string(ai.ActionNeedsClarification)
			res.Message = msg
			res.Reply = msg
			res.PendingConfirmation = &DestructiveConfirmation{
				ActionType:    "DELETE_EVENT_SERIES",
				TargetTitle:   target,
				ImpactCount:   matchingCount,
				Description:   fmt.Sprintf("Esta ação removerá %d compromissos de '%s' da sua agenda.", matchingCount, target),
				ConfirmPrompt: fmt.Sprintf("Confirmar exclusão de %s", target),
			}
			return res, nil
		}
		count, err := s.calSvc.DeleteEventsByTitle(userID, target)
		if err != nil {
			log.Printf("⚠️ [AssistantService] Falha ao excluir evento(s) (user=%s, target=%q): %v", userID, target, err)
			res.Message = fmt.Sprintf("Não consegui excluir '%s' agora (%v). Nada foi alterado. Tente novamente em instantes.", target, err)
			res.Reply = res.Message
			return res, nil
		}
		if count > 1 {
			res.Message = fmt.Sprintf("Pronto! Removi a série de %d compromissos de '%s' da sua agenda.", count, target)
			res.Reply = res.Message
		} else if count == 1 {
			if res.Message == "" || res.Message == defaultMessageFor(ai.ActionDeleteEvent) {
				res.Message = fmt.Sprintf("Pronto! Removi o compromisso '%s' da sua agenda.", target)
			}
			res.Reply = res.Message
		} else {
			res.Message = fmt.Sprintf("Não encontrei nenhum compromisso chamado '%s' na sua agenda para remover. Confira o nome ou veja sua agenda de hoje.", target)
			res.Reply = res.Message
		}

	case ai.ActionUpdateEvent:
		if intent.Event == nil {
			return clarificationResponse(intent, "Qual compromisso devo reagendar e para quando? Ex: 'mude a aula de inglês para as 9h'."), nil
		}
		target := intent.Event.TargetQuery
		if target == "" {
			target = intent.Event.Title
		}
		if strings.TrimSpace(target) == "" {
			return clarificationResponse(intent, "Qual compromisso devo reagendar? Me diga o nome do evento."), nil
		}
		if intent.Event.StartAt.IsZero() || intent.Event.EndAt.IsZero() {
			return clarificationResponse(intent, fmt.Sprintf("Para reagendar '%s', para qual novo dia e horário? Ex: 'amanhã às 15h'.", target)), nil
		}
		if s.calSvc == nil {
			log.Printf("⚠️ [AssistantService] CalendarService indisponível para UPDATE_EVENT (user=%s)", userID)
			res.Message = "Não consegui acessar sua agenda agora. Nada foi alterado. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}
		// 1) Tenta resolução determinística por ID exato ([ID: ...]) antes de cair em substring de título.
		cleanID := normalizeTargetID(target)
		if existing, err := s.calSvc.GetEventByID(cleanID, userID); err == nil && existing != nil {
			existing.StartAt = intent.Event.StartAt
			existing.EndAt = intent.Event.EndAt
			if strings.TrimSpace(intent.Event.Title) != "" && intent.Event.Title != target {
				existing.Title = intent.Event.Title
			}
			updated, _, uErr := s.calSvc.UpdateEvent(userID, existing, false)
			if uErr != nil {
				res.Message = fmt.Sprintf("Não consegui reagendar '%s' agora (%v). Nada foi alterado.", existing.Title, uErr)
				res.Reply = res.Message
				return res, nil
			}
			res.Event = updated
			if res.Message == "" || res.Message == defaultMessageFor(ai.ActionUpdateEvent) {
				res.Message = fmt.Sprintf("Atualizei o horário de '%s' para %s na sua agenda.", updated.Title, updated.StartAt.Format("15:04"))
			}
			res.Reply = res.Message
			return res, nil
		}
		count, err := s.calSvc.UpdateEventTimesByTitle(userID, target, intent.Event.StartAt, intent.Event.EndAt)
		if err != nil {
			log.Printf("⚠️ [AssistantService] Falha ao atualizar evento(s) (user=%s, target=%q): %v", userID, target, err)
			res.Message = fmt.Sprintf("Não consegui reagendar '%s' agora (%v). Nada foi alterado. Tente novamente em instantes.", target, err)
			res.Reply = res.Message
			return res, nil
		}
		if count > 1 {
			res.Message = fmt.Sprintf("Pronto! Atualizei o horário de toda a série (%d compromissos de '%s') para %s.", count, target, intent.Event.StartAt.Format("15:04"))
			res.Reply = res.Message
		} else if count == 1 {
			if res.Message == "" || res.Message == defaultMessageFor(ai.ActionUpdateEvent) {
				res.Message = fmt.Sprintf("Atualizei o horário de '%s' para %s na sua agenda.", target, intent.Event.StartAt.Format("15:04"))
			}
			res.Reply = res.Message
		} else {
			res.Message = fmt.Sprintf("Não encontrei nenhum compromisso chamado '%s' na sua agenda para reagendar. Confira o nome ou veja sua agenda de hoje.", target)
			res.Reply = res.Message
		}

	case ai.ActionCreateTodo:
		if intent.Todo == nil || strings.TrimSpace(intent.Todo.Title) == "" {
			return clarificationResponse(intent, "O que devo lembrar para você? Me diga a tarefa (ex: 'Comprar café') e, se quiser, o prazo (ex: até sexta). Se não souber o prazo, sugiro hoje ou amanhã de manhã."), nil
		}
		if s.todoSvc == nil {
			log.Printf("⚠️ [AssistantService] TodoService indisponível para CREATE_TODO (user=%s)", userID)
			res.Message = "Não consegui acessar suas tarefas agora por instabilidade interna. Nada foi criado. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}
		todo, err := s.todoSvc.CreateTodoWithOptions(
			userID,
			domain.CreateTodoInput{
				Title:         intent.Todo.Title,
				Priority:      intent.Todo.Priority,
				DueDate:       intent.Todo.DueDate,
				RemindAt:      intent.Todo.RemindAt,
				RemindRepeat:  intent.Todo.RemindRepeat,
				RemindAdvance: intent.Todo.RemindAdvance,
			},
		)
		if err != nil {
			log.Printf("⚠️ [AssistantService] Falha ao criar tarefa (user=%s, title=%q): %v", userID, intent.Todo.Title, err)
			res.Message = fmt.Sprintf("Não consegui criar a tarefa '%s' agora (%v). Nada foi criado. Tente de novo com título e prazo (ex: 'Comprar café até sexta').", intent.Todo.Title, err)
			res.Reply = res.Message
			return res, nil
		}
		res.Todo = todo
		if res.Message == "" || res.Message == defaultMessageFor(ai.ActionCreateTodo) {
			res.Message = fmt.Sprintf("Anotei a tarefa '%s' para você!", todo.Title)
			res.Reply = res.Message
		}

	case ai.ActionCompleteTodo, ai.ActionDeleteTodo:
		if s.todoSvc == nil || intent.Todo == nil {
			return clarificationResponse(intent, "Qual tarefa você deseja atualizar ou remover?"), nil
		}
		target := intent.Todo.TargetQuery
		if target == "" {
			target = intent.Todo.Title
		}
		cleanID := normalizeTargetID(target)
		todos, _ := s.todoSvc.ListTodos(userID, domain.TodoStatusPending)
		var matched *domain.Todo
		for i := range todos {
			if todos[i].ID == cleanID || strings.Contains(strings.ToLower(todos[i].Title), strings.ToLower(strings.TrimSpace(target))) {
				matched = &todos[i]
				break
			}
		}
		if matched != nil {
			if intent.Action == ai.ActionCompleteTodo {
				_ = s.todoSvc.CompleteTodo(matched.ID, userID)
				if res.Message == "" {
					res.Message = fmt.Sprintf("Pronto! Marquei a tarefa '%s' como concluída.", matched.Title)
				}
			} else {
				_ = s.todoSvc.DeleteTodo(matched.ID, userID)
				if res.Message == "" {
					res.Message = fmt.Sprintf("Pronto! Removi a tarefa '%s'.", matched.Title)
				}
			}
			res.Reply = res.Message
		}

	case ai.ActionQuerySchedule:
		if s.calSvc == nil {
			log.Printf("⚠️ [AssistantService] CalendarService indisponível para QUERY_SCHEDULE (user=%s)", userID)
			res.Message = "Não consegui consultar sua agenda agora. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}
		loc := userLocation(input.Timezone)
		targetDay := input.Now.In(loc)
		hasTarget := intent.Event != nil && !intent.Event.StartAt.IsZero()
		if hasTarget {
			targetDay = intent.Event.StartAt.In(loc)
		}
		dayStartLoc := time.Date(targetDay.Year(), targetDay.Month(), targetDay.Day(), 0, 0, 0, 0, loc)
		from := dayStartLoc.UTC()
		to := dayStartLoc.Add(24 * time.Hour).UTC()
		dayLabel := queryDayLabel(input.Now.In(loc), targetDay)
		events, err := s.calSvc.ListEvents(userID, from, to)
		if err == nil {
			realEvents := make([]domain.Event, 0, len(events))
			for _, ev := range events {
				if !isHolidayLikeEvent(ev) {
					realEvents = append(realEvents, ev)
				}
			}
			events = realEvents
			if len(events) == 0 {
				res.Message = fmt.Sprintf("Você não tem nenhum compromisso %s.", dayLabel)
			} else {
				noun := "compromisso"
				if len(events) > 1 {
					noun = "compromissos"
				}
				parts := make([]string, 0, len(events))
				for _, ev := range events {
					if IsAllDayEvent(ev) {
						parts = append(parts, fmt.Sprintf("%s (Dia inteiro)", ev.Title))
					} else {
						start := ev.StartAt.In(loc).Format("15:04")
						end := ""
						if !ev.EndAt.IsZero() && ev.EndAt.After(ev.StartAt) {
							end = "–" + ev.EndAt.In(loc).Format("15:04")
						}
						parts = append(parts, fmt.Sprintf("%s, %s%s", ev.Title, start, end))
					}
				}
				res.Message = fmt.Sprintf("Você tem %d %s %s: %s.", len(events), noun, dayLabel, strings.Join(parts, "; "))
			}
			res.Reply = res.Message
		} else {
			log.Printf("⚠️ [AssistantService] Falha ao consultar agenda (user=%s): %v", userID, err)
			res.Message = fmt.Sprintf("Não consegui consultar sua agenda agora (%v). Tente novamente em instantes.", err)
			res.Reply = res.Message
			return res, nil
		}

	case ai.ActionQueryTodos:
		if s.todoSvc == nil {
			log.Printf("⚠️ [AssistantService] TodoService indisponível para QUERY_TODOS (user=%s)", userID)
			res.Message = "Não consegui consultar suas tarefas agora. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}
		todos, err := s.todoSvc.ListTodos(userID, domain.TodoStatusPending)
		if err != nil {
			log.Printf("⚠️ [AssistantService] Falha ao consultar tarefas (user=%s): %v", userID, err)
			res.Message = fmt.Sprintf("Não consegui consultar suas tarefas agora (%v). Tente novamente em instantes.", err)
			res.Reply = res.Message
			return res, nil
		}
		if len(todos) == 0 {
			res.Message = "Você não tem tarefas pendentes. Aproveite o dia!"
		} else {
			loc := userLocation(input.Timezone)
			noun := "tarefa pendente"
			if len(todos) > 1 {
				noun = "tarefas pendentes"
			}
			parts := make([]string, 0, len(todos))
			for _, td := range todos {
				due := "sem prazo"
				if td.DueDate != nil {
					due = "até " + td.DueDate.In(loc).Format("02/01 às 15:04")
				}
				parts = append(parts, fmt.Sprintf("%s (%s)", td.Title, due))
			}
			res.Message = fmt.Sprintf("Você tem %d %s: %s.", len(todos), noun, strings.Join(parts, "; "))
		}
		res.Reply = res.Message

	case ai.ActionSaveMemory:
		if s.memoryRepo != nil {
			cat := intent.MemoryCategory
			if cat == "" {
				cat = "geral"
			}
			content := intent.MemoryContent
			if content == "" {
				content = intent.Message
			}
			s.persistLearnedMemory(userID, cat, content)
			if res.Message == "" {
				res.Message = fmt.Sprintf("Guardei na minha memória: %s", content)
			}
		}

	case ai.ActionCreateTrigger:
		return s.executeCreateTrigger(userID, intent, res)

	case ai.ActionCreatePending:
		return s.executeCreatePending(userID, intent, res)

	case ai.ActionConvertPending:
		return s.executeConvertPending(userID, intent, res)

	case ai.ActionCreateBookingLink:
		return s.executeCreateBookingLink(ctx, userID, intent, input, res)

	case ai.ActionCancelBookingAppointment:
		return s.executeCancelBookingAppointment(ctx, userID, intent, input, res)

	case ai.ActionCreateMeeting:
		return s.executeCreateMeeting(ctx, userID, intent, input, res)

	default:
		if res.Message == "" {
			res.Message = "Não entendi bem o pedido. Pode dizer de novo com mais detalhes? Ex: 'Criar evento Dentista amanhã às 14h', 'Criar tarefa Comprar café até sexta' ou 'Criar radar da PETR3 todo dia às 08:30'."
			res.Reply = res.Message
		}
	}

	return res, nil
}
