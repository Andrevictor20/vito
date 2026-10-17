package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/assistant"
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
		if intent.Event != nil {
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
		} else {
			return clarificationResponse(intent, "Qual compromisso devo excluir? Me diga o nome (ex: 'exclua a aula de inglês')."), nil
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
		if intent.Trigger == nil || (strings.TrimSpace(intent.Trigger.Title) == "" && strings.TrimSpace(intent.Trigger.Query) == "") {
			return clarificationResponse(intent, "Sobre o que quer criar a vigília? Me diga o tema (ex: PETR3, voos para Lisboa, jogo do Flamengo), e se quiser um valor alvo e horário (ex: todo dia às 08:30). Se não souber, sugiro resumo diário às 08:30 — topa?"), nil
		}
		if s.triggerSvc == nil {
			log.Printf("⚠️ [AssistantService] TriggerService indisponível para CREATE_TRIGGER (user=%s)", userID)
			res.Message = "Não consegui acessar os radares agora por instabilidade interna. Nada foi criado. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}
		cat := domain.TriggerCategory(intent.Trigger.Category)
		freq := domain.TriggerFrequency(intent.Trigger.Frequency)
		cond := domain.TriggerConditionType(intent.Trigger.ConditionType)
		title := strings.TrimSpace(intent.Trigger.Title)
		query := strings.TrimSpace(intent.Trigger.Query)
		if title == "" {
			title = query
		}
		if query == "" {
			query = title
		}
		trig, err := s.triggerSvc.CreateTrigger(userID, domain.CreateTriggerInput{
			Title:         title,
			Category:      cat,
			Query:         query,
			TargetValue:   intent.Trigger.TargetValue,
			ConditionType: cond,
			Frequency:     freq,
			ScheduledTime: intent.Trigger.ScheduledTime,
			DaysOfWeek:    intent.Trigger.DaysOfWeek,
		})
		if err != nil {
			log.Printf("⚠️ [AssistantService] Falha ao criar radar (user=%s, title=%q): %v", userID, title, err)
			if strings.Contains(err.Error(), "título") || strings.Contains(err.Error(), "consulta") || strings.Contains(err.Error(), "comando") {
				return clarificationResponse(intent, fmt.Sprintf("Para criar a vigília preciso de mais um detalhe: %v. Ex: 'Monitore a PETR3 acima de R$ 35 todo dia às 08:30'.", err)), nil
			}
			res.Message = fmt.Sprintf("Não consegui criar o radar '%s' agora (%v). Nada foi criado. Tente de novo em instantes.", title, err)
			res.Reply = res.Message
			return res, nil
		}
		res.Trigger = trig
		if res.Message == "" || res.Message == defaultMessageFor(ai.ActionCreateTrigger) {
			res.Message = fmt.Sprintf("Pronto! Criei o radar '%s' e já iniciei a vigília para você.", trig.Title)
			res.Reply = res.Message
		}
		res.Reply = res.Message

	case ai.ActionCreatePending:
		if intent.Pending == nil || strings.TrimSpace(intent.Pending.Title) == "" {
			return clarificationResponse(intent, "O que devo guardar nas Pendências? Me diga o título (ex: 'Trocar o filtro do ar') e, se quiser, uma data futura (ex: 20/10)."), nil
		}
		if s.pendingSvc == nil {
			log.Printf("⚠️ [AssistantService] PendingService indisponível para CREATE_PENDING (user=%s)", userID)
			res.Message = "Não consegui acessar as Pendências agora por instabilidade interna. Nada foi criado. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}
		item, err := s.pendingSvc.CreatePending(userID, domain.CreatePendingInput{
			Title:         intent.Pending.Title,
			Description:   intent.Pending.Description,
			Category:      intent.Pending.Category,
			ScheduledDate: intent.Pending.ScheduledDate,
			RemindAt:      intent.Pending.RemindAt,
			RemindRepeat:  intent.Pending.RemindRepeat,
			RemindAdvance: intent.Pending.RemindAdvance,
		})
		if err != nil {
			log.Printf("⚠️ [AssistantService] Falha ao criar pendência (user=%s, title=%q): %v", userID, intent.Pending.Title, err)
			res.Message = fmt.Sprintf("Não consegui guardar '%s' nas Pendências agora (%v). Nada foi criado. Tente de novo em instantes.", intent.Pending.Title, err)
			res.Reply = res.Message
			return res, nil
		}
		res.Pending = item
		if res.Message == "" || res.Message == defaultMessageFor(ai.ActionCreatePending) {
			res.Message = fmt.Sprintf("Guardei '%s' nas suas Pendências!", item.Title)
			res.Reply = res.Message
		}

	case ai.ActionConvertPending:
		if intent.Event == nil || strings.TrimSpace(intent.Event.Title) == "" {
			return clarificationResponse(intent, "Qual pendência devo agendar e para quando? Me diga o nome e o dia/horário (ex: 'Dentista amanhã às 14h')."), nil
		}
		if s.calSvc == nil {
			log.Printf("⚠️ [AssistantService] CalendarService indisponível para CONVERT_PENDING (user=%s)", userID)
			res.Message = "Não consegui acessar sua agenda agora. Nada foi agendado. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}
		if intent.Event.StartAt.IsZero() {
			return clarificationResponse(intent, fmt.Sprintf("Para agendar '%s', qual dia e horário? Ex: amanhã às 14h. Se não souber, sugiro 09:00, 14:00 ou 19:00.", intent.Event.Title)), nil
		}
		if intent.Event.EndAt.IsZero() || intent.Event.EndAt.Before(intent.Event.StartAt) || intent.Event.EndAt.Equal(intent.Event.StartAt) {
			intent.Event.EndAt = intent.Event.StartAt.Add(1 * time.Hour)
		}
		event, conflict, err := s.calSvc.CreateEvent(
			userID,
			intent.Event.Title,
			intent.Event.Description,
			intent.Event.Location,
			intent.Event.StartAt,
			intent.Event.EndAt,
		)
		if err != nil {
			log.Printf("⚠️ [AssistantService] Falha ao agendar pendência (user=%s, title=%q): %v", userID, intent.Event.Title, err)
			res.Message = fmt.Sprintf("Não consegui agendar '%s' agora (%v). Nada foi criado. Tente de novo em instantes.", intent.Event.Title, err)
			res.Reply = res.Message
			return res, nil
		}
		res.Event = event
		res.Conflict = conflict
		if intent.Pending != nil && intent.Pending.ID != "" && s.pendingSvc != nil {
			_, _ = s.pendingSvc.CompletePending(intent.Pending.ID, userID)
		}
		if res.Message == "" || res.Message == defaultMessageFor(ai.ActionConvertPending) {
			res.Message = fmt.Sprintf("Agendei '%s' para %s e atualizei a pendência!", event.Title, event.StartAt.Format("02/01 às 15:04"))
			res.Reply = res.Message
		}

	case ai.ActionCreateBookingLink:
		if intent.Booking == nil {
			return clarificationResponse(intent, "Claro! Para gerar seu link de agendamento preciso de: 1) Nome do encontro (ex: Café rápido)? 2) Duração (15, 30, 45 ou 60 min — sugiro 30)? 3) Janela de atendimento (ex: 09:00 às 18:00)? 4) Dias (úteis, fim de semana ou todos — sugiro todos)?"), nil
		}
		if strings.TrimSpace(intent.Booking.Title) == "" && strings.TrimSpace(intent.Booking.Description) == "" && strings.TrimSpace(intent.Booking.Slug) == "" && isVagueBookingRequest(input.Text) {
			return clarificationResponse(intent, "Claro! Para gerar seu link de agendamento preciso de: 1) Nome do encontro (ex: Café rápido)? 2) Duração (15, 30, 45 ou 60 min — sugiro 30)? 3) Janela de atendimento (ex: 09:00 às 18:00)? 4) Dias (úteis, fim de semana ou todos — sugiro todos)?"), nil
		}
		if s.bookingSvc == nil {
			log.Printf("⚠️ [AssistantService] BookingService indisponível para CREATE_BOOKING (user=%s)", userID)
			res.Message = "Não consegui acessar o Vito Booking agora por instabilidade interna. Nada foi criado. Tente novamente em instantes ou crie pelo menu Vito Booking."
			res.Reply = res.Message
			return res, nil
		}
		title := intent.Booking.Title
		if title == "" {
			title = "Reunião de Alinhamento"
		}
		dur := intent.Booking.DurationMinutes
		if dur <= 0 {
			dur = 30
		}
		buf := intent.Booking.BufferMinutes
		if buf < 0 {
			buf = 10
		}
		sh := intent.Booking.StartHour
		if sh == "" {
			sh = "09:00"
		}
		eh := intent.Booking.EndHour
		if eh == "" {
			eh = "18:00"
		}
		if startH, startM, errS := parseHour(sh); errS == nil {
			endH, endM, errE := parseHour(eh)
			if errE != nil || (endH*60+endM) <= (startH*60+startM) {
				targetEndMin := startH*60 + startM + dur
				if targetEndMin > 22*60 {
					targetEndMin = 22 * 60
				}
				if targetEndMin <= startH*60+startM {
					targetEndMin = startH*60 + startM + 30
				}
				if targetEndMin > 23*60+59 {
					targetEndMin = 23*60 + 59
				}
				eh = fmt.Sprintf("%02d:%02d", targetEndMin/60, targetEndMin%60)
			}
		}
		slug := intent.Booking.Slug
		if slug == "" {
			slug = assistant.SlugifyBookingTitle(title)
			slug = fmt.Sprintf("%s-%d", slug, time.Now().Unix()%10000)
		}
		dow := strings.TrimSpace(intent.Booking.DaysOfWeek)
		if dow == "" {
			dow = inferBookingDaysOfWeek(input.Text)
		}
		loc := userLocation(input.Timezone)
		nowLoc := input.Now.In(loc)
		validFrom := time.Date(nowLoc.Year(), nowLoc.Month(), nowLoc.Day(), 0, 0, 0, 0, loc).UTC()
		validUntil := validFrom.AddDate(0, 0, 7)
		if vu := strings.TrimSpace(intent.Booking.ValidUntil); vu != "" {
			if parsed, err := time.ParseInLocation("2006-01-02", vu[:min(10, len(vu))], loc); err == nil {
				validUntil = time.Date(parsed.Year(), parsed.Month(), parsed.Day(), 23, 59, 59, 0, loc).UTC()
			}
		}
		bt, err := s.bookingSvc.CreateBookingType(ctx, userID, &domain.BookingType{
			Title:           title,
			Slug:            slug,
			Description:     intent.Booking.Description,
			DurationMinutes: dur,
			BufferMinutes:   buf,
			StartHour:       sh,
			EndHour:         eh,
			DaysOfWeek:      dow,
			ValidFrom:       &validFrom,
			ValidUntil:      &validUntil,
		})
		if err != nil {
			log.Printf("⚠️ [AssistantService] Erro ao criar booking type via chat: %v", err)
			res.Message = fmt.Sprintf("Não consegui gerar o link de agendamento no momento (%v). Nada foi criado. Você também pode criá-lo pelo menu Vito Booking.", err)
			res.Reply = res.Message
		} else {
			res.Booking = &bt.BookingType
			linkURL := bt.ShortURL
			if linkURL == "" {
				linkURL = bt.PublicURL
			}
			res.BookingURL = bt.PublicURL
			res.BookingShort = bt.ShortURL
			res.Message = fmt.Sprintf("Criei o seu link de agendamento para '%s' (%d min):\n%s", bt.Title, bt.DurationMinutes, linkURL)
			res.Reply = res.Message
		}

	case ai.ActionCancelBookingAppointment:
		if intent.Booking == nil || (strings.TrimSpace(intent.Booking.TargetQuery) == "" && strings.TrimSpace(intent.Booking.Title) == "") {
			return clarificationResponse(intent, "Qual agendamento devo cancelar? Me diga o nome do convidado, e-mail ou assunto (ex: 'cancele a Maria')."), nil
		}
		if s.bookingSvc == nil {
			log.Printf("⚠️ [AssistantService] BookingService indisponível para CANCEL_APPOINTMENT (user=%s)", userID)
			res.Message = "Não consegui acessar os agendamentos agora. Nada foi cancelado. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}
		query := strings.TrimSpace(intent.Booking.TargetQuery)
		if query == "" {
			query = strings.TrimSpace(intent.Booking.Title)
		}
		if query != "" {
			from := input.Now.Add(-30 * 24 * time.Hour)
			to := input.Now.Add(90 * 24 * time.Hour)
			appts, err := s.bookingSvc.ListAppointments(ctx, userID, from, to)
			if err != nil {
				log.Printf("⚠️ [AssistantService] Falha ao listar agendamentos (user=%s): %v", userID, err)
				res.Message = fmt.Sprintf("Não consegui listar seus agendamentos agora (%v). Nada foi cancelado. Tente novamente em instantes.", err)
				res.Reply = res.Message
				return res, nil
			}
			var targetAppt *domain.BookingAppointment
			qLower := strings.ToLower(query)
			for i := range appts {
				a := &appts[i]
				if a.ID == query ||
					strings.Contains(strings.ToLower(a.GuestName), qLower) ||
					strings.Contains(strings.ToLower(a.GuestEmail), qLower) {
					targetAppt = a
					break
				}
			}
			if targetAppt != nil {
				if err := s.bookingSvc.CancelAppointment(ctx, userID, targetAppt.ID); err != nil {
					log.Printf("⚠️ [AssistantService] Falha ao cancelar agendamento (user=%s, appt=%s): %v", userID, targetAppt.ID, err)
					res.Message = fmt.Sprintf("Não consegui cancelar o agendamento de %s agora (%v). Nada foi alterado. Tente novamente em instantes.", targetAppt.GuestName, err)
					res.Reply = res.Message
					return res, nil
				}
				res.Message = fmt.Sprintf("Cancelei o agendamento de %s e liberei o horário na sua agenda.", targetAppt.GuestName)
				res.Reply = res.Message
			} else {
				res.Message = fmt.Sprintf("Não localizei nenhum agendamento correspondente a '%s'. Me diga o nome do convidado ou e-mail exato?", query)
				res.Reply = res.Message
			}
		} else {
			return clarificationResponse(intent, "Qual agendamento devo cancelar? Me diga o nome do convidado, e-mail ou assunto."), nil
		}

	case ai.ActionCreateMeeting:
		if intent.Meeting == nil || strings.TrimSpace(intent.Meeting.Title) == "" {
			return clarificationResponse(intent, "Qual o assunto ou título da reunião que você deseja agendar? (Ex: 'Reunião de alinhamento com Carlos')"), nil
		}
		if s.meetingSvc == nil {
			log.Printf("⚠️ [AssistantService] MeetingService indisponível para CREATE_MEETING (user=%s)", userID)
			res.Message = "O serviço de reuniões está temporariamente indisponível. Nada foi criado. Tente novamente em instantes."
			res.Reply = res.Message
			return res, nil
		}

		dur := intent.Meeting.DurationMinutes
		if dur <= 0 {
			dur = 45
		}
		mode := intent.Meeting.Mode
		if mode != domain.MeetingModeGroupConsensus {
			mode = domain.MeetingModeOneOnOne
		}

		var slots []MeetingSlotInput
		for _, sl := range intent.Meeting.Slots {
			if !sl.StartAt.IsZero() && !sl.EndAt.IsZero() && sl.EndAt.After(sl.StartAt) {
				slots = append(slots, MeetingSlotInput{
					StartAt: sl.StartAt,
					EndAt:   sl.EndAt,
				})
			}
		}

		// Se a IA não forneceu slots explícitos, gera 3 opções nos próximos dias úteis
		if len(slots) == 0 {
			now := input.Now
			loc := now.Location()
			baseDate := now.Add(24 * time.Hour)
			for d := 0; d < 3; d++ {
				slotDate := baseDate.AddDate(0, 0, d)
				hour := 10 + d*3
				st := time.Date(slotDate.Year(), slotDate.Month(), slotDate.Day(), hour, 0, 0, 0, loc)
				et := st.Add(time.Duration(dur) * time.Minute)
				slots = append(slots, MeetingSlotInput{
					StartAt: st,
					EndAt:   et,
				})
			}
		}

		mDetails, err := s.meetingSvc.CreateMeeting(ctx, CreateMeetingRequest{
			UserID:          userID,
			Title:           intent.Meeting.Title,
			Description:     intent.Meeting.Description,
			DurationMinutes: dur,
			Mode:            mode,
			Slots:           slots,
		})
		if err != nil {
			log.Printf("⚠️ [AssistantService] Erro ao criar reunião via chat: %v", err)
			res.Message = fmt.Sprintf("Não consegui criar a reunião no momento (%v). Nada foi criado.", err)
			res.Reply = res.Message
		} else {
			res.Meeting = mDetails
			linkURL := mDetails.ShortURL
			if linkURL == "" {
				linkURL = mDetails.PublicURL
			}
			res.MeetingURL = mDetails.PublicURL
			res.MeetingShort = mDetails.ShortURL

			share, _ := s.meetingSvc.GenerateWhatsAppShare(ctx, userID, mDetails.ID)
			if share != nil {
				res.MeetingWhatsApp = share.WhatsAppDeepLink
			}

			if mode == domain.MeetingModeOneOnOne {
				res.Message = fmt.Sprintf("Criei o link mágico para a reunião '%s' (%d min) com %d opções de horários:\n%s\n\nVocê pode copiar o link ou enviar direto pelo WhatsApp!", mDetails.Title, mDetails.DurationMinutes, len(mDetails.Slots), linkURL)
			} else {
				res.Message = fmt.Sprintf("Criei a votação de consenso em grupo para a reunião '%s' com %d horários disponíveis:\n%s", mDetails.Title, len(mDetails.Slots), linkURL)
			}
			res.Reply = res.Message
		}

	default:
		if res.Message == "" {
			res.Message = "Não entendi bem o pedido. Pode dizer de novo com mais detalhes? Ex: 'Criar evento Dentista amanhã às 14h', 'Criar tarefa Comprar café até sexta' ou 'Criar radar da PETR3 todo dia às 08:30'."
			res.Reply = res.Message
		}
	}

	return res, nil
}
