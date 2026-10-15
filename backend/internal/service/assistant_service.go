package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/assistant"
)

// AIParsingGateway contrato para desacoplar a IA do serviço.
type AIParsingGateway interface {
	ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error)
}

// AssistantResponse representa o retorno da interação com a secretária Vito.
type AssistantResponse struct {
	Action       ai.IntentAction      `json:"action"`
	Intent       string               `json:"intent,omitempty"`
	Message      string               `json:"message"`
	Reply        string               `json:"reply,omitempty"`
	Event        *domain.Event        `json:"event,omitempty"`
	Conflict     *domain.ConflictInfo `json:"conflict,omitempty"`
	Todo         *domain.Todo         `json:"todo,omitempty"`
	Trigger      *domain.Trigger      `json:"trigger,omitempty"`
	Pending      *domain.PendingItem  `json:"pending,omitempty"`
	Booking      *domain.BookingType  `json:"booking,omitempty"`
	BookingURL   string               `json:"booking_url,omitempty"`
	BookingShort string               `json:"booking_short_url,omitempty"`
	ProviderUsed string               `json:"provider_used,omitempty"`
}

// AssistantService orquestra o parsing de IA com os serviços de calendário, tarefas, memórias e disparadores.
type AssistantService struct {
	aiGateway      AIParsingGateway
	calSvc         *CalendarService
	todoSvc        *TodoService
	memoryRepo     domain.MemoryRepository
	triggerSvc     *TriggerService
	pendingSvc     *PendingService
	bookingSvc     *BookingService
	userRepo       domain.UserRepository
	aiSettingsRepo domain.AISettingsRepository
}

// NewAssistantService instancia o serviço do assistente.
func NewAssistantService(aiGateway AIParsingGateway, calSvc *CalendarService, todoSvc *TodoService, memoryRepo domain.MemoryRepository, triggerSvc ...*TriggerService) *AssistantService {
	var ts *TriggerService
	if len(triggerSvc) > 0 {
		ts = triggerSvc[0]
	}
	return &AssistantService{
		aiGateway:  aiGateway,
		calSvc:     calSvc,
		todoSvc:    todoSvc,
		memoryRepo: memoryRepo,
		triggerSvc: ts,
	}
}

// SetBookingService injeta o serviço de Vito Booking.
func (s *AssistantService) SetBookingService(bookingSvc *BookingService) {
	s.bookingSvc = bookingSvc
}

// SetPendingService injeta o serviço da Incubadora de Pendências.
func (s *AssistantService) SetPendingService(pendingSvc *PendingService) {
	s.pendingSvc = pendingSvc
}

// SetUserRepository configura o repositório de usuários para enriquecimento do perfil.
func (s *AssistantService) SetUserRepository(repo domain.UserRepository) {
	s.userRepo = repo
}

// SetAISettingsRepository configura o repositório de preferências de IA e autonomia.
func (s *AssistantService) SetAISettingsRepository(repo domain.AISettingsRepository) {
	s.aiSettingsRepo = repo
}

// Process recebe o input (voz/texto), invoca a IA e aplica a ação no banco de dados.
func (s *AssistantService) Process(ctx context.Context, userID string, input ai.UserInput) (*AssistantResponse, error) {
	if input.Now.IsZero() {
		input.Now = time.Now().UTC()
	}

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

	// Validação básica de input vazio
	if strings.TrimSpace(input.Text) == "" && input.AudioB64 == "" && input.ImageB64 == "" {
		msg := "Olá! Como posso ajudar com sua agenda ou tarefas hoje?"
		return &AssistantResponse{
			Action:       ai.ActionGeneralChat,
			Intent:       string(ai.ActionGeneralChat),
			Message:      msg,
			Reply:        msg,
			ProviderUsed: "system",
		}, nil
	}

	// Memória episódica sob demanda: top relevantes (similaridade+importância+recência).
	// O reforço por uso acontece dentro do SearchRelevant (§8.3).
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
			input.ActiveSchedule = append(input.ActiveSchedule, assistant.FormatScheduleLine(ev, loc))
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

	intent, err := s.aiGateway.ParseIntent(ctx, input)
	if err != nil {
		return nil, fmt.Errorf("falha ao interpretar comando com IA: %w", err)
	}

	// Coerção resiliente: se o texto pede booking por sinônimo mas a IA retornou CREATE_EVENT,
	// corrige para CREATE_BOOKING_LINK para criação direta sem fricção.
	if intent.Action == ai.ActionCreateEvent && intent.Event != nil && s.bookingSvc != nil {
		if isBookingIntentText(input.Text) {
			intent.Action = ai.ActionCreateBookingLink
			if intent.Booking == nil {
				intent.Booking = &ai.ParsedBooking{}
			}
			if intent.Booking.Title == "" {
				intent.Booking.Title = intent.Event.Title
			}
			if intent.Booking.Description == "" {
				intent.Booking.Description = intent.Event.Description
			}
		}
	}

	// Aprendizado contínuo autônomo: se a IA captou um fato/preferência/rotina, grava de forma perene no SQLite
	if s.memoryRepo != nil && strings.TrimSpace(intent.MemoryContent) != "" {
		s.persistLearnedMemory(userID, intent.MemoryCategory, intent.MemoryContent)
	}

	res := &AssistantResponse{
		Action:       intent.Action,
		Intent:       string(intent.Action),
		Message:      intent.Message,
		Reply:        intent.Message,
		ProviderUsed: intent.ProviderUsed,
	}
	if res.Message == "" {
		res.Message = defaultMessageFor(intent.Action)
		res.Reply = res.Message
	}

	// Perguntas de esclarecimento: nunca tocam no banco, só devolvem a pergunta.
	if intent.Action == ai.ActionNeedsClarification {
		res.Action = ai.ActionNeedsClarification
		res.Intent = string(ai.ActionNeedsClarification)
		return res, nil
	}

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
				// Título obrigatório (IA alucinou vazio) vira pergunta, não erro genérico.
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
			{
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
			}
		} else {
			return clarificationResponse(intent, "Qual compromisso devo excluir? Me diga o nome (ex: 'exclua a aula de inglês')."), nil
		}

	case ai.ActionUpdateEvent:
		if intent.Event == nil {
			return clarificationResponse(intent, "Qual compromisso devo reagendar e para quando? Ex: 'mude a aula de inglês para as 9h'."), nil
		}
		{
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
			{
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
			}
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
		from := input.Now.Truncate(24 * time.Hour)
		to := from.Add(24 * time.Hour)
		events, err := s.calSvc.ListEvents(userID, from, to)
		if err == nil {
			if len(events) == 0 {
				res.Message = "Você não tem nenhum compromisso agendado para hoje."
			} else {
				// Lista o quê (não só quantos): responde "qual compromisso?" de uma vez.
				loc := userLocation(input.Timezone)
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
				res.Message = fmt.Sprintf("Você tem %d %s hoje: %s.", len(events), noun, strings.Join(parts, "; "))
			}
			res.Reply = res.Message
		} else {
			log.Printf("⚠️ [AssistantService] Falha ao consultar agenda (user=%s): %v", userID, err)
			res.Message = fmt.Sprintf("Não consegui consultar sua agenda agora (%v). Tente novamente em instantes.", err)
			res.Reply = res.Message
			return res, nil
		}

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
		{
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
		}

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
		{
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
		{
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
		}

	case ai.ActionCreateBookingLink:
		if intent.Booking == nil {
			return clarificationResponse(intent, "Claro! Para gerar seu link de agendamento preciso de: 1) Nome do encontro (ex: Café rápido)? 2) Duração (15, 30, 45 ou 60 min — sugiro 30)? 3) Janela de atendimento (ex: 09:00 às 18:00)? 4) Dias (úteis, fim de semana ou todos — sugiro todos)?"), nil
		}
		// Pedido vago sem nenhum detalhe vira pergunta, não criação com defaults silenciosos.
		// Checado ANTES da disponibilidade do serviço para não mascarar pergunta com "instabilidade".
		if strings.TrimSpace(intent.Booking.Title) == "" && strings.TrimSpace(intent.Booking.Description) == "" && strings.TrimSpace(intent.Booking.Slug) == "" && isVagueBookingRequest(input.Text) {
			return clarificationResponse(intent, "Claro! Para gerar seu link de agendamento preciso de: 1) Nome do encontro (ex: Café rápido)? 2) Duração (15, 30, 45 ou 60 min — sugiro 30)? 3) Janela de atendimento (ex: 09:00 às 18:00)? 4) Dias (úteis, fim de semana ou todos — sugiro todos)?"), nil
		}
		if s.bookingSvc == nil {
			log.Printf("⚠️ [AssistantService] BookingService indisponível para CREATE_BOOKING (user=%s)", userID)
			res.Message = "Não consegui acessar o Vito Booking agora por instabilidade interna. Nada foi criado. Tente novamente em instantes ou crie pelo menu Vito Booking."
			res.Reply = res.Message
			return res, nil
		}
		{
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
			// Garante que o fim da janela seja estritamente após o início
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
			bt, err := s.bookingSvc.CreateBookingType(ctx, userID, &domain.BookingType{
				Title:           title,
				Slug:            slug,
				Description:     intent.Booking.Description,
				DurationMinutes: dur,
				BufferMinutes:   buf,
				StartHour:       sh,
				EndHour:         eh,
				DaysOfWeek:      dow,
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
		{
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
		}
	default:
		// Ação desconhecida: nunca quebrar o chat com 500; explica e orienta.
		if res.Message == "" {
			res.Message = "Não entendi bem o pedido. Pode dizer de novo com mais detalhes? Ex: 'Criar evento Dentista amanhã às 14h', 'Criar tarefa Comprar café até sexta' ou 'Criar radar da PETR3 todo dia às 08:30'."
			res.Reply = res.Message
		}
	}

	// Sincroniza Reply com Message para o mobile sempre exibir o motivo.
	res.Reply = res.Message

	return res, nil
}

func (s *AssistantService) persistLearnedMemory(userID, category, content string) {
	content = strings.TrimSpace(content)
	if content == "" {
		return
	}
	if category == "" {
		category = "geral"
	}

	// Consolidação em tempo real (§8.4 ciclo 1): ADD | SUPERSEDE | NOOP.
	newID := uuid.New().String()
	if mems, err := s.memoryRepo.SearchRelevant(userID, content, 5); err == nil {
		contentLower := strings.ToLower(content)
		for _, m := range mems {
			existing := strings.ToLower(strings.TrimSpace(m.Content))
			if existing == contentLower {
				// NOOP: fato conhecido, só reforça a confiança.
				_ = s.memoryRepo.Reinforce(m.ID, userID)
				return
			}
			if sameTopic(existing, contentLower) {
				// UPDATE/SUPERSEDE: hábito mudou, preserva histórico sem poluir o prompt.
				_ = s.memoryRepo.Supersede(m.ID, userID, newID)
				break
			}
		}
	}

	mem := &domain.Memory{
		ID:         newID,
		UserID:     userID,
		Category:   category,
		Content:    content,
		Importance: 3,
		Confidence: 1.0,
		CreatedAt:  time.Now().UTC(),
		UpdatedAt:  time.Now().UTC(),
	}
	_ = s.memoryRepo.Create(mem)
}

// sameTopic delega ao subpacote assistant (BACK-01).
func sameTopic(a, b string) bool { return assistant.SameTopic(a, b) }

func userLocation(timezone string) *time.Location {
	if timezone != "" {
		if loc, err := time.LoadLocation(timezone); err == nil {
			return loc
		}
	}
	return time.FixedZone("BRT", -3*3600)
}

// clarificationResponse monta uma resposta de pergunta sem tocar no banco.
// O mobile exibe Message/Reply como bolha do Vito e o histórico mantém o contexto.
func clarificationResponse(intent *ai.ParsedIntent, question string) *AssistantResponse {
	msg := assistant.ClarificationMessage(question)
	provider := ""
	if intent != nil {
		provider = intent.ProviderUsed
	}
	return &AssistantResponse{
		Action:       ai.ActionNeedsClarification,
		Intent:       string(ai.ActionNeedsClarification),
		Message:      msg,
		Reply:        msg,
		ProviderUsed: provider,
	}
}

// defaultMessageFor evita bolhas vazias quando a IA retorna action sem message.
func defaultMessageFor(action ai.IntentAction) string {
	return assistant.DefaultMessageFor(action)
}

// isVagueBookingRequest detecta pedido de booking sem nenhum detalhe útil.
// Evita criar "Reunião de Alinhamento" silenciosamente quando o usuário só disse "crie um booking".
func isVagueBookingRequest(text string) bool { return assistant.IsVagueBookingRequest(text) }

// isBookingIntentText detecta pedido de link de agendamento por sinônimos diretos.
func isBookingIntentText(text string) bool { return assistant.IsBookingIntentText(text) }

// ExportedIsBookingIntentText expõe isBookingIntentText para testes de regressão.
func ExportedIsBookingIntentText(text string) bool { return isBookingIntentText(text) }

// ExportedInferBookingDays expõe inferBookingDaysOfWeek para testes de regressão.
func ExportedInferBookingDays(text string) string { return inferBookingDaysOfWeek(text) }

// inferBookingDaysOfWeek deriva a janela semanal; default 7 dias (inclui fds e feriados).
func inferBookingDaysOfWeek(text string) string { return assistant.InferBookingDaysOfWeek(text) }
