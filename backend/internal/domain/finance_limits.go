package domain

import "time"

// SpendingLimitScope define a dimensão monitorada por um limite de gasto.
type SpendingLimitScope string

const (
	LimitScopeCard          SpendingLimitScope = "CARD"
	LimitScopeCategory      SpendingLimitScope = "CATEGORY"
	LimitScopeSubscriptions SpendingLimitScope = "SUBSCRIPTIONS"
	LimitScopeMerchant      SpendingLimitScope = "MERCHANT"
	LimitScopeGlobalMonthly SpendingLimitScope = "GLOBAL_MONTHLY"
	LimitScopeSavingsGoal   SpendingLimitScope = "SAVINGS_GOAL"
)

// LimitPeriodType define a janela temporal de apuração do limite.
type LimitPeriodType string

const (
	LimitPeriodMonthly      LimitPeriodType = "MONTHLY"
	LimitPeriodBillingCycle LimitPeriodType = "BILLING_CYCLE"
	LimitPeriodWeekly       LimitPeriodType = "WEEKLY"
	LimitPeriodDaily        LimitPeriodType = "DAILY"
)

// FinanceLimitRule representa um limite de gasto multi-escopo ou meta de economia.
type FinanceLimitRule struct {
	ID                 string             `json:"id"`
	UserID             string             `json:"user_id"`
	Kind               BudgetKind         `json:"kind"`
	ScopeType          SpendingLimitScope `json:"scope_type"`
	Title              string             `json:"title"`
	CategoryFilter     string             `json:"category_filter,omitempty"`
	AccountID          string             `json:"account_id,omitempty"`
	MerchantID         string             `json:"merchant_id,omitempty"`
	MerchantPattern    string             `json:"merchant_pattern,omitempty"`
	PeriodType         LimitPeriodType    `json:"period_type"`
	TargetAmount       float64            `json:"target_amount"`
	CurrentAmount      float64            `json:"current_amount"`
	DeadlineDate       string             `json:"deadline_date,omitempty"`
	AutoAlertThreshold int                `json:"auto_alert_threshold"`
	AlertThresholds    []int              `json:"alert_thresholds"`
	RepeatOverStepPct  int                `json:"repeat_over_step_percent"`
	PaceAlertEnabled   bool               `json:"pace_alert_enabled"`
	NotifyChannels     []string           `json:"notify_channels"`
	IncludePending     bool               `json:"include_pending"`
	IsActive           bool               `json:"is_active"`
	MutedUntil         *time.Time         `json:"muted_until,omitempty"`
	CreatedAt          time.Time          `json:"created_at"`
	UpdatedAt          time.Time          `json:"updated_at"`
}

// FinanceLimitStatus combina a regra de limite com o consumo calculado em SQL/Go.
type FinanceLimitStatus struct {
	Rule            FinanceLimitRule     `json:"rule"`
	PeriodKey       string               `json:"period_key"`
	CycleStart      time.Time            `json:"cycle_start"`
	CycleEnd        time.Time            `json:"cycle_end"`
	SpentAmount     float64              `json:"spent_amount"`
	PercentUsed     float64              `json:"percent_used"`
	RemainingAmount float64              `json:"remaining_amount"`
	ProjectedAmount float64              `json:"projected_amount"`
	StatusLabel     string               `json:"status_label"` // OK | WARNING | PACE_RISK | EXCEEDED
	TopContributors []FinanceTransaction `json:"top_contributors,omitempty"`
}

// FinanceLimitSuggestion sugere limites iniciais com base no histórico do usuário.
type FinanceLimitSuggestion struct {
	ScopeType       SpendingLimitScope `json:"scope_type"`
	Title           string             `json:"title"`
	CategoryFilter  string             `json:"category_filter,omitempty"`
	AccountID       string             `json:"account_id,omitempty"`
	SuggestedAmount float64            `json:"suggested_amount"`
	BaselineSpend   float64            `json:"baseline_spend"`
	Reason          string             `json:"reason"`
}

// FinanceLimitAlertEvent registra um alerta disparado para deduplicação por ciclo.
type FinanceLimitAlertEvent struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	LimitID          string    `json:"limit_id"`
	PeriodKey        string    `json:"period_key"`
	TriggerKind      string    `json:"trigger_kind"` // THRESHOLD | OVER_STEP | PACE_PROJECTION | SUBSCRIPTION_FORECAST
	ThresholdPercent int       `json:"threshold_percent"`
	SpentAmount      float64   `json:"spent_amount"`
	TargetAmount     float64   `json:"target_amount"`
	NotifiedChannels []string  `json:"notified_channels"`
	NotificationID   string    `json:"notification_id,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

// FinanceTransactionFilter parametriza busca paginada no extrato analítico.
type FinanceTransactionFilter struct {
	Query     string
	AccountID string
	Category  string
	TxType    string
	From      *time.Time
	To        *time.Time
	Limit     int
	Offset    int
}

// FinanceRecategorizeRequest redefine a categoria de uma transação e opcionalmente cria regra por merchant.
type FinanceRecategorizeRequest struct {
	Category        string `json:"category"`
	ApplyToMerchant bool   `json:"apply_to_merchant"`
}

// FinanceCashFlowPoint representa entradas vs saídas de um mês.
type FinanceCashFlowPoint struct {
	Month   string  `json:"month"` // YYYY-MM
	Income  float64 `json:"income"`
	Expense float64 `json:"expense"`
	Net     float64 `json:"net"`
}

// FinanceCardOverview resume um cartão de crédito e sua fatura atual.
type FinanceCardOverview struct {
	Account          FinanceAccount `json:"account"`
	CurrentBillTotal float64        `json:"current_bill_total"`
	IsEstimated      bool           `json:"is_estimated"`
	NextDueDate      string         `json:"next_due_date,omitempty"`
	UsagePercent     float64        `json:"usage_percent"`
}

// FinanceCalendarEvent representa um vencimento financeiro no calendário.
type FinanceCalendarEvent struct {
	ID          string  `json:"id"`
	Kind        string  `json:"kind"` // BILL_DUE | SUBSCRIPTION_DUE | INSTALLMENT_DUE
	Title       string  `json:"title"`
	Date        string  `json:"date"` // YYYY-MM-DD
	Amount      float64 `json:"amount"`
	AccountName string  `json:"account_name,omitempty"`
}

// FinanceCreditBill representa uma fatura de cartão de crédito.
type FinanceCreditBill struct {
	ID             string   `json:"id"`
	UserID         string   `json:"user_id"`
	AccountID      string   `json:"account_id"`
	PluggyBillID   string   `json:"pluggy_bill_id,omitempty"`
	ClosingDate    string   `json:"closing_date,omitempty"`
	DueDate        string   `json:"due_date"`
	TotalAmount    float64  `json:"total_amount"`
	MinimumPayment *float64 `json:"minimum_payment,omitempty"`
	FinanceCharges *float64 `json:"finance_charges,omitempty"`
	Status         string   `json:"status"`
	IsEstimated    bool     `json:"is_estimated"`
}

// FinanceInstallmentPlan representa um plano de parcelamento no cartão.
type FinanceInstallmentPlan struct {
	ID                string  `json:"id"`
	UserID            string  `json:"user_id"`
	AccountID         string  `json:"account_id"`
	MerchantID        string  `json:"merchant_id,omitempty"`
	PlanKey           string  `json:"plan_key"`
	MerchantName      string  `json:"merchant_name"`
	InstallmentCount  int     `json:"installment_count"`
	InstallmentAmount float64 `json:"installment_amount"`
	TotalAmount       float64 `json:"total_amount"`
	FirstDueDate      string  `json:"first_due_date,omitempty"`
	Source            string  `json:"source"`
}
