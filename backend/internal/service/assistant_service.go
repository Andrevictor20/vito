package service

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
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

	// Carrega memórias de longo prazo se ainda não informadas (Camada 3)
	if len(input.ContextMemories) == 0 && s.memoryRepo != nil {
		if mems, err := s.memoryRepo.ListByUser(userID, 15); err == nil && len(mems) > 0 {
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
				evStart, evEnd := ev.StartAt.In(loc), ev.EndAt.In(loc)
				input.ActiveSchedule = append(input.ActiveSchedule, fmt.Sprintf("%s (%s, das %s às %s): %s",
					evStart.Format("02/01/2006"),
					ai.WeekdayPT(evStart.Weekday()),
					evStart.Format("15:04"),
					evEnd.Format("15:04"),
					ev.Title,
				))
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
				dueStr := "Sem prazo"
				if td.DueDate != nil {
					dueStr = td.DueDate.In(userLocation(input.Timezone)).Format("02/01 15:04")
				}
				input.PendingTodos = append(input.PendingTodos, fmt.Sprintf("[%s - %s] %s", td.Priority, dueStr, td.Title))
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
				schedule := string(tr.Frequency)
				if tr.ScheduledTime != "" {
					schedule = fmt.Sprintf("%s às %s", schedule, tr.ScheduledTime)
				}
				input.ActiveTriggers = append(input.ActiveTriggers, fmt.Sprintf("[%s - %s] %s (%s)", tr.Category, schedule, tr.Title, tr.Query))
			}
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
					input.ActiveBookings = append(input.ActiveBookings, fmt.Sprintf("%s (%d min, %s às %s): %s", bt.Title, bt.DurationMinutes, bt.StartHour, bt.EndHour, url))
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

	switch intent.Action {
	case ai.ActionCreateEvent:
		if intent.Event != nil {
			if intent.Event.StartAt.IsZero() {
				intent.Event.StartAt = input.Now
			}
			if intent.Event.EndAt.IsZero() || intent.Event.EndAt.Before(intent.Event.StartAt) || intent.Event.EndAt.Equal(intent.Event.StartAt) {
				intent.Event.EndAt = intent.Event.StartAt.Add(1 * time.Hour)
			}
			if intent.Event.Recurrence != "" {
				events, err := s.calSvc.CreateRecurringEvents(
					userID,
					intent.Event.Title,
					intent.Event.Description,
					intent.Event.Location,
					intent.Event.StartAt,
					intent.Event.EndAt,
					intent.Event.Recurrence,
					8,
				)
				if err != nil {
					return nil, fmt.Errorf("falha ao criar série recorrente de eventos: %w", err)
				}
				if len(events) > 0 {
					res.Event = events[0]
				}
				if res.Message == "" {
					res.Message = fmt.Sprintf("Agendei '%s' como compromisso recorrente (%s) na sua agenda!", intent.Event.Title, strings.ToLower(intent.Event.Recurrence))
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
					return nil, fmt.Errorf("falha ao criar evento: %w", err)
				}

				res.Event = event
				res.Conflict = conflict
				if conflict != nil && conflict.HasConflict {
					res.Message += fmt.Sprintf(" ⚠️ Atenção: você já tem '%s' agendado nesse horário!", conflict.ConflictingTitle)
					if len(conflict.SuggestedSlots) > 0 {
						var slotLabels []string
						for _, sl := range conflict.SuggestedSlots {
							slotLabels = append(slotLabels, sl.Label)
						}
						res.Message += fmt.Sprintf(" Que tal agendar para %s?", strings.Join(slotLabels, " ou "))
					}
				}
			}
		}

	case ai.ActionDeleteEvent:
		if intent.Event != nil {
			target := intent.Event.TargetQuery
			if target == "" {
				target = intent.Event.Title
			}
			if target != "" {
				count, err := s.calSvc.DeleteEventsByTitle(userID, target)
				if err != nil {
					return nil, fmt.Errorf("falha ao excluir evento(s): %w", err)
				}
				if count > 1 {
					res.Message = fmt.Sprintf("Pronto! Removi a série de %d compromissos de '%s' da sua agenda.", count, target)
				} else if count == 1 {
					if res.Message == "" {
						res.Message = fmt.Sprintf("Pronto! Removi o compromisso '%s' da sua agenda.", target)
					}
				} else {
					res.Message = fmt.Sprintf("Não encontrei nenhum compromisso chamado '%s' na sua agenda para remover.", target)
				}
			}
		}

	case ai.ActionUpdateEvent:
		if intent.Event != nil {
			target := intent.Event.TargetQuery
			if target == "" {
				target = intent.Event.Title
			}
			if target != "" && !intent.Event.StartAt.IsZero() && !intent.Event.EndAt.IsZero() {
				count, err := s.calSvc.UpdateEventTimesByTitle(userID, target, intent.Event.StartAt, intent.Event.EndAt)
				if err != nil {
					return nil, fmt.Errorf("falha ao atualizar evento(s): %w", err)
				}
				if count > 1 {
					res.Message = fmt.Sprintf("Pronto! Atualizei o horário de toda a série (%d compromissos de '%s') para %s.", count, target, intent.Event.StartAt.Format("15:04"))
				} else if count == 1 {
					if res.Message == "" {
						res.Message = fmt.Sprintf("Atualizei o horário de '%s' para %s na sua agenda.", target, intent.Event.StartAt.Format("15:04"))
					}
				} else {
					res.Message = fmt.Sprintf("Não encontrei nenhum compromisso chamado '%s' na sua agenda para reagendar.", target)
				}
			}
		}

	case ai.ActionCreateTodo:
		if intent.Todo != nil {
			todo, err := s.todoSvc.CreateTodo(
				userID,
				intent.Todo.Title,
				intent.Todo.Priority,
				intent.Todo.DueDate,
			)
			if err != nil {
				return nil, fmt.Errorf("falha ao criar tarefa: %w", err)
			}
			res.Todo = todo
		}

	case ai.ActionQuerySchedule:
		from := input.Now.Truncate(24 * time.Hour)
		to := from.Add(24 * time.Hour)
		events, err := s.calSvc.ListEvents(userID, from, to)
		if err == nil {
			if len(events) == 0 {
				res.Message = "Você não tem nenhum compromisso agendado para hoje."
			} else {
				res.Message = fmt.Sprintf("Você tem %d compromisso(s) para hoje.", len(events))
			}
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
		if intent.Trigger != nil && s.triggerSvc != nil {
			cat := domain.TriggerCategory(intent.Trigger.Category)
			freq := domain.TriggerFrequency(intent.Trigger.Frequency)
			cond := domain.TriggerConditionType(intent.Trigger.ConditionType)
			trig, err := s.triggerSvc.CreateTrigger(userID, domain.CreateTriggerInput{
				Title:         intent.Trigger.Title,
				Category:      cat,
				Query:         intent.Trigger.Query,
				TargetValue:   intent.Trigger.TargetValue,
				ConditionType: cond,
				Frequency:     freq,
				ScheduledTime: intent.Trigger.ScheduledTime,
				DaysOfWeek:    intent.Trigger.DaysOfWeek,
			})
			if err != nil {
				return nil, fmt.Errorf("falha ao criar disparador: %w", err)
			}
			res.Trigger = trig
			if res.Message == "" {
				res.Message = fmt.Sprintf("Pronto! Criei o disparador '%s' na seção de Disparadores e já iniciei a vigília para você.", trig.Title)
			}
		}

	case ai.ActionCreatePending:
		if intent.Pending != nil && s.pendingSvc != nil {
			item, err := s.pendingSvc.CreatePending(userID, domain.CreatePendingInput{
				Title:         intent.Pending.Title,
				Description:   intent.Pending.Description,
				Category:      intent.Pending.Category,
				ScheduledDate: intent.Pending.ScheduledDate,
			})
			if err != nil {
				return nil, fmt.Errorf("falha ao criar pendência: %w", err)
			}
			res.Pending = item
			if res.Message == "" {
				res.Message = fmt.Sprintf("Guardei '%s' nas suas Pendências!", item.Title)
			}
		}

	case ai.ActionConvertPending:
		if intent.Event != nil {
			if intent.Event.StartAt.IsZero() {
				intent.Event.StartAt = input.Now
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
				return nil, fmt.Errorf("falha ao agendar evento da pendência: %w", err)
			}
			res.Event = event
			res.Conflict = conflict
			if intent.Pending != nil && intent.Pending.ID != "" && s.pendingSvc != nil {
				_, _ = s.pendingSvc.CompletePending(intent.Pending.ID, userID)
			}
			if res.Message == "" {
				res.Message = fmt.Sprintf("Agendei '%s' para %s e atualizei a pendência!", event.Title, event.StartAt.Format("02/01 às 15:04"))
			}
		}

	case ai.ActionCreateBookingLink:
		if intent.Booking != nil && s.bookingSvc != nil {
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
				slug = strings.ToLower(strings.ReplaceAll(title, " ", "-"))
				reg := regexp.MustCompile(`[^a-z0-9\-]`)
				slug = reg.ReplaceAllString(slug, "")
				if len(slug) > 30 {
					slug = slug[:30]
				}
				slug = fmt.Sprintf("%s-%d", slug, time.Now().Unix()%10000)
			}
			bt, err := s.bookingSvc.CreateBookingType(ctx, userID, &domain.BookingType{
				Title:           title,
				Slug:            slug,
				Description:     intent.Booking.Description,
				DurationMinutes: dur,
				BufferMinutes:   buf,
				StartHour:       sh,
				EndHour:         eh,
				DaysOfWeek:      "[1,2,3,4,5]",
			})
			if err != nil {
				log.Printf("⚠️ [AssistantService] Erro ao criar booking type via chat: %v", err)
				res.Message = fmt.Sprintf("Não consegui gerar o link de agendamento no momento (%v). Você também pode criá-lo pelo menu Vito Booking.", err)
			} else {
				linkURL := bt.ShortURL
				if linkURL == "" {
					linkURL = bt.PublicURL
				}
				res.Message = fmt.Sprintf("Criei o seu link de agendamento para '%s' (%d min):\n%s", bt.Title, bt.DurationMinutes, linkURL)
			}
		}

	case ai.ActionCancelBookingAppointment:
		if intent.Booking != nil && s.bookingSvc != nil {
			query := strings.TrimSpace(intent.Booking.TargetQuery)
			if query == "" {
				query = strings.TrimSpace(intent.Booking.Title)
			}
			if query != "" {
				from := input.Now.Add(-30 * 24 * time.Hour)
				to := input.Now.Add(90 * 24 * time.Hour)
				appts, err := s.bookingSvc.ListAppointments(ctx, userID, from, to)
				if err != nil {
					return nil, fmt.Errorf("falha ao listar agendamentos: %w", err)
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
						return nil, fmt.Errorf("falha ao cancelar agendamento: %w", err)
					}
					res.Message = fmt.Sprintf("Cancelei o agendamento de %s e liberei o horário na sua agenda.", targetAppt.GuestName)
				} else {
					res.Message = fmt.Sprintf("Não localizei nenhum agendamento correspondente a '%s'.", query)
				}
			}
		}
	}

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

	// Evita duplicar memória idêntica recente
	if mems, err := s.memoryRepo.ListByUser(userID, 25); err == nil {
		contentLower := strings.ToLower(content)
		for _, m := range mems {
			if strings.ToLower(strings.TrimSpace(m.Content)) == contentLower {
				return
			}
		}
	}

	mem := &domain.Memory{
		ID:        uuid.New().String(),
		UserID:    userID,
		Category:  category,
		Content:   content,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	_ = s.memoryRepo.Create(mem)
}

func userLocation(timezone string) *time.Location {
	if timezone != "" {
		if loc, err := time.LoadLocation(timezone); err == nil {
			return loc
		}
	}
	return time.FixedZone("BRT", -3*3600)
}
