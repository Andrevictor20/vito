package ai

import (
	"context"
	"encoding/json"
	"time"
)

// TaskCategory classifica a natureza da chamada de IA para telemetria e roteamento.
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

// ToolCall representa a solicitação do modelo para invocar uma ferramenta.
type ToolCall struct {
	ID               string          `json:"id"`
	Name             string          `json:"name"`
	Arguments        json.RawMessage `json:"arguments"`
	ThoughtSignature string          `json:"thought_signature,omitempty"`
}

// StreamDelta representa um fragmento emitido em tempo real durante streaming SSE.
type StreamDelta struct {
	Type           string     `json:"type,omitempty"`
	ToolName       string     `json:"tool_name,omitempty"`
	TextDelta      string     `json:"text_delta,omitempty"`
	ReasoningDelta string     `json:"reasoning_delta,omitempty"`
	ToolCalls      []ToolCall `json:"tool_calls,omitempty"`
	Done           bool       `json:"done,omitempty"`
}

// AITrace representa um registro de telemetria para o Ring Buffer (Fase 0 / §5.6.5).
type AITrace struct {
	ID                     string
	UserID                 string
	ThreadID               string
	TurnID                 string
	Channel                string
	AgentName              string
	TaskType               TaskCategory
	CredentialSource       string
	ProviderKey            string
	Effort                 string
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
