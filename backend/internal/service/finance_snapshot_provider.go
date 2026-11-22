package service

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/repository"
)

// SQLiteFinanceSnapshotProvider implementa FinanceSnapshotProvider consultando o FinanceRepository SQLite.
type SQLiteFinanceSnapshotProvider struct {
	repo repository.FinanceRepository
}

// NewSQLiteFinanceSnapshotProvider cria o provedor enxuto de snapshot financeiro (Safe-to-Spend) para o Nível 1.
func NewSQLiteFinanceSnapshotProvider(repo repository.FinanceRepository) *SQLiteFinanceSnapshotProvider {
	return &SQLiteFinanceSnapshotProvider{repo: repo}
}

// GetCompactFinanceContext retorna um resumo financeiro compacto (saldo consolidado, Safe-to-Spend, faturas e contas).
func (p *SQLiteFinanceSnapshotProvider) GetCompactFinanceContext(ctx context.Context, userID string) string {
	if p == nil || p.repo == nil || strings.TrimSpace(userID) == "" {
		return ""
	}

	summary, err := p.repo.GetFinancialSummary(ctx, userID, time.Now().UTC())
	if err != nil || summary == nil {
		return ""
	}
	accounts, _ := p.repo.ListAccounts(ctx, userID)

	if len(accounts) == 0 &&
		summary.ConnectedInstitutionsCount == 0 &&
		summary.ConsolidatedBalance == 0 &&
		summary.MonthExpenses == 0 &&
		summary.OpenInvoicesTotal == 0 {
		return ""
	}

	parts := []string{
		fmt.Sprintf("Saldo consolidado: R$ %.2f", summary.ConsolidatedBalance),
		fmt.Sprintf("Safe-to-Spend: R$ %.2f/dia (%d dias restantes)", summary.SafeToSpendDaily, summary.SafeToSpendDaysRemaining),
		fmt.Sprintf("Faturas abertas: R$ %.2f", summary.OpenInvoicesTotal),
		fmt.Sprintf("Gastos no mês: R$ %.2f", summary.MonthExpenses),
	}
	if summary.MonthIncome > 0 {
		parts = append(parts, fmt.Sprintf("Receitas no mês: R$ %.2f", summary.MonthIncome))
	}

	if len(accounts) > 0 {
		limit := 3
		if len(accounts) < limit {
			limit = len(accounts)
		}
		var acctSummaries []string
		for _, a := range accounts[:limit] {
			name := strings.TrimSpace(a.Name)
			if name == "" {
				name = strings.TrimSpace(a.InstitutionName)
			}
			if name == "" {
				name = string(a.AccountType)
			}
			acctSummaries = append(acctSummaries, fmt.Sprintf("%s: R$ %.2f", name, a.Balance))
		}
		parts = append(parts, "Contas: "+strings.Join(acctSummaries, ", "))
	}

	return strings.Join(parts, " | ")
}
