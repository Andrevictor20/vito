package finance

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// FinanceServiceContract abstrai o serviço financeiro para o FinanceToolset sem ciclo de importação.
type FinanceServiceContract interface {
	GetFinancialSummary(ctx context.Context, userID string) (*domain.FinancialSummary, error)
	ListTransactions(ctx context.Context, userID string, limit, offset int) ([]domain.FinanceTransaction, error)
	ListAccounts(ctx context.Context, userID string) ([]domain.FinanceAccount, error)
}

// FinanceBudgetRepository abstrai a leitura de orçamentos e metas.
type FinanceBudgetRepository interface {
	ListBudgetsAndGoals(ctx context.Context, userID string) ([]domain.FinanceBudgetAndGoal, error)
}

// FinanceLimitServiceContract abstrai consulta e criação de limites multi-escopo.
type FinanceLimitServiceContract interface {
	ListLimitsWithStatus(ctx context.Context, userID string, scope domain.SpendingLimitScope) ([]domain.FinanceLimitStatus, error)
	UpsertLimit(ctx context.Context, userID string, rule *domain.FinanceLimitRule) (*domain.FinanceLimitStatus, error)
}

// FinanceToolset implementa DomainToolset ("finance_manager") e BotCapableToolset (fin:spend somente-leitura).
type FinanceToolset struct {
	svc      FinanceServiceContract
	repo     FinanceBudgetRepository
	limitSvc FinanceLimitServiceContract
}

// NewFinanceToolset cria o toolset financeiro para o vito_finance_agent e bots autorizados.
func NewFinanceToolset(svc FinanceServiceContract, repo ...FinanceBudgetRepository) *FinanceToolset {
	var r FinanceBudgetRepository
	if len(repo) > 0 {
		r = repo[0]
	}
	return &FinanceToolset{svc: svc, repo: r}
}

// SetLimitService injeta o serviço de limites multi-escopo (Onda 2).
func (t *FinanceToolset) SetLimitService(limitSvc FinanceLimitServiceContract) {
	t.limitSvc = limitSvc
}

func (t *FinanceToolset) Name() domain.ToolsetName {
	return domain.ToolsetFinance
}

func (t *FinanceToolset) Description() string {
	return "Consulta resumo financeiro Safe-to-Spend, categorias, transações, assinaturas, cartões, simulação de metas e limites de gasto."
}

func (t *FinanceToolset) Operations() []string {
	return []string{
		"get_summary",
		"get_accounts",
		"list_transactions",
		"get_budgets",
		"get_cards",
		"get_spending_by_category",
		"detect_subscriptions_and_recurring",
		"simulate_savings_plan",
		"get_spending_limits_status",
		"upsert_spending_limit",
	}
}

func (t *FinanceToolset) readOnlyOperations() []string {
	return []string{
		"get_summary",
		"get_accounts",
		"list_transactions",
		"get_budgets",
		"get_cards",
		"get_spending_by_category",
		"detect_subscriptions_and_recurring",
		"simulate_savings_plan",
		"get_spending_limits_status",
	}
}

func (t *FinanceToolset) BotActions() []domain.BotActionSpec {
	return []domain.BotActionSpec{
		{
			AppKey:      "fin",
			ActionKey:   "fin:spend",
			Label:       "Consultar Finanças (Safe-to-Spend)",
			Description: "Permite ao bot consultar saldo livre, gastos, faturas, assinaturas e limites (somente leitura).",
			IsWrite:     false,
			AlwaysAsk:   false,
			Operations:  t.readOnlyOperations(),
		},
	}
}

func (t *FinanceToolset) ActionKeys() []string {
	return []string{"fin:spend", "fin:summary", "spend"}
}

func (t *FinanceToolset) SupportedOperationsForAction(actionKey string) []string {
	switch strings.TrimSpace(actionKey) {
	case "fin:spend", "fin:summary", "spend":
		return t.readOnlyOperations()
	default:
		return nil
	}
}

func (t *FinanceToolset) IsWriteOperation(op string, _ json.RawMessage) (bool, bool, map[string]any) {
	if op == "upsert_spending_limit" {
		return true, true, map[string]any{"action": "upsert_spending_limit"}
	}
	return false, false, nil
}

func sanitizeFinanceText(raw string) string {
	s := strings.NewReplacer("\r", " ", "\n", " ", "\t", " ", "```", "", "<untrusted_content>", "", "</untrusted_content>", "").Replace(strings.TrimSpace(raw))
	if len([]rune(s)) > 80 {
		s = string([]rune(s)[:80])
	}
	return s
}

func (t *FinanceToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	if t.svc == nil {
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Serviço financeiro não conectado no momento.",
		}, nil
	}

	var params financeToolParams
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}
	isVoice := execCtx != nil && strings.EqualFold(execCtx.Channel, "voice")

	switch op {
	case "get_summary", "default":
		return t.execGetSummary(ctx, execCtx.UserID, isVoice)
	case "get_accounts":
		return t.execGetAccounts(ctx, execCtx.UserID)
	case "list_transactions":
		return t.execListTransactions(ctx, execCtx.UserID, params, isVoice)
	case "get_budgets":
		return t.execGetBudgets(ctx, execCtx.UserID)
	case "get_cards":
		return t.execGetCards(ctx, execCtx.UserID)
	case "get_spending_by_category":
		return t.execSpendingByCategory(ctx, execCtx.UserID, params.Category)
	case "detect_subscriptions_and_recurring":
		return t.execDetectSubscriptions(ctx, execCtx.UserID, isVoice)
	case "simulate_savings_plan":
		return t.execSimulateSavings(ctx, execCtx.UserID, params)
	case "get_spending_limits_status":
		return t.execLimitsStatus(ctx, execCtx.UserID, params.ScopeType)
	case "upsert_spending_limit":
		return t.execUpsertLimit(ctx, execCtx.UserID, params)
	default:
		return nil, fmt.Errorf("operação financeira desconhecida: %s", op)
	}
}
