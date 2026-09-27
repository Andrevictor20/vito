package ai

import (
	"context"
	"time"
)

// IntentAction define o tipo de ação interpretada pela IA.
type IntentAction string

const (
	ActionCreateEvent   IntentAction = "CREATE_EVENT"
	ActionCreateTodo    IntentAction = "CREATE_TODO"
	ActionQuerySchedule IntentAction = "QUERY_SCHEDULE"
	ActionSaveMemory    IntentAction = "SAVE_MEMORY"
	ActionGeneralChat   IntentAction = "GENERAL_CHAT"
	ActionOutOfScope    IntentAction = "OUT_OF_SCOPE"
)

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
}

// ParsedEvent dados extraídos para criação de evento.
type ParsedEvent struct {
	Title       string    `json:"title"`
	Description string    `json:"description,omitempty"`
	Location    string    `json:"location,omitempty"`
	StartAt     time.Time `json:"start_at"`
	EndAt       time.Time `json:"end_at"`
}

// ParsedTodo dados extraídos para criação de to-do.
type ParsedTodo struct {
	Title    string     `json:"title"`
	Priority string     `json:"priority"` // low, medium, high
	DueDate  *time.Time `json:"due_date,omitempty"`
}

// ParsedIntent resultado normalizado da interpretação do assistente Toki-like.
type ParsedIntent struct {
	Action         IntentAction `json:"action"`
	Message        string       `json:"message"` // Resposta amigável da secretária
	Event          *ParsedEvent `json:"event,omitempty"`
	Todo           *ParsedTodo  `json:"todo,omitempty"`
	MemoryContent  string       `json:"memory_content,omitempty"`
	MemoryCategory string       `json:"memory_category,omitempty"`
	ProviderUsed   string       `json:"provider_used,omitempty"`
}

// Provider contrato unificado para provedores de IA (Google, OpenRouter, Groq).
type Provider interface {
	Name() string
	ParseIntent(ctx context.Context, input UserInput) (*ParsedIntent, error)
}
