package ai

import (
	"context"
	"encoding/json"
	"time"
)

// TaskCategory classifica a natureza da chamada para o ModelRouter.
type TaskCategory string

const (
	TaskChat           TaskCategory = "chat"
	TaskToolUse        TaskCategory = "tool_use"
	TaskGrounding      TaskCategory = "grounding"
	TaskMemoryConsolid TaskCategory = "memory_consolidation"
	TaskVision         TaskCategory = "vision"
	TaskClassification TaskCategory = "classification"
)

// PersonaStyle representa os 5 estilos selecionáveis pelo usuário (§5.5).
type PersonaStyle string

const (
	StyleBalanced     PersonaStyle = "balanced"     // Equilibrado (Padrão)
	StyleDirect       PersonaStyle = "direct"       // Direto
	StyleWarm         PersonaStyle = "warm"         // Caloroso
	StyleProfessional PersonaStyle = "professional" // Profissional
	StyleRelaxed      PersonaStyle = "relaxed"      // Descontraído
)

// ChatRole padroniza os papéis dos turnos reais (resolvendo C2).
type ChatRole string

const (
	RoleSystem    ChatRole = "system"
	RoleUser      ChatRole = "user"
	RoleAssistant ChatRole = "assistant"
	RoleTool      ChatRole = "tool"
)

// TurnMessage representa um turno real enviado ao modelo.
type TurnMessage struct {
	Role       ChatRole        `json:"role"`
	Content    string          `json:"content,omitempty"`
	ToolCalls  []ToolCall      `json:"tool_calls,omitempty"`
	ToolCallID string          `json:"tool_call_id,omitempty"`
	Name       string          `json:"name,omitempty"`
	ImageBytes []byte          `json:"-"`
	ImageMIME  string          `json:"-"`
}

// ToolDefinition descreve uma das 8 Macro-Ferramentas (Domain Toolsets) para Function Calling.
type ToolDefinition struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Parameters  json.RawMessage `json:"parameters"` // JSON Schema Draft-07 compacto
}

// ToolCall representa a solicitação do modelo para invocar uma Macro-Ferramenta.
type ToolCall struct {
	ID        string          `json:"id"`
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

// AgentChatRequest encapsula a entrada padronizada independente de provedor.
type AgentChatRequest struct {
	ThreadID     string           `json:"thread_id"`
	UserID       string           `json:"user_id"`
	Channel      string           `json:"channel"`
	Task         TaskCategory     `json:"task"`
	SystemPrompt string           `json:"system_prompt"`
	Messages     []TurnMessage    `json:"messages"`
	Tools        []ToolDefinition `json:"tools,omitempty"`
	Temperature  *float64         `json:"temperature,omitempty"`
	MaxTokens    int              `json:"max_tokens,omitempty"`
	RequireTools bool             `json:"require_tools,omitempty"`
}

// AgentChatResponse encapsula a resposta padronizada do provedor.
type AgentChatResponse struct {
	Text         string     `json:"text"`
	Reasoning    []string   `json:"reasoning,omitempty"`
	ToolCalls    []ToolCall `json:"tool_calls,omitempty"`
	ProviderName string     `json:"provider_name"`
	ModelName    string     `json:"model_name"`
	TokensIn     int        `json:"tokens_in"`
	TokensOut    int        `json:"tokens_out"`
	LatencyMs    int64      `json:"latency_ms"`
}

// StreamDelta representa um fragmento emitido em tempo real durante StreamChat.
type StreamDelta struct {
	TextDelta      string             `json:"text_delta,omitempty"`
	ReasoningDelta string             `json:"reasoning_delta,omitempty"`
	ToolCalls      []ToolCall         `json:"tool_calls,omitempty"`
	Done           bool               `json:"done,omitempty"`
	FinalMetrics   *AgentChatResponse `json:"final_metrics,omitempty"`
}

// AgentProvider é a interface padronizada independente de provedor (Rev. 5 / Rev. 6).
type AgentProvider interface {
	Name() string
	ModelName() string
	SupportsTools() bool
	SupportsVision() bool
	QualityTier() int // 3 = Alto (Gemini 2.5 Flash), 2 = Médio, 1 = Pequeno (não executa escrita)
	MaxContextTokens() int
	Chat(ctx context.Context, req AgentChatRequest) (*AgentChatResponse, error)
	StreamChat(ctx context.Context, req AgentChatRequest, onDelta func(StreamDelta) error) (*AgentChatResponse, error)
}

// AITrace representa um registro de telemetria para o Ring Buffer (Fase 0 / §5.6.5).
type AITrace struct {
	ID                     string
	UserID                 string
	ThreadID               string
	TurnID                 string
	Channel                string
	TaskType               TaskCategory
	ProviderName           string
	ModelName              string
	StepIndex              int
	ToolsetCalled          string
	OperationCalled        string
	FallbackTriggered      bool
	FallbackReason         string
	TaintedTurn            bool
	ConfirmationGateStatus string
	TokensIn               int
	TokensOut              int
	LatencyMs              int64
	StatusCode             int
	ErrorCode              string
	CreatedAt              time.Time
}

// TraceRecorder permite gravar traces sem bloquear a goroutine do chat.
type TraceRecorder interface {
	RecordAsync(trace AITrace)
	FlushNow(ctx context.Context) error
}
