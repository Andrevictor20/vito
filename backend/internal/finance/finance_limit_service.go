package finance

import (
	"context"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// FinanceLimitService gerencia limites de gasto multi-escopo, metas e sugestões inteligentes.
type FinanceLimitService struct {
	limitRepo FinanceLimitRepository
	finRepo   FinanceRepository
}

// NewFinanceLimitService instancia o serviço de limites financeiros.
func NewFinanceLimitService(limitRepo FinanceLimitRepository, finRepo FinanceRepository) *FinanceLimitService {
	return &FinanceLimitService{limitRepo: limitRepo, finRepo: finRepo}
}

// ListLimitsWithStatus retorna todos os limites/metas do usuário com cálculo determinístico do ciclo atual.
func (s *FinanceLimitService) ListLimitsWithStatus(ctx context.Context, userID string, scope domain.SpendingLimitScope) ([]domain.FinanceLimitStatus, error) {
	rules, err := s.limitRepo.ListLimits(ctx, userID, scope)
	if err != nil {
		return nil, err
	}
	now := time.Now().UTC()
	out := make([]domain.FinanceLimitStatus, 0, len(rules))
	for _, r := range rules {
		st, err := s.limitRepo.ComputeLimitStatus(ctx, userID, r, now)
		if err != nil {
			return nil, err
		}
		out = append(out, *st)
	}
	return out, nil
}

// UpsertLimit valida e persiste um limite de gasto multi-escopo ou meta.
func (s *FinanceLimitService) UpsertLimit(ctx context.Context, userID string, rule *domain.FinanceLimitRule) (*domain.FinanceLimitStatus, error) {
	if rule == nil || strings.TrimSpace(userID) == "" || rule.TargetAmount <= 0 || strings.TrimSpace(rule.Title) == "" {
		return nil, domain.ErrFinanceInvalidPayload
	}
	rule.UserID = userID
	rule.Title = strings.TrimSpace(rule.Title)
	if rule.ScopeType == "" {
		rule.ScopeType = domain.LimitScopeCategory
	}
	if rule.PeriodType == "" {
		if rule.ScopeType == domain.LimitScopeCard && rule.AccountID != "" {
			rule.PeriodType = domain.LimitPeriodBillingCycle
		} else {
			rule.PeriodType = domain.LimitPeriodMonthly
		}
	}
	if len(rule.AlertThresholds) == 0 {
		if rule.AutoAlertThreshold > 0 && rule.AutoAlertThreshold < 100 {
			rule.AlertThresholds = []int{rule.AutoAlertThreshold, 100}
		} else {
			rule.AlertThresholds = []int{80, 100}
		}
	}
	sort.Ints(rule.AlertThresholds)

	hasInApp := false
	for _, ch := range rule.NotifyChannels {
		if ch == "in_app" {
			hasInApp = true
			break
		}
	}
	if !hasInApp {
		rule.NotifyChannels = append([]string{"in_app"}, rule.NotifyChannels...)
	}
	if len(rule.NotifyChannels) == 1 {
		rule.NotifyChannels = append(rule.NotifyChannels, "push")
	}

	if err := s.limitRepo.UpsertLimit(ctx, rule); err != nil {
		return nil, err
	}
	return s.limitRepo.ComputeLimitStatus(ctx, userID, *rule, time.Now().UTC())
}

// DeleteLimit remove um limite ou meta do usuário.
func (s *FinanceLimitService) DeleteLimit(ctx context.Context, userID, limitID string) error {
	if strings.TrimSpace(userID) == "" || strings.TrimSpace(limitID) == "" {
		return domain.ErrFinanceInvalidPayload
	}
	return s.limitRepo.DeleteLimit(ctx, userID, limitID)
}

// MuteLimitForCurrentCycle silencia alertas do limite até o fim do ciclo atual.
func (s *FinanceLimitService) MuteLimitForCurrentCycle(ctx context.Context, userID, limitID string) (*domain.FinanceLimitStatus, error) {
	rule, err := s.limitRepo.GetLimit(ctx, userID, limitID)
	if err != nil {
		return nil, err
	}
	st, err := s.limitRepo.ComputeLimitStatus(ctx, userID, *rule, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	mutedUntil := st.CycleEnd
	rule.MutedUntil = &mutedUntil
	if err := s.limitRepo.UpsertLimit(ctx, rule); err != nil {
		return nil, err
	}
	st.Rule = *rule
	return st, nil
}

// GetLimitHistory retorna os eventos de alerta disparados para o limite.
func (s *FinanceLimitService) GetLimitHistory(ctx context.Context, userID, limitID string) ([]domain.FinanceLimitAlertEvent, error) {
	return s.limitRepo.ListLimitAlertHistory(ctx, userID, limitID, 30)
}

// SuggestLimits gera até 4 sugestões de limites baseadas no histórico real do usuário.
func (s *FinanceLimitService) SuggestLimits(ctx context.Context, userID string) ([]domain.FinanceLimitSuggestion, error) {
	summary, err := s.finRepo.GetFinancialSummary(ctx, userID, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	accounts, _ := s.finRepo.ListAccounts(ctx, userID)

	var suggestions []domain.FinanceLimitSuggestion

	// 1. Top 2 categorias de gasto
	for i, cat := range summary.CategorySpending {
		if i >= 2 || cat.TotalAmount <= 0 {
			break
		}
		suggested := math.Ceil((cat.TotalAmount*1.1)/50.0) * 50.0
		suggestions = append(suggestions, domain.FinanceLimitSuggestion{
			ScopeType:       domain.LimitScopeCategory,
			Title:           "Limite " + cat.Category,
			CategoryFilter:  cat.Category,
			SuggestedAmount: suggested,
			BaselineSpend:   cat.TotalAmount,
			Reason:          "Baseado no seu gasto recente nesta categoria (+10% de margem)",
		})
	}

	// 2. Cartão de crédito principal
	for _, acc := range accounts {
		if acc.AccountType == domain.AccountTypeCredit {
			base := math.Abs(acc.Balance)
			if base < 300 {
				base = 1000
			}
			suggested := math.Ceil((base*1.1)/100.0) * 100.0
			suggestions = append(suggestions, domain.FinanceLimitSuggestion{
				ScopeType:       domain.LimitScopeCard,
				Title:           "Cartão " + acc.Name,
				AccountID:       acc.ID,
				SuggestedAmount: suggested,
				BaselineSpend:   base,
				Reason:          "Acompanhamento de fatura do ciclo atual",
			})
			break
		}
	}

	// 3. Assinaturas recorrentes
	if len(summary.Subscriptions) > 0 {
		subTotal := 0.0
		for _, sub := range summary.Subscriptions {
			subTotal += sub.Amount
		}
		if subTotal > 0 {
			suggested := math.Ceil((subTotal*1.05)/25.0) * 25.0
			suggestions = append(suggestions, domain.FinanceLimitSuggestion{
				ScopeType:       domain.LimitScopeSubscriptions,
				Title:           "Teto de Assinaturas",
				SuggestedAmount: suggested,
				BaselineSpend:   subTotal,
				Reason:          "Detecta reajustes ou novas cobranças recorrentes",
			})
		}
	}

	return suggestions, nil
}
