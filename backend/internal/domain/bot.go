package domain

import (
	"errors"
	"time"
)

const MaxBotSkills = 6

var (
	ErrBotNotFound              = errors.New("bot não encontrado")
	ErrUnknownAction            = errors.New("ação desconhecida no catálogo")
	ErrAlwaysAskPolicyViolation = errors.New("ação sensível sempre exige aprovação e não pode ser automática")
	ErrInvalidActionPolicy      = errors.New("política de ação inválida")
	ErrMaxSkillsExceeded        = errors.New("limite máximo de habilidades por bot atingido")
	ErrSkillNotFound            = errors.New("habilidade não encontrada")
)

// ActionPolicy define o nível de autonomia de uma ação do bot.
type ActionPolicy string

const (
	ActionPolicyAuto ActionPolicy = "auto"
	ActionPolicyAsk  ActionPolicy = "ask"
	ActionPolicyOff  ActionPolicy = "off"
)

// IsValid informa se a política pertence ao conjunto permitido.
func (p ActionPolicy) IsValid() bool {
	return p == ActionPolicyAuto || p == ActionPolicyAsk || p == ActionPolicyOff
}

// AlwaysAskActions reúne ações irreversíveis ou externas que nunca podem virar auto.
var AlwaysAskActions = map[string]bool{
	"wasend": true,
}

// IsAlwaysAskAction retorna true se a ação pertence ao conjunto ALWAYS.
func IsAlwaysAskAction(actionKey string) bool {
	return AlwaysAskActions[actionKey]
}

// ActionSpec descreve uma ação do catálogo (§3 do Plano 04).
type ActionSpec struct {
	AppKey        string       `json:"app_key"`
	ActionKey     string       `json:"action_key"`
	Label         string       `json:"label"`
	Toolset       string       `json:"toolset,omitempty"`
	Operations    []string     `json:"operations,omitempty"`
	IsWrite       bool         `json:"is_write"`
	AlwaysAsk     bool         `json:"always_ask"`
	DefaultPolicy ActionPolicy `json:"default_policy"`
}

// ActionCatalog define todas as ações oficiais suportadas pelos bots (§3).
var ActionCatalog = map[string]ActionSpec{
	"notify": {AppKey: "vito", ActionKey: "notify", Label: "Avisar você", DefaultPolicy: ActionPolicyAuto},
	"task":   {AppKey: "vito", ActionKey: "task", Label: "Criar tarefa", Toolset: "task_and_pending_manager", Operations: []string{"create_todo"}, IsWrite: true, DefaultPolicy: ActionPolicyAsk},
	"search": {AppKey: "web", ActionKey: "search", Label: "Pesquisar fontes", Toolset: "web_and_vertical_search", Operations: []string{"search", "read_page"}, DefaultPolicy: ActionPolicyAuto},
	"spend":  {AppKey: "fin", ActionKey: "spend", Label: "Ler gastos e orçamentos", Toolset: "finance_manager", Operations: []string{"get_summary", "list_transactions", "list_budgets"}, DefaultPolicy: ActionPolicyAuto},
	"free":   {AppKey: "gcal", ActionKey: "free", Label: "Ver horários livres", Toolset: "calendar_manager", Operations: []string{"list_events", "check_conflicts"}, DefaultPolicy: ActionPolicyAuto},
	"evt":    {AppKey: "gcal", ActionKey: "evt", Label: "Criar evento", Toolset: "calendar_manager", Operations: []string{"create_event"}, IsWrite: true, DefaultPolicy: ActionPolicyAsk},
	"mailr":  {AppKey: "gmail", ActionKey: "mailr", Label: "Ler e-mails", Toolset: "gmail_assistant", Operations: []string{"search_emails", "scan_emails"}, DefaultPolicy: ActionPolicyAuto},
	"draft":  {AppKey: "gmail", ActionKey: "draft", Label: "Rascunhar resposta", Toolset: "gmail_assistant", Operations: []string{"create_draft"}, DefaultPolicy: ActionPolicyAuto},
	"waread": {AppKey: "wa", ActionKey: "waread", Label: "Ler conversas e mensagens", Toolset: "whatsapp_assistant", Operations: []string{"search_messages", "recent_chats"}, DefaultPolicy: ActionPolicyAuto},
	"wasend": {AppKey: "wa", ActionKey: "wasend", Label: "Enviar mensagem", Toolset: "whatsapp_assistant", Operations: []string{"send_message"}, IsWrite: true, AlwaysAsk: true, DefaultPolicy: ActionPolicyAsk},
	"omail":  {AppKey: "outlook", ActionKey: "omail", Label: "Ler e-mails do Outlook", Toolset: "outlook_assistant", Operations: []string{"search_emails"}, DefaultPolicy: ActionPolicyAuto},
	"oevt":   {AppKey: "outlook", ActionKey: "oevt", Label: "Criar evento no Outlook", Toolset: "outlook_assistant", Operations: []string{"create_event"}, IsWrite: true, DefaultPolicy: ActionPolicyAsk},
	"route":  {AppKey: "maps", ActionKey: "route", Label: "Calcular rota e tempo", Toolset: "maps_commute", Operations: []string{"compute_route"}, DefaultPolicy: ActionPolicyAuto},
	"leave":  {AppKey: "maps", ActionKey: "leave", Label: "Avisar a hora de sair", Toolset: "maps_commute", Operations: []string{"departure_time"}, DefaultPolicy: ActionPolicyAuto},
	"tcard":  {AppKey: "trello", ActionKey: "tcard", Label: "Criar cartão", Toolset: "trello_board", Operations: []string{"create_card"}, IsWrite: true, DefaultPolicy: ActionPolicyAsk},
	"tmove":  {AppKey: "trello", ActionKey: "tmove", Label: "Mover cartão", Toolset: "trello_board", Operations: []string{"move_card"}, IsWrite: true, DefaultPolicy: ActionPolicyAsk},
}

// ValidateActionPolicy valida existência da ação e bloqueia auto em ações ALWAYS.
func ValidateActionPolicy(actionKey string, policy ActionPolicy) error {
	spec, ok := ActionCatalog[actionKey]
	if !ok {
		return ErrUnknownAction
	}
	if !policy.IsValid() {
		return ErrInvalidActionPolicy
	}
	if (spec.AlwaysAsk || IsAlwaysAskAction(actionKey)) && policy == ActionPolicyAuto {
		return ErrAlwaysAskPolicyViolation
	}
	return nil
}

// Bot representa um agente especializado persistido sobre triggers + tabelas bot_*.
type Bot struct {
	ID                  string           `json:"id"`
	UserID              string           `json:"user_id"`
	Title               string           `json:"title"`
	Goal                string           `json:"goal"`
	Rules               []string         `json:"rules"`
	Category            string           `json:"category"`
	Icon                string           `json:"icon"`
	Color               string           `json:"color"`
	SkinJSON            string           `json:"skin_json"`
	TemplateKey         string           `json:"template_key,omitempty"`
	Query               string           `json:"query,omitempty"`
	ConditionType       string           `json:"condition_type,omitempty"`
	TargetValue         string           `json:"target_value,omitempty"`
	CurrentValue        string           `json:"current_value,omitempty"`
	Status              TriggerStatus    `json:"status"`
	Frequency           TriggerFrequency `json:"frequency"`
	ScheduledTime       string           `json:"scheduled_time,omitempty"`
	DaysOfWeek          string           `json:"days_of_week,omitempty"`
	QuietOnlyOnChange   bool             `json:"quiet_only_on_change"`
	ThreadID            string           `json:"thread_id,omitempty"`
	ConsecutiveFailures int              `json:"consecutive_failures"`
	ModelPref           string           `json:"model_pref,omitempty"`
	EffortPref          string           `json:"effort_pref,omitempty"`
	LastRunStatus       string           `json:"last_run_status,omitempty"`
	LastError           string           `json:"last_error,omitempty"`
	LastCheckedAt       *time.Time       `json:"last_checked_at,omitempty"`
	NextCheckAt         *time.Time       `json:"next_check_at,omitempty"`
	CreatedAt           time.Time        `json:"created_at"`
	UpdatedAt           time.Time        `json:"updated_at"`
	Actions             []BotAction      `json:"actions,omitempty"`
	Skills              []BotSkill       `json:"skills,omitempty"`
	Memories            []BotMemory      `json:"memories,omitempty"`
}

// BotAction representa uma permissão de ação configurada para um bot.
type BotAction struct {
	ID         string       `json:"id"`
	BotID      string       `json:"bot_id"`
	UserID     string       `json:"user_id"`
	ActionKey  string       `json:"action_key"`
	Policy     ActionPolicy `json:"policy"`
	ConfigJSON string       `json:"config_json,omitempty"`
	CreatedAt  time.Time    `json:"created_at"`
	UpdatedAt  time.Time    `json:"updated_at"`
}

// BotSkill representa um pacote de habilidade versionado anexado a um bot.
type BotSkill struct {
	ID        string    `json:"id"`
	BotID     string    `json:"bot_id"`
	UserID    string    `json:"user_id"`
	SkillKey  string    `json:"skill_key"`
	Version   int       `json:"version"`
	CreatedAt time.Time `json:"created_at"`
}

// BotMemory representa uma memória isolada pertencente a um bot.
type BotMemory struct {
	ID        string    `json:"id"`
	BotID     string    `json:"bot_id"`
	UserID    string    `json:"user_id"`
	Content   string    `json:"content"`
	Source    string    `json:"source"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BotRunReport estrutura o payload v2 de trigger_logs para execuções de bots.
type BotRunReport struct {
	Summary                string   `json:"summary"`
	Verified               []string `json:"verified"`
	Did                    []string `json:"did"`
	Waiting                []string `json:"waiting"`
	Cant                   []string `json:"cant"`
	PendingConfirmationIDs []string `json:"pending_confirmation_ids,omitempty"`
	ModelUsed              string   `json:"model_used,omitempty"`
	ShouldNotify           bool     `json:"should_notify,omitempty"`
}
