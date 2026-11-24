package finance

import (
	"context"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/service"
	"math"
	"strings"
	"time"
)

// FinanceTriggerCollector executa a vigília financeira determinística periódica
// (limites, fatura iminente sem saldo, cobranças duplicadas < 10 min e reajuste de assinatura).
type FinanceTriggerCollector struct {
	finRepo   FinanceRepository
	evaluator *SpendingLimitEvaluator
	attention *service.AttentionBudgetService
}

// NewFinanceTriggerCollector instancia o coletor de vigília financeira.
func NewFinanceTriggerCollector(
	finRepo FinanceRepository,
	evaluator *SpendingLimitEvaluator,
	attention *service.AttentionBudgetService,
) *FinanceTriggerCollector {
	return &FinanceTriggerCollector{
		finRepo:   finRepo,
		evaluator: evaluator,
		attention: attention,
	}
}

// CollectAndNotify executa todas as heurísticas financeiras para o usuário sob governança do AttentionBudgetService.
func (c *FinanceTriggerCollector) CollectAndNotify(ctx context.Context, userID string, now time.Time) error {
	if now.IsZero() {
		now = time.Now().UTC()
	}

	if c.evaluator != nil {
		if _, err := c.evaluator.EvaluateUserLimits(ctx, userID, now); err != nil {
			return err
		}
	}

	summary, err := c.finRepo.GetFinancialSummary(ctx, userID, now)
	if err == nil && summary != nil {
		// 1. Fatura com saldo insuficiente
		if summary.OpenInvoicesTotal > 0 && summary.ConsolidatedBalance < summary.OpenInvoicesTotal {
			deficit := summary.OpenInvoicesTotal - summary.ConsolidatedBalance
			_, _ = c.attention.ShouldDeliver(ctx, service.AttentionCandidate{
				UserID:       userID,
				SourceWorker: "finance_trigger",
				Category:     "financas",
				Urgency:      "critical",
				DedupKey:     "finance_invoice_deficit:" + now.Format("2006-01-02"),
				Title:        "Fatura supera saldo em conta",
				Body:         fmt.Sprintf("Suas faturas abertas (R$ %.2f) superam seu saldo em R$ %.2f.", summary.OpenInvoicesTotal, deficit),
				Now:          now,
			})
		}

		// 2. Reajuste de assinatura
		for _, sub := range summary.Subscriptions {
			if sub.IsPriceIncreased {
				_, _ = c.attention.ShouldDeliver(ctx, service.AttentionCandidate{
					UserID:       userID,
					SourceWorker: "finance_trigger",
					Category:     "financas",
					Urgency:      "normal",
					DedupKey:     fmt.Sprintf("finance_sub_increase:%s:%s", strings.ToLower(sub.MerchantName), now.Format("2006-01")),
					Title:        fmt.Sprintf("Reajuste em %s", sub.MerchantName),
					Body:         fmt.Sprintf("Cobrança subiu de R$ %.2f para R$ %.2f.", sub.PreviousAmount, sub.Amount),
					Now:          now,
				})
			}
		}
	}

	// 3. Cobranças duplicadas (< 10 min, mesmo valor e descrição)
	txs, err := c.finRepo.ListTransactions(ctx, userID, 40, 0)
	if err == nil && len(txs) > 1 {
		for i := 0; i < len(txs); i++ {
			if txs[i].Amount >= 0 {
				continue
			}
			for j := i + 1; j < len(txs); j++ {
				if txs[j].Amount != txs[i].Amount {
					continue
				}
				if !strings.EqualFold(strings.TrimSpace(txs[i].Description), strings.TrimSpace(txs[j].Description)) {
					continue
				}
				diff := math.Abs(txs[i].OccurredAt.Sub(txs[j].OccurredAt).Minutes())
				if diff <= 10 {
					_, _ = c.attention.ShouldDeliver(ctx, service.AttentionCandidate{
						UserID:       userID,
						SourceWorker: "finance_trigger",
						Category:     "financas",
						Urgency:      "high",
						DedupKey:     fmt.Sprintf("finance_dup:%s:%.2f:%s", strings.ToLower(txs[i].Description), math.Abs(txs[i].Amount), txs[i].OccurredAt.Format("2006-01-02")),
						Title:        "Possível cobrança duplicada",
						Body:         fmt.Sprintf("2 cobranças de R$ %.2f em %s com %.0f min de diferença.", math.Abs(txs[i].Amount), txs[i].Description, diff),
						Now:          now,
					})
					break
				}
			}
		}
	}

	return nil
}
