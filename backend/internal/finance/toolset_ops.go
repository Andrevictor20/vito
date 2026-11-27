package finance

import (
	"context"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

type financeToolParams struct {
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

func (t *FinanceToolset) execGetSummary(ctx context.Context, userID string, isVoice bool) (*domain.ToolExecutionResult, error) {
	summary, err := t.svc.GetFinancialSummary(ctx, userID)
	if err != nil {
		return nil, err
	}
	if isVoice {
		text := fmt.Sprintf("Você pode gastar até R$ %.2f por dia neste mês. Seu saldo consolidado é R$ %.2f e as faturas abertas somam R$ %.2f.",
			summary.SafeToSpendDaily, summary.ConsolidatedBalance, summary.OpenInvoicesTotal)
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: text, Data: summary}, nil
	}
	text := fmt.Sprintf(
		"Safe-to-Spend diário: R$ %.2f | Saldo consolidado: R$ %.2f | Gastos do mês: R$ %.2f | Faturas abertas: R$ %.2f | Instituições conectadas: %d.",
		summary.SafeToSpendDaily, summary.ConsolidatedBalance, summary.MonthExpenses, summary.OpenInvoicesTotal, summary.ConnectedInstitutionsCount,
	)
	if accounts, accErr := t.svc.ListAccounts(ctx, userID); accErr == nil && len(accounts) > 0 {
		var accLines []string
		for _, acc := range accounts {
			accLines = append(accLines, fmt.Sprintf("- %s (%s, %s, id=%s): R$ %.2f", sanitizeFinanceText(acc.Name), sanitizeFinanceText(acc.InstitutionName), acc.AccountType, acc.ID, acc.Balance))
		}
		text += "\nContas conectadas:\n" + strings.Join(accLines, "\n")
	}
	return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: text, Data: summary}, nil
}

func (t *FinanceToolset) execGetAccounts(ctx context.Context, userID string) (*domain.ToolExecutionResult, error) {
	accounts, err := t.svc.ListAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(accounts) == 0 {
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhuma conta conectada no momento.", Data: accounts}, nil
	}
	lines := make([]string, 0, len(accounts))
	for _, acc := range accounts {
		extra := ""
		if acc.AvailableCreditLimit != nil {
			extra = fmt.Sprintf(" | limite disponível R$ %.2f", *acc.AvailableCreditLimit)
		}
		lines = append(lines, fmt.Sprintf("- %s (%s, %s, id=%s): saldo/fatura R$ %.2f%s", sanitizeFinanceText(acc.Name), sanitizeFinanceText(acc.InstitutionName), acc.AccountType, acc.ID, acc.Balance, extra))
	}
	return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: fmt.Sprintf("Contas conectadas (%d):\n%s", len(accounts), strings.Join(lines, "\n")), Data: accounts}, nil
}

func (t *FinanceToolset) execListTransactions(ctx context.Context, userID string, params financeToolParams, isVoice bool) (*domain.ToolExecutionResult, error) {
	limit := params.Limit
	if limit <= 0 || limit > 50 {
		limit = 15
	}
	txs, err := t.svc.ListTransactions(ctx, userID, limit, 0)
	if err != nil {
		return nil, err
	}
	q := strings.ToLower(strings.TrimSpace(params.Query))
	cat := strings.ToLower(strings.TrimSpace(params.Category))
	accIDFilter := strings.TrimSpace(params.AccountID)
	matchedAccountIDs := t.matchAccountIDsByQuery(ctx, userID, q, accIDFilter)

	var lines []string
	var filtered []domain.FinanceTransaction
	for _, tx := range txs {
		if !transactionMatchesFilter(tx, q, cat, accIDFilter, matchedAccountIDs) {
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
}

func (t *FinanceToolset) matchAccountIDsByQuery(ctx context.Context, userID, q, accIDFilter string) map[string]bool {
	matched := make(map[string]bool)
	if q == "" || accIDFilter != "" {
		return matched
	}
	accounts, err := t.svc.ListAccounts(ctx, userID)
	if err != nil {
		return matched
	}
	for _, acc := range accounts {
		inst := strings.ToLower(acc.InstitutionName)
		name := strings.ToLower(acc.Name)
		if (inst != "" && (strings.Contains(inst, q) || strings.Contains(q, inst))) ||
			(name != "" && (strings.Contains(name, q) || strings.Contains(q, name))) {
			matched[acc.ID] = true
		}
	}
	return matched
}

func transactionMatchesFilter(tx domain.FinanceTransaction, q, cat, accIDFilter string, matchedAccounts map[string]bool) bool {
	if accIDFilter != "" && tx.AccountID != accIDFilter && tx.PluggyAccountID != accIDFilter {
		return false
	}
	if q != "" {
		textMatch := strings.Contains(strings.ToLower(tx.Description+" "+tx.CleanMerchantName), q)
		if !textMatch && !matchedAccounts[tx.AccountID] {
			return false
		}
	}
	if cat != "" && !strings.Contains(strings.ToLower(tx.Category), cat) {
		return false
	}
	return true
}

func (t *FinanceToolset) execGetBudgets(ctx context.Context, userID string) (*domain.ToolExecutionResult, error) {
	if t.repo == nil {
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhum orçamento ou meta cadastrada."}, nil
	}
	items, err := t.repo.ListBudgetsAndGoals(ctx, userID)
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
}

func (t *FinanceToolset) execGetCards(ctx context.Context, userID string) (*domain.ToolExecutionResult, error) {
	accounts, err := t.svc.ListAccounts(ctx, userID)
	if err != nil {
		return nil, err
	}
	var cards []domain.FinanceAccount
	var lines []string
	for _, acc := range accounts {
		if !strings.EqualFold(string(acc.AccountType), "CREDIT") {
			continue
		}
		cards = append(cards, acc)
		avail := 0.0
		if acc.AvailableCreditLimit != nil {
			avail = *acc.AvailableCreditLimit
		}
		lines = append(lines, fmt.Sprintf("- %s (%s): fatura R$ %.2f | limite disponível R$ %.2f", sanitizeFinanceText(acc.Name), sanitizeFinanceText(acc.InstitutionName), acc.Balance, avail))
	}
	if len(cards) == 0 {
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhum cartão de crédito conectado.", Data: cards}, nil
	}
	return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Cartões de crédito:\n" + strings.Join(lines, "\n"), Data: cards}, nil
}

func (t *FinanceToolset) execSpendingByCategory(ctx context.Context, userID, categoryFilter string) (*domain.ToolExecutionResult, error) {
	summary, err := t.svc.GetFinancialSummary(ctx, userID)
	if err != nil {
		return nil, err
	}
	catFilter := strings.ToLower(strings.TrimSpace(categoryFilter))
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
}

func (t *FinanceToolset) execDetectSubscriptions(ctx context.Context, userID string, isVoice bool) (*domain.ToolExecutionResult, error) {
	summary, err := t.svc.GetFinancialSummary(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(summary.Subscriptions) == 0 {
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhuma assinatura recorrente detectada.", Data: summary.Subscriptions}, nil
	}
	total := 0.0
	lines := make([]string, 0, len(summary.Subscriptions))
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
}

func (t *FinanceToolset) execSimulateSavings(ctx context.Context, userID string, params financeToolParams) (*domain.ToolExecutionResult, error) {
	if params.TargetAmount <= 0 {
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Informe um valor alvo positivo para simular a meta."}, nil
	}
	months := params.Months
	if months <= 0 {
		months = 6
	}
	monthlySave := params.TargetAmount / float64(months)
	dailyImpact := monthlySave / 30.0
	summary, _ := t.svc.GetFinancialSummary(ctx, userID)
	newSafe := 0.0
	if summary != nil {
		newSafe = summary.SafeToSpendDaily - dailyImpact
	}
	msg := fmt.Sprintf("Para juntar R$ %.2f em %d meses, reserve R$ %.2f/mês (R$ %.2f/dia). Seu Safe-to-Spend diário ajustado ficaria em R$ %.2f.", params.TargetAmount, months, monthlySave, dailyImpact, newSafe)
	return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: msg, Data: map[string]any{"monthly_save": monthlySave, "daily_impact": dailyImpact, "adjusted_safe_to_spend": newSafe}}, nil
}

func (t *FinanceToolset) execLimitsStatus(ctx context.Context, userID, scopeType string) (*domain.ToolExecutionResult, error) {
	if t.limitSvc == nil {
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Motor de limites ainda não inicializado."}, nil
	}
	statuses, err := t.limitSvc.ListLimitsWithStatus(ctx, userID, domain.SpendingLimitScope(scopeType))
	if err != nil {
		return nil, err
	}
	if len(statuses) == 0 {
		return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Nenhum limite de gasto configurado ainda.", Data: statuses}, nil
	}
	lines := make([]string, 0, len(statuses))
	for _, st := range statuses {
		lines = append(lines, fmt.Sprintf("- [%s] %s: R$ %.2f / R$ %.2f (%.0f%% - %s)", st.Rule.ScopeType, sanitizeFinanceText(st.Rule.Title), st.SpentAmount, st.Rule.TargetAmount, st.PercentUsed, st.StatusLabel))
	}
	return &domain.ToolExecutionResult{Status: "COMPLETED", SummaryForLLM: "Limites de gasto:\n" + strings.Join(lines, "\n"), Data: statuses}, nil
}

func (t *FinanceToolset) execUpsertLimit(ctx context.Context, userID string, params financeToolParams) (*domain.ToolExecutionResult, error) {
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
	st, err := t.limitSvc.UpsertLimit(ctx, userID, rule)
	if err != nil {
		return nil, err
	}
	return &domain.ToolExecutionResult{
		Status:        "COMPLETED",
		SummaryForLLM: fmt.Sprintf("Limite '%s' salvo: teto R$ %.2f (consumo atual R$ %.2f / %.0f%%).", st.Rule.Title, st.Rule.TargetAmount, st.SpentAmount, st.PercentUsed),
		Data:          st,
	}, nil
}
