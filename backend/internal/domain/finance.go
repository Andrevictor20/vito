package domain

import (
	"errors"
	"time"
)

var (
	ErrFinanceConnectionNotFound = errors.New("conexão financeira não encontrada")
	ErrFinanceAccountNotFound    = errors.New("conta bancária não encontrada")
	ErrFinanceInvalidPayload     = errors.New("payload financeiro inválido")
	ErrByokBackupNotFound        = errors.New("backup BYOK não encontrado")
	ErrByokBackupInvalid         = errors.New("backup BYOK inválido")
)

const (
	// MaxByokCiphertextBytes limita o blob opaco cifrado no cliente (16 KiB).
	MaxByokCiphertextBytes = 16 * 1024
	// MaxByokNonceBytes limita o tamanho do nonce criptográfico (256 bytes).
	MaxByokNonceBytes = 256
)

type AccountType string

const (
	AccountTypeBank   AccountType = "BANK"
	AccountTypeCredit AccountType = "CREDIT"
)

type TransactionType string

const (
	TxDebit  TransactionType = "DEBIT"
	TxCredit TransactionType = "CREDIT"
)

type BudgetKind string

const (
	BudgetKindCategoryLimit BudgetKind = "CATEGORY_LIMIT"
	BudgetKindSavingsGoal   BudgetKind = "SAVINGS_GOAL"
)

type ConnectionStatus string

const (
	ConnectionStatusUpdated      ConnectionStatus = "UPDATED"
	ConnectionStatusLoginError   ConnectionStatus = "LOGIN_ERROR"
	ConnectionStatusOutdated     ConnectionStatus = "OUTDATED"
	ConnectionStatusWaitingInput ConnectionStatus = "WAITING_USER_INPUT"
)

// FinanceConnection representa uma instituição conectada via Open Finance (Pluggy Item).
type FinanceConnection struct {
	ID               string           `json:"id"`
	UserID           string           `json:"user_id"`
	PluggyItemID     string           `json:"pluggy_item_id"`
	ConnectorID      int              `json:"connector_id"`
	InstitutionName  string           `json:"institution_name"`
	Status           ConnectionStatus `json:"status"`
	LastSyncAt       *time.Time       `json:"last_sync_at,omitempty"`
	ConsentExpiresAt *time.Time       `json:"consent_expires_at,omitempty"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

// FinanceAccount representa uma conta corrente, poupança ou cartão de crédito.
type FinanceAccount struct {
	ID                   string      `json:"id"`
	UserID               string      `json:"user_id"`
	ConnectionID         string      `json:"connection_id"`
	PluggyAccountID      string      `json:"pluggy_account_id"`
	InstitutionName      string      `json:"institution_name"`
	AccountType          AccountType `json:"account_type"`
	AccountSubtype       string      `json:"account_subtype,omitempty"`
	Name                 string      `json:"name"`
	Balance              float64     `json:"balance"`
	CreditLimit          *float64    `json:"credit_limit,omitempty"`
	AvailableCreditLimit *float64    `json:"available_credit_limit,omitempty"`
	CurrencyCode         string      `json:"currency_code"`
	ClosingDay           *int        `json:"closing_day,omitempty"` // dia do fechamento da fatura (cartão)
	DueDay               *int        `json:"due_day,omitempty"`     // dia do vencimento da fatura (cartão)
	MinimumPayment       *float64    `json:"minimum_payment,omitempty"`
	UpdatedAt            time.Time   `json:"updated_at"`
}

// FinanceTransaction representa um lançamento de extrato bancário ou fatura de cartão.
type FinanceTransaction struct {
	ID                  string          `json:"id"`
	UserID              string          `json:"user_id"`
	AccountID           string          `json:"account_id"`
	PluggyTransactionID string          `json:"pluggy_transaction_id"`
	Description         string          `json:"description"`
	CleanMerchantName   string          `json:"clean_merchant_name,omitempty"`
	Amount              float64         `json:"amount"` // Negativo para despesa, positivo para receita
	TransactionType     TransactionType `json:"transaction_type"`
	PaymentMethod       string          `json:"payment_method,omitempty"`
	Category            string          `json:"category"`
	IsRecurring         bool            `json:"is_recurring"`
	OccurredAt          time.Time       `json:"occurred_at"`
	CreatedAt           time.Time       `json:"created_at"`
	// PluggyAccountID permite ao backend resolver account_id quando o cliente só conhece o id da Pluggy.
	PluggyAccountID   string `json:"pluggy_account_id,omitempty"`
	InstallmentNumber *int   `json:"installment_number,omitempty"`
	TotalInstallments *int   `json:"total_installments,omitempty"`
	PaymentType       string `json:"payment_type,omitempty"` // INSTALLMENT, SINGLE
	MCC               *int   `json:"mcc,omitempty"`
	Status            string `json:"status,omitempty"` // PENDING, POSTED
}

// FinanceBudgetAndGoal representa um teto de gastos por categoria ou meta de economia.
type FinanceBudgetAndGoal struct {
	ID                 string     `json:"id"`
	UserID             string     `json:"user_id"`
	Kind               BudgetKind `json:"kind"`
	Title              string     `json:"title"`
	CategoryFilter     string     `json:"category_filter,omitempty"`
	TargetAmount       float64    `json:"target_amount"`
	CurrentAmount      float64    `json:"current_amount"`
	DeadlineDate       string     `json:"deadline_date,omitempty"` // YYYY-MM-DD
	AutoAlertThreshold int        `json:"auto_alert_threshold"`
	CreatedAt          time.Time  `json:"created_at"`
	UpdatedAt          time.Time  `json:"updated_at"`
}

// CategorySpendItem resume o gasto de uma categoria no mês com variação percentual.
type CategorySpendItem struct {
	Category            string  `json:"category"`
	TotalAmount         float64 `json:"total_amount"`
	Percentage          float64 `json:"percentage"`
	PreviousMonthAmount float64 `json:"previous_month_amount"`
	DeltaPercent        float64 `json:"delta_percent"`
}

// FinanceAlert representa um aviso proativo financeiro (fatura iminente, teto excedido, etc.).
type FinanceAlert struct {
	ID           string `json:"id"`
	Kind         string `json:"kind"`
	Title        string `json:"title"`
	Message      string `json:"message"`
	Severity     string `json:"severity"` // "info", "warning", "critical"
	ActionLabel  string `json:"action_label,omitempty"`
	ActionPrompt string `json:"action_prompt,omitempty"`
}

// SubscriptionItem representa uma despesa recorrente detectada pelo motor analítico.
type SubscriptionItem struct {
	MerchantName     string    `json:"merchant_name"`
	Category         string    `json:"category"`
	Amount           float64   `json:"amount"`
	Frequency        string    `json:"frequency"` // "monthly", "yearly"
	LastChargedAt    time.Time `json:"last_charged_at"`
	IsPriceIncreased bool      `json:"is_price_increased"`
	PreviousAmount   float64   `json:"previous_amount,omitempty"`
}

// FinancialSummary agrega os dados macroeconômicos do usuário para o Card Hero e IA.
type FinancialSummary struct {
	ConnectedInstitutionsCount int                 `json:"connected_institutions_count"`
	ConsolidatedBalance        float64             `json:"consolidated_balance"`
	TotalBalance               float64             `json:"total_balance"`
	OpenInvoicesTotal          float64             `json:"open_invoices_total"`
	OpenCreditCardBills        float64             `json:"open_credit_card_bills"`
	MonthExpenses              float64             `json:"month_expenses"`
	MonthIncome                float64             `json:"month_income"`
	SafeToSpendDaily           float64             `json:"safe_to_spend_daily"`
	SafeToSpendDaysRemaining   int                 `json:"safe_to_spend_days_remaining"`
	DaysRemainingInMonth       int                 `json:"days_remaining_in_month"`
	SafeToSpendMonthPercent    float64             `json:"safe_to_spend_month_percent"`
	MonthProgressPercent       float64             `json:"month_progress_percent"`
	SafeToSpendBudgetPercent   float64             `json:"safe_to_spend_budget_percent"`
	PacePercent                float64             `json:"pace_percent"`
	ProjectedLeftover          float64             `json:"projected_leftover"`
	HeadlineStatus             string              `json:"headline_status"`
	CategorySpending           []CategorySpendItem `json:"category_spending"`
	Alerts                     []FinanceAlert      `json:"alerts"`
	AttentionAlerts            []FinanceAlert      `json:"attention_alerts"`
	Subscriptions              []SubscriptionItem  `json:"subscriptions"`
}

// FinanceSyncPayload é o envelope enviado pelo app mobile no Edge-Sync.
type FinanceSyncPayload struct {
	ConnectionID    string               `json:"connection_id,omitempty"`
	PluggyItemID    string               `json:"pluggy_item_id,omitempty"`
	InstitutionName string               `json:"institution_name,omitempty"`
	Accounts        []FinanceAccount     `json:"accounts"`
	Transactions    []FinanceTransaction `json:"transactions"`
}

// FinanceByokBackup representa o blob opaco cifrado no cliente contendo as chaves BYOK do usuário.
type FinanceByokBackup struct {
	UserID     string    `json:"-"`
	Ciphertext []byte    `json:"ciphertext"`
	Nonce      []byte    `json:"nonce"`
	KeyVersion int       `json:"key_version"`
	UpdatedAt  time.Time `json:"updated_at"`
}
