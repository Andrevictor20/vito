package ai

import (
	"context"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// IntentAction define o tipo de ação interpretada pela IA.
type IntentAction string

const (
	ActionCreateEvent              IntentAction = "CREATE_EVENT"
	ActionUpdateEvent              IntentAction = "UPDATE_EVENT"
	ActionDeleteEvent              IntentAction = "DELETE_EVENT"
	ActionCreateTodo               IntentAction = "CREATE_TODO"
	ActionCompleteTodo             IntentAction = "COMPLETE_TODO"
	ActionDeleteTodo               IntentAction = "DELETE_TODO"
	ActionCreatePending            IntentAction = "CREATE_PENDING_ITEM"
	ActionConvertPending           IntentAction = "CONVERT_PENDING_TO_EVENT"
	ActionQuerySchedule            IntentAction = "QUERY_SCHEDULE"
	ActionQueryTodos               IntentAction = "QUERY_TODOS"
	ActionSaveMemory               IntentAction = "SAVE_MEMORY"
	ActionCreateTrigger            IntentAction = "CREATE_TRIGGER"
	ActionCreateBookingLink        IntentAction = "CREATE_BOOKING_LINK"
	ActionCancelBookingAppointment IntentAction = "CANCEL_BOOKING_APPOINTMENT"
	ActionCreateMeeting            IntentAction = "CREATE_MEETING"
	ActionGeneralChat              IntentAction = "GENERAL_CHAT"
	ActionNeedsClarification       IntentAction = "NEEDS_CLARIFICATION"
	ActionOutOfScope               IntentAction = "OUT_OF_SCOPE"
)

// ChatMessageContext representa uma mensagem no histórico da conversa para contexto multi-turn.
type ChatMessageContext struct {
	Sender string `json:"sender"`         // "user" ou "vito"
	Text   string `json:"text"`           //
	Chat   string `json:"chat,omitempty"` // rótulo do chat de origem (WhatsApp)
}

// UserInput encapsula a mensagem de entrada do usuário (texto ou áudio em base64).
type UserInput struct {
	Text            string    `json:"text,omitempty"`
	AudioB64        string    `json:"audio_b64,omitempty"`
	AudioMime       string    `json:"audio_mime,omitempty"`
	ImageB64        string    `json:"image_b64,omitempty"`
	ImageMime       string    `json:"image_mime,omitempty"`
	Timezone        string    `json:"timezone,omitempty"` // ex: "America/Sao_Paulo"
	Now             time.Time `json:"now"`
	ContextMemories []string  `json:"context_memories,omitempty"` // RAG in-context pessoal
	ActiveSchedule  []string  `json:"active_schedule,omitempty"`  // Próximos compromissos
	PendingTodos    []string  `json:"pending_todos,omitempty"`    // Tarefas urgentes/pendentes
	ActiveTriggers  []string  `json:"active_triggers,omitempty"`  // Vigílias / disparadores em andamento
	// ActiveTriggerAlerts resume alertas não lidos dos radares (Fase 3, top 3).
	ActiveTriggerAlerts  []string             `json:"active_trigger_alerts,omitempty"`
	ActiveBookings       []string             `json:"active_bookings,omitempty"`       // Links de agendamento do usuário
	UpcomingAppointments []string             `json:"upcoming_appointments,omitempty"` // Agendamentos recebidos de convidados
	ConversationHistory  []ChatMessageContext `json:"conversation_history,omitempty"`  // Histórico recente da conversa multi-turn
	QuotedContext        string               `json:"quoted_context,omitempty"`        // Texto da mensagem citada/respondida no WhatsApp
	ConversationWindow   []ChatMessageContext `json:"conversation_window,omitempty"`   // Janela recente de chats do WhatsApp
	UserName             string               `json:"user_name,omitempty"`             // Nome do usuário para personalização
	AutonomyMode         string               `json:"autonomy_mode,omitempty"`         // "assisted" (padrão) | "proactive"
	AppStateFlags        []string             `json:"app_state_flags,omitempty"`       // §8.5 telemetria compacta
	CoreProfile          []string             `json:"core_profile,omitempty"`          // §8.2 Camada 1 (8-10 itens)
	RecentEmails         []string             `json:"recent_emails,omitempty"`         // E-mails recentes / faturas / voos do Gmail
	FocusMode            string               `json:"focus_mode,omitempty"`            // calendar, tasks, triggers, meetings, briefing, memory
}

// ParsedEvent dados extraídos para criação, atualização ou remoção de evento.
type ParsedEvent struct {
	Title           string    `json:"title"`
	Description     string    `json:"description,omitempty"`
	Location        string    `json:"location,omitempty"`
	StartAt         time.Time `json:"start_at"`
	EndAt           time.Time `json:"end_at"`
	Recurrence      string    `json:"recurrence,omitempty"`       // "WEEKLY", "DAILY", "MONTHLY"
	RecurrenceUntil string    `json:"recurrence_until,omitempty"` // "YYYY-MM-DD" inclusiva: último dia da série
	TargetQuery     string    `json:"target_query,omitempty"`     // termo ou ID exato para busca ao atualizar/excluir

	startWallClock bool
	endWallClock   bool
}

// ParsedTodo dados extraídos para criação, conclusão ou remoção de to-do.
type ParsedTodo struct {
	Title         string     `json:"title"`
	Priority      string     `json:"priority"` // low, medium, high
	DueDate       *time.Time `json:"due_date,omitempty"`
	RemindAt      *time.Time `json:"remind_at,omitempty"`
	RemindRepeat  string     `json:"remind_repeat,omitempty"` // none, daily, weekly
	RemindAdvance int        `json:"remind_advance_minutes,omitempty"`
	TargetQuery   string     `json:"target_query,omitempty"` // ID exato ou título ao concluir/excluir

	dueWallClock    bool
	remindWallClock bool
}

// ParsedTrigger dados extraídos para criação de disparador / monitoramento contínuo.
type ParsedTrigger struct {
	Title         string `json:"title"`
	Category      string `json:"category"`
	Query         string `json:"query"`
	TargetValue   string `json:"target_value,omitempty"`
	ConditionType string `json:"condition_type,omitempty"`
	Frequency     string `json:"frequency,omitempty"`
	ScheduledTime string `json:"scheduled_time,omitempty"`
	DaysOfWeek    string `json:"days_of_week,omitempty"`
}

// ParsedPending dados extraídos para criação ou agendamento de item na Incubadora de Pendências.
type ParsedPending struct {
	ID            string     `json:"id,omitempty"`
	Title         string     `json:"title"`
	Description   string     `json:"description,omitempty"`
	Category      string     `json:"category,omitempty"`
	ScheduledDate string     `json:"scheduled_date,omitempty"`
	RemindAt      *time.Time `json:"remind_at,omitempty"`
	RemindRepeat  string     `json:"remind_repeat,omitempty"` // none, daily, weekly
	RemindAdvance int        `json:"remind_advance_minutes,omitempty"`

	remindWallClock bool
}

// ParsedBooking dados extraídos para criação ou cancelamento de link de agendamento/booking.
type ParsedBooking struct {
	Title           string `json:"title"`
	Slug            string `json:"slug,omitempty"`
	Description     string `json:"description,omitempty"`
	DurationMinutes int    `json:"duration_minutes,omitempty"`
	BufferMinutes   int    `json:"buffer_minutes,omitempty"`
	StartHour       string `json:"start_hour,omitempty"`
	EndHour         string `json:"end_hour,omitempty"`
	DaysOfWeek      string `json:"days_of_week,omitempty"`
	ValidUntil      string `json:"valid_until,omitempty"` // YYYY-MM-DD (fim da validade; padrão +7 dias)
	TargetQuery     string `json:"target_query,omitempty"`
}

// ParsedMeetingSlot slot sugerido na criação da reunião via chat.
type ParsedMeetingSlot struct {
	StartAt time.Time `json:"start_at"`
	EndAt   time.Time `json:"end_at"`
}

// ParsedMeeting dados extraídos para criação de reunião com link mágico/votação.
type ParsedMeeting struct {
	Title           string              `json:"title"`
	Description     string              `json:"description,omitempty"`
	DurationMinutes int                 `json:"duration_minutes,omitempty"`
	Mode            string              `json:"mode,omitempty"` // one_on_one | group_consensus
	Slots           []ParsedMeetingSlot `json:"slots,omitempty"`
}

// ParsedIntent resultado normalizado da interpretação do assistente Toki-like.
type ParsedIntent struct {
	Action            IntentAction   `json:"action"`
	Thought           string         `json:"thought,omitempty"`      // §8.6 CoT: raciocínio guiado obrigatório
	ContextUsed       []string       `json:"context_used,omitempty"` // §8.6 CoT: memórias/entidades usadas
	Message           string         `json:"message"`                // Resposta amigável da secretária
	Event             *ParsedEvent   `json:"event,omitempty"`
	Todo              *ParsedTodo    `json:"todo,omitempty"`
	Trigger           *ParsedTrigger `json:"trigger,omitempty"`
	Pending           *ParsedPending `json:"pending,omitempty"`
	Booking           *ParsedBooking `json:"booking,omitempty"`
	Meeting           *ParsedMeeting `json:"meeting,omitempty"`
	MemoryContent     string         `json:"memory_content,omitempty"`
	MemoryCategory    string         `json:"memory_category,omitempty"`
	AdditionalActions []ParsedIntent `json:"additional_actions,omitempty"` // Ações encadeadas no mesmo turno (até 3)
	ProviderUsed      string         `json:"provider_used,omitempty"`
}

// IsEmpty detecta resposta vazia (bug §8.7/9): Reply em branco e nenhuma ação.
// O gateway trata como falha e aciona o próximo provedor em vez de engolir.
func (p *ParsedIntent) IsEmpty() bool {
	if p == nil {
		return true
	}
	if strings.TrimSpace(p.Message) != "" {
		return false
	}
	return p.Event == nil && p.Todo == nil && p.Trigger == nil &&
		p.Pending == nil && p.Booking == nil && p.Meeting == nil &&
		len(p.AdditionalActions) == 0 &&
		strings.TrimSpace(p.MemoryContent) == ""
}

// Provider contrato unificado para provedores de IA (Google, OpenRouter, Groq).
type Provider interface {
	Name() string
	ParseIntent(ctx context.Context, input UserInput) (*ParsedIntent, error)
}

// VisionCapable indica se o provedor suporta processamento direto de imagens.
type VisionCapable interface {
	SupportsVision() bool
}

// AudioCapable indica se o provedor suporta processamento direto de áudio.
type AudioCapable interface {
	SupportsAudio() bool
}

// TriggerEvaluatorProvider define a capacidade do provedor avaliar radares e vigílias.
type TriggerEvaluatorProvider interface {
	EvaluateTrigger(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error)
}

// TextGeneratorProvider define a capacidade do provedor sintetizar resumos e textos executivos.
type TextGeneratorProvider interface {
	GenerateText(ctx context.Context, systemPrompt, userPrompt string) (string, error)
}
