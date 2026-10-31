package domain

import (
	"context"
	"encoding/json"
)

// ToolsetName enumera as 8 Macro-Ferramentas polimórficas (§5.6.1).
type ToolsetName string

const (
	ToolsetCalendar       ToolsetName = "calendar_manager"
	ToolsetTaskPending    ToolsetName = "task_and_pending_manager"
	ToolsetMeetingBooking ToolsetName = "meeting_and_booking_manager"
	ToolsetWhatsApp       ToolsetName = "whatsapp_assistant"
	ToolsetGmail          ToolsetName = "gmail_assistant"
	ToolsetRadarTrigger   ToolsetName = "radar_and_trigger_manager"
	ToolsetMemoryProfile  ToolsetName = "memory_and_profile"
	ToolsetWebSearch      ToolsetName = "web_and_vertical_search"
)

// ToolExecutionContext carrega metadados de segurança e Taint Tracking do turno atual.
type ToolExecutionContext struct {
	UserID                  string
	ThreadID                string
	TurnID                  string
	Channel                 string // "app_mobile", "app_desktop", "whatsapp", "voice"
	FocusMode               string // "default", "finance", "shopping", "jobs", "academic"
	AutonomyLevel           string
	WhatsAppPrivateScope    bool
	TaintedByUntrustedInput bool
	TaintSources            []string
}

// ToolOperationEnvelope é a estrutura polimórfica padrão de qualquer chamada aos 8 Toolsets.
type ToolOperationEnvelope struct {
	Operation string          `json:"operation"`
	Params    json.RawMessage `json:"params"`
}

// ToolExecutionResult é o retorno rico de uma Macro-Ferramenta para o AgentLoop.
type ToolExecutionResult struct {
	Status                string         `json:"status"` // "COMPLETED", "AWAITING_USER_CONFIRMATION", "ERROR"
	Data                  any            `json:"data,omitempty"`
	SummaryForLLM         string         `json:"summary_for_llm"`
	Cards                 []ChatCard     `json:"cards,omitempty"`
	Sources               []SearchSource `json:"sources,omitempty"`
	MarksContextAsTainted bool           `json:"marks_context_as_tainted,omitempty"`
	TaintSourceLabel      string         `json:"taint_source_label,omitempty"`
	RequiresConfirmation  bool           `json:"requires_confirmation,omitempty"`
	PendingConfirmationID string         `json:"pending_confirmation_id,omitempty"`
}

// SearchSource representa uma fonte verificável retornada por web_and_vertical_search.
type SearchSource struct {
	Title   string `json:"title"`
	URL     string `json:"url"`
	Snippet string `json:"snippet,omitempty"`
}

// ChatCard representa um card estruturado renderizável no chat (Mobile e Desktop).
type ChatCard struct {
	ID          string `json:"id"`
	Type        string `json:"type"` // "event", "todo", "booking", "meeting", "trigger", "pending", "gmail", "whatsapp"
	Title       string `json:"title"`
	Subtitle    string `json:"subtitle,omitempty"`
	ActionLabel string `json:"action_label,omitempty"`
	ActionValue string `json:"action_value,omitempty"`
	Confirm     bool   `json:"confirm,omitempty"`
	Dismiss     bool   `json:"dismiss,omitempty"`
}

// DomainToolset é a interface implementada por cada uma das 8 Macro-Ferramentas.
type DomainToolset interface {
	Name() ToolsetName
	Description() string
	JSONSchema() json.RawMessage
	// IsWriteOperation informa se a operação altera estado externo ou exige Confirmation Gate.
	IsWriteOperation(operation string, rawParams json.RawMessage) (isWrite bool, isDestructive bool, preview map[string]any)
	// Execute roda a operação em Go e já constrói os ChatCards correspondentes.
	Execute(ctx context.Context, execCtx *ToolExecutionContext, operation string, rawParams json.RawMessage) (*ToolExecutionResult, error)
}

// StreamEventType padroniza os eventos SSE enviados para Mobile e Desktop (§5.6.7).
type StreamEventType string

const (
	SSEStatus    StreamEventType = "status"
	SSEReasoning StreamEventType = "reasoning"
	SSEToken     StreamEventType = "token"
	SSECard      StreamEventType = "card"
	SSEDone      StreamEventType = "done"
)

// ScopeGuard é a interface para verificação de segurança antes de execução de escrita.
// Implementado pelo Agente 2 (a ser criado), integrado ao agent_loop.go e ao confirmation_state_machine.go.
type ScopeGuard interface {
	// CanExecute retorna se a operação pode ser executada sem confirmação humana.
	// Se isWrite for true e o contexto estiver tainted, retorna false.
	CanExecute(ctx context.Context, execCtx *ToolExecutionContext, operation string, isWrite bool) (allowed bool, reason string)
	// MarkTainted marca o turno atual como contaminado por dados externos não confiáveis.
	MarkTainted(ctx context.Context, turnID string, source string)
	// IsTainted retorna se o turno está contaminado.
	IsTainted(ctx context.Context, turnID string) bool
}

// UnifiedAssistantRequest é o contrato único de entrada para Mobile, Desktop, WhatsApp e Voz.
type UnifiedAssistantRequest struct {
	UserID           string `json:"user_id"`
	ThreadID         string `json:"thread_id,omitempty"`
	Channel          string `json:"channel"` // "app_mobile", "app_desktop", "whatsapp", "voice"
	Message          string `json:"message"`
	Prompt           string `json:"prompt,omitempty"` // Alias compatível com clientes legados
	FocusMode        string `json:"focus_mode,omitempty"`
	StyleOverride    string `json:"style_override,omitempty"`
	ConfirmPendingID string `json:"confirm_pending_id,omitempty"`
	RejectPendingID  string `json:"reject_pending_id,omitempty"`
	QuotedContext    string `json:"quoted_context,omitempty"`
	ImageB64         string `json:"image_b64,omitempty"`
	ImageMime        string `json:"image_mime,omitempty"`
}

// UnifiedAssistantResponse é o contrato único de saída para todos os canais (§5.6.7).
type UnifiedAssistantResponse struct {
	ThreadID              string         `json:"thread_id"`
	TurnID                string         `json:"turn_id"`
	Text                  string         `json:"text"`
	Reply                 string         `json:"reply,omitempty"`   // Paridade com Mobile e Desktop
	Message               string         `json:"message,omitempty"` // Paridade com Mobile e Desktop
	Reasoning             []string       `json:"reasoning,omitempty"`
	ToolCalls             []ExecutedTool `json:"tool_calls,omitempty"`
	Cards                 []ChatCard     `json:"cards,omitempty"`
	Sources               []SearchSource `json:"sources,omitempty"`
	RequiresConfirmation  bool           `json:"requires_confirmation"`
	PendingConfirmationID string         `json:"pending_confirmation_id,omitempty"`
	SuggestedActions      []string       `json:"suggested_actions,omitempty"`
	Telemetry             TurnTelemetry  `json:"telemetry"`
}

type ExecutedTool struct {
	Tool      string `json:"tool"`
	Operation string `json:"operation"`
	Status    string `json:"status"`
}

type TurnTelemetry struct {
	ProviderUsed string `json:"provider_used"`
	ModelUsed    string `json:"model_used"`
	TokensIn     int    `json:"tokens_in"`
	TokensOut    int    `json:"tokens_out"`
	LatencyMs    int64  `json:"latency_ms"`
}
