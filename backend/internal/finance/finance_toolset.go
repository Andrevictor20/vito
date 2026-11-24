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
	return domain.ToolsetName("finance_manager")
}

func (t *FinanceToolset) Description() string {
	return "Consulta resumo financeiro Safe-to-Spend, categorias, transações, assinaturas, cartões, simulação de metas e limites de gasto."
}

func (t *FinanceToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"query":{"type":"string"},"category":{"type":"string"},"limit":{"type":"integer"}}}`)
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

	var params struct {
		Query           string  `json:"query"`
		Category        string  `json:"category"`
		Limit           int     `json:"limit"`
		TargetAmount    float64 `json:"target_amount"`
		Months          int     `json:"months"`
		ScopeType       string  `json:"scope_type"`
		Title           string  `json:"title"`
		AccountID       string  `json:"account_id"`
		MerchantPattern string  `json:"merchant_pattern"`
		PeriodType      string  `json:"period_type"`
		AlertThreshold  int     `json:"alert_threshold"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}
	isVoice := execCtx != nil && strings.EqualFold(execCtx.Channel, "voice")

	switch op {
	case "get_summary", "default":
		summary, err := t.svc.GetFinancialSummary(ctx, execCtx.UserID)
		if err != nil {
			return nil, err
		}
		text := fmt.Sprintf(
			"Safe-to-Spend diário: R$ %.2f | Saldo consolidado: R$ %.2f | Gastos do mês: R$ %.2f | Faturas abertas: R$ %.2f | Instituições conectadas: %d.",
			summary.SafeToSpendDaily, summary.ConsolidatedBalance, summary.MonthExpenses, summary.OpenInvoicesTotal, summary.ConnectedInstitutionsCount,
		)
		if !isVoice {
			if accounts, accErr := t.svc.ListAccounts(ctx, execCtx.UserID); accErr == nil && len(accounts) > 0 {
				var accLines []string
				for _, acc := range accounts {
					accLines = append(accLines, fmt.Sprintf("- %s (%s, %s, id=%s): R$ %.2f", sanitizeFinanceText(acc.Name), sanitizeFinanceText(acc.InstitutionName), acc.AccountType, acc.ID, acc.Balance))
				}
				text += "\nContas conectadas:\n" + strings.Join(accLines, "\n")
			}
		}
		if isVoice {
			text = fmt.Sprintf("Você pode gastar até R$ %.2f por dia neste mês. Seu saldo consolidado é R$ %.2f e as faturas abertas somam R$ %.2f.",
				summary.SafeToSpendDaily, summary.ConsolidatedBalance, summary.OpenInvoicesTotal)
		}
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: text, Data: summary}, nil

	case "get_accounts":
		accounts, err := t.svc.ListAccounts(ctx, execCtx.UserID)
		if err != nil {
			return nil, err
		}
		if len(accounts) == 0 {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhuma conta conectada no momento.", Data: accounts}, nil
		}
		var lines []string
		for _, acc := range accounts {
			extra := ""
			if acc.AvailableCreditLimit != nil {
				extra = fmt.Sprintf(" | limite disponível R$ %.2f", *acc.AvailableCreditLimit)
			}
			lines = append(lines, fmt.Sprintf("- %s (%s, %s, id=%s): saldo/fatura R$ %.2f%s", sanitizeFinanceText(acc.Name), sanitizeFinanceText(acc.InstitutionName), acc.AccountType, acc.ID, acc.Balance, extra))
		}
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: fmt.Sprintf("Contas conectadas (%d):\n%s", len(accounts), strings.Join(lines, "\n")), Data: accounts}, nil

	case "list_transactions":
		limit := params.Limit
		if limit <= 0 || limit > 50 {
			limit = 15
		}
		txs, err := t.svc.ListTransactions(ctx, execCtx.UserID, limit, 0)
		if err != nil {
			return nil, err
		}
		q := strings.ToLower(strings.TrimSpace(params.Query))
		cat := strings.ToLower(strings.TrimSpace(params.Category))
		accIDFilter := strings.TrimSpace(params.AccountID)
		matchedAccountIDs := map[string]bool{}
		if q != "" && accIDFilter == "" {
			if accounts, accErr := t.svc.ListAccounts(ctx, execCtx.UserID); accErr == nil {
				for _, acc := range accounts {
					inst := strings.ToLower(acc.InstitutionName)
					name := strings.ToLower(acc.Name)
					if (inst != "" && (strings.Contains(inst, q) || strings.Contains(q, inst))) ||
						(name != "" && (strings.Contains(name, q) || strings.Contains(q, name))) {
						matchedAccountIDs[acc.ID] = true
					}
				}
			}
		}
		var lines []string
		var filtered []domain.FinanceTransaction
		for _, tx := range txs {
			if accIDFilter != "" && tx.AccountID != accIDFilter && tx.PluggyAccountID != accIDFilter {
				continue
			}
			if q != "" {
				textMatch := strings.Contains(strings.ToLower(tx.Description+" "+tx.CleanMerchantName), q)
				accountMatch := matchedAccountIDs[tx.AccountID]
				if !textMatch && !accountMatch {
					continue
				}
			}
			if cat != "" && !strings.Contains(strings.ToLower(tx.Category), cat) {
				continue
			}
			filtered = append(filtered, tx)
			lines = append(lines, fmt.Sprintf("- %s: R$ %.2f (%s, %s)", sanitizeFinanceText(tx.Description), tx.Amount, sanitizeFinanceText(tx.Category), tx.OccurredAt.Format("02/01")))
		}
		if len(lines) == 0 {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhuma transação encontrada para os filtros informados.", Data: []domain.FinanceTransaction{}}, nil
		}
		if isVoice && len(lines) > 3 {
			lines = lines[:3]
		}
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: fmt.Sprintf("Transações (%d):\n%s", len(filtered), strings.Join(lines, "\n")), Data: filtered}, nil

	case "get_budgets":
		if t.repo == nil {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhum orçamento ou meta cadastrada."}, nil
		}
		items, err := t.repo.ListBudgetsAndGoals(ctx, execCtx.UserID)
		if err != nil {
			return nil, err
		}
		if len(items) == 0 {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhum orçamento ou meta cadastrada.", Data: items}, nil
		}
		lines := make([]string, 0, len(items))
		for _, it := range items {
			lines = append(lines, fmt.Sprintf("- [%s] %s: R$ %.2f / R$ %.2f", it.Kind, sanitizeFinanceText(it.Title), it.CurrentAmount, it.TargetAmount))
		}
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Orçamentos e metas:\n" + strings.Join(lines, "\n"), Data: items}, nil

	case "get_cards":
		accounts, err := t.svc.ListAccounts(ctx, execCtx.UserID)
		if err != nil {
			return nil, err
		}
		var cards []domain.FinanceAccount
		var lines []string
		for _, acc := range accounts {
			if strings.EqualFold(string(acc.AccountType), "CREDIT") {
				cards = append(cards, acc)
				avail := 0.0
				if acc.AvailableCreditLimit != nil {
					avail = *acc.AvailableCreditLimit
				}
				lines = append(lines, fmt.Sprintf("- %s (%s): fatura R$ %.2f | limite disponível R$ %.2f", sanitizeFinanceText(acc.Name), sanitizeFinanceText(acc.InstitutionName), acc.Balance, avail))
			}
		}
		if len(cards) == 0 {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhum cartão de crédito conectado.", Data: cards}, nil
		}
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Cartões de crédito:\n" + strings.Join(lines, "\n"), Data: cards}, nil

	case "get_spending_by_category":
		summary, err := t.svc.GetFinancialSummary(ctx, execCtx.UserID)
		if err != nil {
			return nil, err
		}
		catFilter := strings.ToLower(strings.TrimSpace(params.Category))
		var lines []string
		for _, c := range summary.CategorySpending {
			if catFilter != "" && !strings.Contains(strings.ToLower(c.Category), catFilter) {
				continue
			}
			lines = append(lines, fmt.Sprintf("- %s: R$ %.2f (%.1f%% do mês, variação %.1f%%)", sanitizeFinanceText(c.Category), c.TotalAmount, c.Percentage, c.DeltaPercent))
		}
		if len(lines) == 0 {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Sem gastos registrados por categoria neste mês.", Data: summary.CategorySpending}, nil
		}
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Gastos por categoria:\n" + strings.Join(lines, "\n"), Data: summary.CategorySpending}, nil

	case "detect_subscriptions_and_recurring":
		summary, err := t.svc.GetFinancialSummary(ctx, execCtx.UserID)
		if err != nil {
			return nil, err
		}
		if len(summary.Subscriptions) == 0 {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhuma assinatura recorrente detectada.", Data: summary.Subscriptions}, nil
		}
		total := 0.0
		var lines []string
		for _, sub := range summary.Subscriptions {
			total += sub.Amount
			reaj := ""
			if sub.IsPriceIncreased {
				reaj = fmt.Sprintf(" [REAJUSTE de R$ %.2f]", sub.PreviousAmount)
			}
			lines = append(lines, fmt.Sprintf("- %s: R$ %.2f (%s)%s", sanitizeFinanceText(sub.MerchantName), sub.Amount, sub.Frequency, reaj))
		}
		if isVoice {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: fmt.Sprintf("Você tem %d assinaturas recorrentes somando R$ %.2f por mês.", len(summary.Subscriptions), total), Data: summary.Subscriptions}, nil
		}
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: fmt.Sprintf("Assinaturas (%d, total R$ %.2f/mês):\n%s", len(summary.Subscriptions), total, strings.Join(lines, "\n")), Data: summary.Subscriptions}, nil

	case "simulate_savings_plan":
		if params.TargetAmount <= 0 {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Informe um valor alvo positivo para simular a meta."}, nil
		}
		months := params.Months
		if months <= 0 {
			months = 6
		}
		monthlySave := params.TargetAmount / float64(months)
		dailyImpact := monthlySave / 30.0
		summary, _ := t.svc.GetFinancialSummary(ctx, execCtx.UserID)
		newSafe := 0.0
		if summary != nil {
			newSafe = summary.SafeToSpendDaily - dailyImpact
		}
		msg := fmt.Sprintf("Para juntar R$ %.2f em %d meses, reserve R$ %.2f/mês (R$ %.2f/dia). Seu Safe-to-Spend diário ajustado ficaria em R$ %.2f.", params.TargetAmount, months, monthlySave, dailyImpact, newSafe)
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: msg, Data: map[string]any{"monthly_save": monthlySave, "daily_impact": dailyImpact, "adjusted_safe_to_spend": newSafe}}, nil

	case "get_spending_limits_status":
		if t.limitSvc == nil {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Motor de limites ainda não inicializado."}, nil
		}
		statuses, err := t.limitSvc.ListLimitsWithStatus(ctx, execCtx.UserID, domain.SpendingLimitScope(params.ScopeType))
		if err != nil {
			return nil, err
		}
		if len(statuses) == 0 {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhum limite de gasto configurado ainda.", Data: statuses}, nil
		}
		var lines []string
		for _, st := range statuses {
			lines = append(lines, fmt.Sprintf("- [%s] %s: R$ %.2f / R$ %.2f (%.0f%% - %s)", st.Rule.ScopeType, sanitizeFinanceText(st.Rule.Title), st.SpentAmount, st.Rule.TargetAmount, st.PercentUsed, st.StatusLabel))
		}
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Limites de gasto:\n" + strings.Join(lines, "\n"), Data: statuses}, nil

	case "upsert_spending_limit":
		if t.limitSvc == nil {
			return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Serviço de limites indisponível."}, nil
		}
		scope := domain.SpendingLimitScope(strings.ToUpper(strings.TrimSpace(params.ScopeType)))
		if scope == "" {
			scope = domain.LimitScopeCategory
		}
		thresholds := []int{80, 100}
		if params.AlertThreshold > 0 && params.AlertThreshold < 100 {
			thresholds = []int{params.AlertThreshold, 100}
		}
		rule := &domain.FinanceLimitRule{
			ScopeType:        scope,
			Title:            sanitizeFinanceText(params.Title),
			CategoryFilter:   sanitizeFinanceText(params.Category),
			AccountID:        params.AccountID,
			MerchantPattern:  sanitizeFinanceText(params.MerchantPattern),
			PeriodType:       domain.LimitPeriodType(strings.ToUpper(strings.TrimSpace(params.PeriodType))),
			TargetAmount:     params.TargetAmount,
			AlertThresholds:  thresholds,
			PaceAlertEnabled: true,
			NotifyChannels:   []string{"in_app", "push"},
			IncludePending:   true,
			IsActive:         true,
		}
		if rule.Title == "" {
			rule.Title = "Limite " + string(scope)
		}
		st, err := t.limitSvc.UpsertLimit(ctx, execCtx.UserID, rule)
		if err != nil {
			return nil, err
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Limite '%s' salvo: teto R$ %.2f (consumo atual R$ %.2f / %.0f%%).", st.Rule.Title, st.Rule.TargetAmount, st.SpentAmount, st.PercentUsed),
			Data:          st,
		}, nil

	default:
		return nil, fmt.Errorf("operação financeira desconhecida: %s", op)
	}
}
