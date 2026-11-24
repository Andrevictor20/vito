package bots

import (
	"context"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// BotRunnerExecutor executa um bot sob demanda (POST /api/v1/bots/{id}/run).
type BotRunnerExecutor interface {
	RunBotNow(ctx context.Context, userID, botID string) (*domain.BotRunReport, error)
}

// BotChatServicer gerencia o histórico e o envio de mensagens no chat isolado do bot.
type BotChatServicer interface {
	GetMessages(ctx context.Context, userID, botID string) ([]BotChatMessageDTO, error)
	SendMessage(ctx context.Context, userID, botID, message string) (*BotChatMessageDTO, error)
}

// BotChatMessageDTO representa uma mensagem do chat isolado do bot.
type BotChatMessageDTO struct {
	ID                    string                `json:"id"`
	Role                  string                `json:"role"`
	Content               string                `json:"content"`
	CreatedAt             string                `json:"created_at"`
	ModelUsed             string                `json:"model_used,omitempty"`
	Cards                 []domain.ChatCard     `json:"cards,omitempty"`
	ToolCalls             []domain.ExecutedTool `json:"tool_calls,omitempty"`
	RequiresConfirmation  bool                  `json:"requires_confirmation,omitempty"`
	PendingConfirmationID string                `json:"pending_confirmation_id,omitempty"`
	SuggestedChips        []string              `json:"suggested_chips,omitempty"`
}

// BotActionDTO enriquece domain.BotAction com metadados do catálogo e conexão do app.
type BotActionDTO struct {
	ID           string              `json:"id,omitempty"`
	BotID        string              `json:"bot_id,omitempty"`
	ActionKey    string              `json:"action_key"`
	AppKey       string              `json:"app_key"`
	Label        string              `json:"label"`
	IsWrite      bool                `json:"is_write"`
	AlwaysAsk    bool                `json:"always_ask"`
	Policy       domain.ActionPolicy `json:"policy"`
	AppConnected bool                `json:"app_connected"`
	ConfigJSON   string              `json:"config_json,omitempty"`
}

// BotSkillDTO enriquece domain.BotSkill com metadados do catálogo e status de atualização (AC-11).
type BotSkillDTO struct {
	ID                string   `json:"id,omitempty"`
	BotID             string   `json:"bot_id,omitempty"`
	SkillKey          string   `json:"skill_key"`
	Name              string   `json:"name"`
	Icon              string   `json:"icon,omitempty"`
	Description       string   `json:"description,omitempty"`
	When              string   `json:"when,omitempty"`
	Steps             []string `json:"steps,omitempty"`
	Actions           []string `json:"actions,omitempty"`
	Version           int      `json:"version"`
	LatestVersion     int      `json:"latest_version,omitempty"`
	HasUpgrade        bool     `json:"has_upgrade,omitempty"`
	UpgradeNewActions []string `json:"upgrade_new_actions,omitempty"`
}

// BotPendingConfirmationDTO representa uma ação suspensa aguardando aprovação do usuário.
type BotPendingConfirmationDTO struct {
	ConfirmationID string `json:"confirmation_id"`
	ActionKey      string `json:"action_key"`
	AppKey         string `json:"app_key,omitempty"`
	Label          string `json:"label"`
	Summary        string `json:"summary"`
	AlwaysAsk      bool   `json:"always_ask"`
	CreatedAt      string `json:"created_at,omitempty"`
}

// BotActionsSummaryDTO resume os contadores de políticas do bot.
type BotActionsSummaryDTO struct {
	Total  int `json:"total"`
	Auto   int `json:"auto"`
	Ask    int `json:"ask"`
	Locked int `json:"locked"`
}

// BotLastRunDTO resume a última execução do bot para exibição em cards.
type BotLastRunDTO struct {
	Summary string `json:"summary"`
	At      string `json:"at,omitempty"`
	Status  string `json:"status,omitempty"`
}

// BotRunLogDTO representa um registro de execução em trigger_logs.
type BotRunLogDTO struct {
	ID          string               `json:"id"`
	BotID       string               `json:"bot_id"`
	TriggeredAt string               `json:"triggered_at"`
	Message     string               `json:"message"`
	Payload     string               `json:"payload,omitempty"`
	Report      *domain.BotRunReport `json:"report,omitempty"`
	Status      string               `json:"status,omitempty"`
	ModelUsed   string               `json:"model_used,omitempty"`
}

// BotResponse é o payload completo retornado pelos endpoints /api/v1/bots.
type BotResponse struct {
	ID                  string                      `json:"id"`
	UserID              string                      `json:"user_id,omitempty"`
	Title               string                      `json:"title"`
	Goal                string                      `json:"goal"`
	Rules               []string                    `json:"rules"`
	Category            string                      `json:"category"`
	Icon                string                      `json:"icon,omitempty"`
	Color               string                      `json:"color,omitempty"`
	SkinJSON            string                      `json:"skin_json,omitempty"`
	TemplateKey         string                      `json:"template_key,omitempty"`
	Status              domain.TriggerStatus        `json:"status"`
	Frequency           domain.TriggerFrequency     `json:"frequency,omitempty"`
	ScheduledTime       string                      `json:"scheduled_time,omitempty"`
	DaysOfWeek          string                      `json:"days_of_week,omitempty"`
	QuietOnlyOnChange   bool                        `json:"quiet_only_on_change"`
	ThreadID            string                      `json:"thread_id,omitempty"`
	ConsecutiveFailures int                         `json:"consecutive_failures"`
	ModelPref           string                      `json:"model_pref,omitempty"`
	EffortPref          string                      `json:"effort_pref,omitempty"`
	LastRunStatus       string                      `json:"last_run_status,omitempty"`
	LastError           string                      `json:"last_error,omitempty"`
	LastCheckedAt       *time.Time                  `json:"last_checked_at,omitempty"`
	NextCheckAt         *time.Time                  `json:"next_check_at,omitempty"`
	CreatedAt           time.Time                   `json:"created_at"`
	UpdatedAt           time.Time                   `json:"updated_at"`
	Actions             []BotActionDTO              `json:"actions"`
	Skills              []BotSkillDTO               `json:"skills"`
	Memories            []domain.BotMemory          `json:"memories,omitempty"`
	Pending             []BotPendingConfirmationDTO `json:"pending"`
	Apps                []BotAppStatusDTO           `json:"apps"`
	ActionsSummary      BotActionsSummaryDTO        `json:"actions_summary"`
	Last                *BotLastRunDTO              `json:"last,omitempty"`
	Logs                []BotRunLogDTO              `json:"logs,omitempty"`
}
