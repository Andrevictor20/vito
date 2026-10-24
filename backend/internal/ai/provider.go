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
	ActionQueryConversation        IntentAction = "QUERY_CONVERSATION"
	ActionSearchConversations      IntentAction = "SEARCH_CONVERSATIONS"
	ActionListPendingConversations IntentAction = "LIST_PENDING_CONVERSATIONS"
	ActionDraftReply               IntentAction = "DRAFT_REPLY"
	ActionSendWhatsAppMessage      IntentAction = "SEND_WHATSAPP_MESSAGE"
	ActionCreateReplyReminder      IntentAction = "CREATE_REPLY_REMINDER"
	ActionDraftEmail               IntentAction = "DRAFT_EMAIL"
	ActionSendEmail                IntentAction = "SEND_EMAIL"
	ActionNeedsClarification       IntentAction = "NEEDS_CLARIFICATION"
	ActionOutOfScope               IntentAction = "OUT_OF_SCOPE"

	// CRUD Actions - Read/Update/Delete para features
	ActionQueryTriggers            IntentAction = "QUERY_TRIGGERS"
	ActionListBookings             IntentAction = "LIST_BOOKINGS"
	ActionUpdateBooking            IntentAction = "UPDATE_BOOKING"
	ActionListMeetings             IntentAction = "LIST_MEETINGS"
	ActionUpdateMeeting            IntentAction = "UPDATE_MEETING"
	ActionDeleteMeeting            IntentAction = "DELETE_MEETING"
	ActionQueryPending             IntentAction = "QUERY_PENDING"
	ActionQueryMemory              IntentAction = "QUERY_MEMORY"
	ActionUpdateMemory             IntentAction = "UPDATE_MEMORY"
	ActionDeleteMemory             IntentAction = "DELETE_MEMORY"
	ActionListContacts             IntentAction = "LIST_CONTACTS"
)

// ChatContactSummary resume uma conversa do WhatsApp para o diretório de
// contatos e a lista de pendências que entram no prompt.
type ChatContactSummary struct {
	Name    string `json:"name"`              // nome do contato (ou o rótulo do chat)
	Preview string `json:"preview,omitempty"` // prévia da última mensagem
	Age     string `json:"age,omitempty"`     // "há 2h", "ontem"
	Pending bool   `json:"pending,omitempty"` //true = esperando resposta do usuário
	// Alias é o OUTRO nome do mesmo contato: o nome de perfil no WhatsApp
	// ("bella") quando o principal é o nome salvo pelo dono ("isa"). O Vito
	// precisa entender as duas formas de chamar a mesma pessoa.
	Alias string `json:"alias,omitempty"`
}

// ChatMessageContext representa uma mensagem no histórico da conversa para contexto multi-turn.
type ChatMessageContext struct {
	Sender string `json:"sender"`         // "user" ou "vito"
	Text   string `json:"text"`           //
	Chat   string `json:"chat,omitempty"` // rótulo do chat de origem (WhatsApp)
	// Quoted é a mensagem que o remetente marcou ("responder a esta mensagem").
	// Sem isso o Vito perde o elo do que a mensagem atual responde.
	Quoted string `json:"quoted,omitempty"`
	// Kind é o tipo do conteúdo ("text", "image", "audio") — permite ao Vito
	// dizer "a foto que você mandou" em vez de repetir o texto.
	Kind string `json:"kind,omitempty"`
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
	ContactDirectory     []ChatContactSummary `json:"contact_directory,omitempty"`     // Diretório de contatos do WhatsApp
	PendingConversations []ChatContactSummary `json:"pending_conversations,omitempty"` // Conversas que esperam resposta do usuário
	// WhatsAppPrivateScope marca que a RESPOSTA fica visível apenas para o
	// usuário (chat "Você", app ou desktop). Só nesse escopo o diretório de
	// contatos e as pendências podem ser injetados — em conversa com terceiro
	// isso revelaria "a Ana te espera" para o João.
	WhatsAppPrivateScope bool     `json:"whatsapp_private_scope,omitempty"`
	UserName             string   `json:"user_name,omitempty"`       // Nome do usuário para personalização
	AutonomyMode         string   `json:"autonomy_mode,omitempty"`   // "assisted" (padrão) | "proactive"
	AppStateFlags        []string `json:"app_state_flags,omitempty"` // §8.5 telemetria compacta
	CoreProfile          []string `json:"core_profile,omitempty"`    // §8.2 Camada 1 (8-10 itens)
	RecentEmails         []string `json:"recent_emails,omitempty"`   // E-mails recentes / faturas / voos do Gmail
	FocusMode            string   `json:"focus_mode,omitempty"`      // calendar, tasks, triggers, meetings, briefing, memory
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

// ParsedConversationQuery é uma consulta às mensagens de uma conversa do WhatsApp.
type ParsedConversationQuery struct {
	Chat  string `json:"chat"`            // nome do contato (como o usuário chamou)
	Limit int    `json:"limit,omitempty"` // quantas mensagens brings (default 10)
	// Query é o termo a BUSCAR no histórico ("aquela sobre o contrato"). Vazio
	// = listar as últimas mensagens da conversa.
	Query string `json:"query,omitempty"`
}

// ParsedWhatsAppMessage é uma mensagem a ser enviada a um contato.
type ParsedWhatsAppMessage struct {
	Chat string `json:"chat"` // nome do contato de destino
	Text string `json:"text"` // texto a enviar
}

// ParsedEmailMessage representa um e-mail a ser rascunhado ou enviado via Gmail.
type ParsedEmailMessage struct {
	To      string `json:"to"`
	Subject string `json:"subject"`
	Body    string `json:"body"`
}

// ParsedReplyReminder é um lembrete de resposta a uma conversa.
type ParsedReplyReminder struct {
	Chat string    `json:"chat"`           // nome do contato
	When time.Time `json:"when,omitempty"` // quando cobrar (hora local, sem offset)
	Note string    `json:"note,omitempty"` // o que foi prometido / pendente
}

// ParsedTriggerQuery para listar/consultar radares.
type ParsedTriggerQuery struct {
	Category string `json:"category,omitempty"` // filtrar por categoria
	Status   string `json:"status,omitempty"`   // active, paused, all
}

// ParsedBookingQuery para listar/atualizar bookings.
type ParsedBookingQuery struct {
	TargetQuery string `json:"target_query,omitempty"` // ID, slug ou título
	Status     string `json:"status,omitempty"`        // active, paused, all
}

// ParsedBookingUpdate para atualizar booking.
type ParsedBookingUpdate struct {
	TargetQuery     string `json:"target_query,omitempty"`
	Title           string `json:"title,omitempty"`
	Description     string `json:"description,omitempty"`
	DurationMinutes int    `json:"duration_minutes,omitempty"`
	BufferMinutes   int    `json:"buffer_minutes,omitempty"`
	StartHour       string `json:"start_hour,omitempty"`
	EndHour         string `json:"end_hour,omitempty"`
	DaysOfWeek      string `json:"days_of_week,omitempty"`
	IsActive        *bool  `json:"is_active,omitempty"`
	ValidUntil      string `json:"valid_until,omitempty"` // YYYY-MM-DD
}

// ParsedMeetingQuery para listar reuniões.
type ParsedMeetingQuery struct {
	TargetQuery string `json:"target_query,omitempty"`
	Status     string `json:"status,omitempty"` // confirmed, voting, cancelled, all
}

// ParsedMeetingUpdate para atualizar reunião.
type ParsedMeetingUpdate struct {
	TargetQuery     string              `json:"target_query,omitempty"`
	Title           string              `json:"title,omitempty"`
	Description     string              `json:"description,omitempty"`
	DurationMinutes int                 `json:"duration_minutes,omitempty"`
	Mode            string              `json:"mode,omitempty"` // one_on_one | group_consensus
	Slots           []ParsedMeetingSlot `json:"slots,omitempty"`
	Status          string              `json:"status,omitempty"`
}

// ParsedPendingQuery para listar pendências.
type ParsedPendingQuery struct {
	Status     string `json:"status,omitempty"` // inbox, scheduled, completed, all
	Category   string `json:"category,omitempty"`
	Limit      int    `json:"limit,omitempty"`
}

// ParsedMemoryQuery para buscar memórias.
type ParsedMemoryQuery struct {
	Query   string `json:"query,omitempty"`   // termo de busca
	Category string `json:"category,omitempty"`
	Limit    int    `json:"limit,omitempty"`
}

// ParsedMemoryUpdate para atualizar memória.
type ParsedMemoryUpdate struct {
	ID         string `json:"id,omitempty"`         // ID exato da memória
	TargetQuery string `json:"target_query,omitempty"` // busca por conteúdo
	Category   string `json:"category,omitempty"`
	Content    string `json:"content,omitempty"`
}

// ParsedMemoryDelete para deletar memória.
type ParsedMemoryDelete struct {
	ID         string `json:"id,omitempty"`
	TargetQuery string `json:"target_query,omitempty"`
	Category   string `json:"category,omitempty"`
}

// ParsedContactsQuery para listar contatos.
type ParsedContactsQuery struct {
	Query  string `json:"query,omitempty"`
	Limit  int    `json:"limit,omitempty"`
	Scope  string `json:"scope,omitempty"` // private, all
}

// ParsedIntent resultado normalizado da interpretação do assistente Toki-like.
type ParsedIntent struct {
	Action            IntentAction               `json:"action"`
	Thought           string                     `json:"thought,omitempty"`      // §8.6 CoT: raciocínio guiado obrigatório
	ContextUsed       []string                   `json:"context_used,omitempty"` // §8.6 CoT: memórias/entidades usadas
	Message           string                     `json:"message"`                // Resposta amigável da secretária
	Event             *ParsedEvent               `json:"event,omitempty"`
	Todo              *ParsedTodo                `json:"todo,omitempty"`
	Trigger           *ParsedTrigger             `json:"trigger,omitempty"`
	Pending           *ParsedPending             `json:"pending,omitempty"`
	Booking           *ParsedBooking             `json:"booking,omitempty"`
	BookingQuery      *ParsedBookingQuery        `json:"booking_query,omitempty"`
	BookingUpdate     *ParsedBookingUpdate       `json:"booking_update,omitempty"`
	Meeting           *ParsedMeeting             `json:"meeting,omitempty"`
	MeetingQuery      *ParsedMeetingQuery        `json:"meeting_query,omitempty"`
	MeetingUpdate     *ParsedMeetingUpdate       `json:"meeting_update,omitempty"`
	Conversation      *ParsedConversationQuery   `json:"conversation,omitempty"`
	WhatsAppMessage   *ParsedWhatsAppMessage     `json:"whatsapp_message,omitempty"`
	EmailMessage      *ParsedEmailMessage        `json:"email_message,omitempty"`
	ReplyReminder     *ParsedReplyReminder       `json:"reply_reminder,omitempty"`
	TriggerQuery      *ParsedTriggerQuery        `json:"trigger_query,omitempty"`
	PendingQuery      *ParsedPendingQuery        `json:"pending_query,omitempty"`
	MemoryQuery       *ParsedMemoryQuery         `json:"memory_query,omitempty"`
	MemoryUpdate      *ParsedMemoryUpdate        `json:"memory_update,omitempty"`
	MemoryDelete      *ParsedMemoryDelete        `json:"memory_delete,omitempty"`
	ContactsQuery     *ParsedContactsQuery       `json:"contacts_query,omitempty"`
	MemoryContent     string                     `json:"memory_content,omitempty"`
	MemoryCategory    string                     `json:"memory_category,omitempty"`
	AdditionalActions []ParsedIntent             `json:"additional_actions,omitempty"` // Ações encadeadas no mesmo turno (até 3)
	ProviderUsed      string                     `json:"provider_used,omitempty"`
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
		p.BookingQuery == nil && p.BookingUpdate == nil &&
		p.MeetingQuery == nil && p.MeetingUpdate == nil &&
		p.Conversation == nil && p.WhatsAppMessage == nil && p.EmailMessage == nil && p.ReplyReminder == nil &&
		p.TriggerQuery == nil && p.PendingQuery == nil &&
		p.MemoryQuery == nil && p.MemoryUpdate == nil && p.MemoryDelete == nil &&
		p.ContactsQuery == nil &&
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

// ImageDescriber descreve uma imagem em texto puro.
//
// Separado do ParseIntent (que devolve JSON de ação) porque o enriquecimento do
// histórico do WhatsApp precisa da DESCRIÇÃO, não de uma ação.
type ImageDescriber interface {
	DescribeImage(ctx context.Context, imageB64, imageMime, prompt string) (string, error)
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
