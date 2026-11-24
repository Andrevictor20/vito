package toolsets

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

// FinanceToolset implementa DomainToolset ("finance_manager") somente-leitura e BotCapableToolset (fin:spend).
type FinanceToolset struct {
	svc  FinanceServiceContract
	repo FinanceBudgetRepository
}

// NewFinanceToolset cria o toolset financeiro para o vito_finance_agent e bots autorizados.
func NewFinanceToolset(svc FinanceServiceContract, repo ...FinanceBudgetRepository) *FinanceToolset {
	var r FinanceBudgetRepository
	if len(repo) > 0 {
		r = repo[0]
	}
	return &FinanceToolset{svc: svc, repo: r}
}

func (t *FinanceToolset) Name() domain.ToolsetName {
	return domain.ToolsetName("finance_manager")
}

func (t *FinanceToolset) Description() string {
	return "Consulta o resumo financeiro Safe-to-Spend, transações recentes, orçamentos e cartões de crédito."
}

func (t *FinanceToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{"type":"object","properties":{"query":{"type":"string"},"category":{"type":"string"},"limit":{"type":"integer"}}}`)
}

func (t *FinanceToolset) Operations() []string {
	return []string{"get_summary", "list_transactions", "get_budgets", "get_cards"}
}

func (t *FinanceToolset) BotActions() []domain.BotActionSpec {
	return []domain.BotActionSpec{
		{
			AppKey:      "fin",
			ActionKey:   "fin:spend",
			Label:       "Consultar Finanças (Safe-to-Spend)",
			Description: "Permite ao bot consultar saldo livre, gastos, faturas e orçamentos.",
			IsWrite:     false,
			AlwaysAsk:   false,
			Operations:  t.Operations(),
		},
	}
}

func (t *FinanceToolset) ActionKeys() []string {
	return []string{"fin:spend", "fin:summary", "spend"}
}

func (t *FinanceToolset) SupportedOperationsForAction(actionKey string) []string {
	switch strings.TrimSpace(actionKey) {
	case "fin:spend", "fin:summary", "spend":
		return t.Operations()
	default:
		return nil
	}
}

func (t *FinanceToolset) IsWriteOperation(_ string, _ json.RawMessage) (bool, bool, map[string]any) {
	return false, false, nil
}

func (t *FinanceToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	if t.svc == nil {
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Serviço financeiro não conectado no momento.",
		}, nil
	}

	var params struct {
		Query    string `json:"query"`
		Category string `json:"category"`
		Limit    int    `json:"limit"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

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
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: text,
			Data:          summary,
		}, nil

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
		var lines []string
		var filtered []domain.FinanceTransaction
		for _, tx := range txs {
			if q != "" && !strings.Contains(strings.ToLower(tx.Description+" "+tx.CleanMerchantName), q) {
				continue
			}
			if cat != "" && !strings.Contains(strings.ToLower(tx.Category), cat) {
				continue
			}
			filtered = append(filtered, tx)
			lines = append(lines, fmt.Sprintf("- %s: R$ %.2f (%s, %s)", tx.Description, tx.Amount, tx.Category, tx.OccurredAt.Format("02/01")))
		}
		if len(lines) == 0 {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "Nenhuma transação financeira encontrada para os filtros informados.",
				Data:          []domain.FinanceTransaction{},
			}, nil
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: fmt.Sprintf("Transações encontradas (%d):\n%s", len(lines), strings.Join(lines, "\n")),
			Data:          filtered,
		}, nil

	case "get_budgets":
		if t.repo == nil {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "Nenhum orçamento ou meta financeira cadastrada.",
			}, nil
		}
		items, err := t.repo.ListBudgetsAndGoals(ctx, execCtx.UserID)
		if err != nil {
			return nil, err
		}
		if len(items) == 0 {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "Nenhum orçamento ou meta financeira cadastrada.",
				Data:          items,
			}, nil
		}
		lines := make([]string, 0, len(items))
		for _, it := range items {
			lines = append(lines, fmt.Sprintf("- [%s] %s: R$ %.2f / R$ %.2f", it.Kind, it.Title, it.CurrentAmount, it.TargetAmount))
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Orçamentos e metas:\n" + strings.Join(lines, "\n"),
			Data:          items,
		}, nil

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
				lines = append(lines, fmt.Sprintf("- %s (%s): fatura R$ %.2f | limite disponível R$ %.2f", acc.Name, acc.InstitutionName, acc.Balance, avail))
			}
		}
		if len(cards) == 0 {
			return &domain.ToolExecutionResult{
				Status:        "COMPLETED",
				SummaryForLLM: "Nenhum cartão de crédito conectado no momento.",
				Data:          cards,
			}, nil
		}
		return &domain.ToolExecutionResult{
			Status:        "COMPLETED",
			SummaryForLLM: "Cartões de crédito:\n" + strings.Join(lines, "\n"),
			Data:          cards,
		}, nil

	default:
		return nil, fmt.Errorf("operação financeira desconhecida: %s", op)
	}
}
