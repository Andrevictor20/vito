package ai

import (
	"context"
	"time"
)

// IntentAction define o tipo de ação interpretada pela IA.
type IntentAction string

const (
	ActionCreateEvent   IntentAction = "CREATE_EVENT"
	ActionUpdateEvent   IntentAction = "UPDATE_EVENT"
	ActionDeleteEvent   IntentAction = "DELETE_EVENT"
	ActionCreateTodo    IntentAction = "CREATE_TODO"
	ActionQuerySchedule IntentAction = "QUERY_SCHEDULE"
	ActionSaveMemory    IntentAction = "SAVE_MEMORY"
	ActionCreateTrigger IntentAction = "CREATE_TRIGGER"
	ActionGeneralChat   IntentAction = "GENERAL_CHAT"
	ActionOutOfScope    IntentAction = "OUT_OF_SCOPE"
)

// ChatMessageContext representa uma mensagem no histórico da conversa para contexto multi-turn.
type ChatMessageContext struct {
	Sender string `json:"sender"` // "user" ou "vito"
	Text   string `json:"text"`
}

// UserInput encapsula a mensagem de entrada do usuário (texto ou áudio em base64).
type UserInput struct {
	Text                string               `json:"text,omitempty"`
	AudioB64            string               `json:"audio_b64,omitempty"`
	AudioMime           string               `json:"audio_mime,omitempty"`
	ImageB64            string               `json:"image_b64,omitempty"`
	ImageMime           string               `json:"image_mime,omitempty"`
	Timezone            string               `json:"timezone,omitempty"` // ex: "America/Sao_Paulo"
	Now                 time.Time            `json:"now"`
	ContextMemories     []string             `json:"context_memories,omitempty"`     // RAG in-context pessoal
	ActiveSchedule      []string             `json:"active_schedule,omitempty"`      // Próximos compromissos
	PendingTodos        []string             `json:"pending_todos,omitempty"`        // Tarefas urgentes/pendentes
	ActiveTriggers      []string             `json:"active_triggers,omitempty"`      // Vigílias / disparadores em andamento
	ConversationHistory []ChatMessageContext `json:"conversation_history,omitempty"` // Histórico recente da conversa multi-turn
	UserName            string               `json:"user_name,omitempty"`            // Nome do usuário para personalização
	AutonomyMode        string               `json:"autonomy_mode,omitempty"`        // "assisted" (padrão) | "proactive"
}

// ParsedEvent dados extraídos para criação, atualização ou remoção de evento.
type ParsedEvent struct {
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	Location    string    `json:"location,omitempty"`
	StartAt     time.Time `json:"start_at"`
	EndAt       time.Time `json:"end_at"`
	Recurrence  string    `json:"recurrence,omitempty"`   // "WEEKLY", "DAILY", "MONTHLY"
	TargetQuery string    `json:"target_query,omitempty"` // termo para busca ao atualizar/excluir (ex: "aula de inglês")

	startWallClock bool
	endWallClock   bool
}

// ParsedTodo dados extraídos para criação de to-do.
type ParsedTodo struct {
	Title    string     `json:"title"`
	Priority string     `json:"priority"` // low, medium, high
	DueDate  *time.Time `json:"due_date,omitempty"`

	dueWallClock bool
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

// ParsedIntent resultado normalizado da interpretação do assistente Toki-like.
type ParsedIntent struct {
	Action         IntentAction   `json:"action"`
	Message        string         `json:"message"` // Resposta amigável da secretária
	Event          *ParsedEvent   `json:"event,omitempty"`
	Todo           *ParsedTodo    `json:"todo,omitempty"`
	Trigger        *ParsedTrigger `json:"trigger,omitempty"`
	MemoryContent  string         `json:"memory_content,omitempty"`
	MemoryCategory string         `json:"memory_category,omitempty"`
	ProviderUsed   string         `json:"provider_used,omitempty"`
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
