package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// AIParsingGateway contrato para desacoplar a IA do serviço.
type AIParsingGateway interface {
	ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error)
}

// DestructiveConfirmation representa o banner de confirmação humana (Human-in-the-Loop) para ações críticas ou em massa (Sprint 13).
type DestructiveConfirmation struct {
	ActionType    string `json:"action_type"`
	TargetTitle   string `json:"target_title"`
	ImpactCount   int    `json:"impact_count"`
	Description   string `json:"description"`
	ConfirmPrompt string `json:"confirm_prompt"`
}

// AssistantResponse representa o retorno da interação com a secretária Vito.
type AssistantResponse struct {
	Action              ai.IntentAction          `json:"action"`
	Intent              string                   `json:"intent,omitempty"`
	Message             string                   `json:"message"`
	Reply               string                   `json:"reply,omitempty"`
	Event               *domain.Event            `json:"event,omitempty"`
	Conflict            *domain.ConflictInfo     `json:"conflict,omitempty"`
	Todo                *domain.Todo             `json:"todo,omitempty"`
	Trigger             *domain.Trigger          `json:"trigger,omitempty"`
	Pending             *domain.PendingItem      `json:"pending,omitempty"`
	Booking             *domain.BookingType        `json:"booking,omitempty"`
	BookingURL          string                     `json:"booking_url,omitempty"`
	BookingShort        string                     `json:"booking_short_url,omitempty"`
	Meeting             *domain.MeetingWithDetails `json:"meeting,omitempty"`
	MeetingURL          string                     `json:"meeting_url,omitempty"`
	MeetingShort        string                     `json:"meeting_short_url,omitempty"`
	MeetingWhatsApp     string                     `json:"meeting_whatsapp_url,omitempty"`
	PendingConfirmation *DestructiveConfirmation   `json:"pending_confirmation,omitempty"`
	ProviderUsed        string                     `json:"provider_used,omitempty"`
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
	meetingSvc     *MeetingService
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

// SetMeetingService injeta o serviço do módulo de Reuniões.
func (s *AssistantService) SetMeetingService(meetingSvc *MeetingService) {
	s.meetingSvc = meetingSvc
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

	// Injeta contexto dinâmico do usuário no input
	s.enrichInputContext(ctx, userID, &input)

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

	// Despacha e executa a ação correspondente
	res, err = s.executeAction(ctx, userID, intent, input, res)
	if err != nil {
		return nil, err
	}

	// Sincroniza Reply com Message para o mobile sempre exibir o motivo.
	res.Reply = res.Message

	return res, nil
}
