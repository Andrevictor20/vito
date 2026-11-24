package service

import (
	"context"
	"math"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// FinanceAnalyticsService fornece consultas analíticas, extrato filtrado, cartões e projeção de parcelas.
type FinanceAnalyticsService struct {
	analyticsRepo repository.FinanceAnalyticsRepository
	finRepo       repository.FinanceRepository
}

// NewFinanceAnalyticsService instancia o serviço analítico financeiro.
func NewFinanceAnalyticsService(analyticsRepo repository.FinanceAnalyticsRepository, finRepo repository.FinanceRepository) *FinanceAnalyticsService {
	return &FinanceAnalyticsService{analyticsRepo: analyticsRepo, finRepo: finRepo}
}

func (s *FinanceAnalyticsService) SearchTransactions(ctx context.Context, userID string, filter domain.FinanceTransactionFilter) ([]domain.FinanceTransaction, error) {
	return s.analyticsRepo.SearchTransactions(ctx, userID, filter)
}

func (s *FinanceAnalyticsService) RecategorizeTransaction(ctx context.Context, userID, txID string, req domain.FinanceRecategorizeRequest) (int64, error) {
	return s.analyticsRepo.RecategorizeTransaction(ctx, userID, txID, req.Category, req.ApplyToMerchant)
}

func (s *FinanceAnalyticsService) GetSpendingAnalytics(ctx context.Context, userID string) (*domain.FinancialSummary, error) {
	return s.finRepo.GetFinancialSummary(ctx, userID, time.Now().UTC())
}

func (s *FinanceAnalyticsService) GetCashFlowAnalytics(ctx context.Context, userID string, months int) ([]domain.FinanceCashFlowPoint, error) {
	return s.analyticsRepo.GetCashFlowAnalytics(ctx, userID, months, time.Now().UTC())
}

func (s *FinanceAnalyticsService) GetCardsOverview(ctx context.Context, userID string) ([]domain.FinanceCardOverview, error) {
	return s.analyticsRepo.GetCardsOverview(ctx, userID, time.Now().UTC())
}

func (s *FinanceAnalyticsService) GetCardBills(ctx context.Context, userID, accountID string) ([]domain.FinanceCreditBill, error) {
	return s.analyticsRepo.GetCardBills(ctx, userID, accountID)
}

// InstallmentProjectionMonth representa a soma projetada de parcelas por mês (YYYY-MM).
type InstallmentProjectionMonth struct {
	Month       string  `json:"month"`
	TotalAmount float64 `json:"total_amount"`
	PlansCount  int     `json:"plans_count"`
}

// InstallmentsOverviewResponse consolida planos e projeção 12M com invariante de conservação.
type InstallmentsOverviewResponse struct {
	Plans               []domain.FinanceInstallmentPlan `json:"plans"`
	MonthlyProjection   []InstallmentProjectionMonth    `json:"monthly_projection"`
	TotalCommitted      float64                         `json:"total_committed"`
	ReliefMonth         string                          `json:"relief_month,omitempty"`
}

// GetInstallmentsOverview calcula planos ativos e projeção mensal conservando o total comprometido.
func (s *FinanceAnalyticsService) GetInstallmentsOverview(ctx context.Context, userID string, months int) (*InstallmentsOverviewResponse, error) {
	if months <= 0 || months > 24 {
		months = 12
	}
	plans, err := s.analyticsRepo.GetInstallmentPlans(ctx, userID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	baseMonth := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC)
	monthTotals := make([]float64, months)
	monthCounts := make([]int, months)
	totalCommitted := 0.0

	for _, p := range plans {
		remaining := p.InstallmentCount
		if remaining <= 0 || p.InstallmentAmount <= 0 {
			continue
		}
		if remaining > months {
			remaining = months
		}
		for i := 0; i < remaining; i++ {
			monthTotals[i] += p.InstallmentAmount
			monthCounts[i]++
			totalCommitted += p.InstallmentAmount
		}
	}

	projection := make([]InstallmentProjectionMonth, 0, months)
	reliefMonth := ""
	for i := 0; i < months; i++ {
		ym := baseMonth.AddDate(0, i, 0).Format("2006-01")
		amt := math.Round(monthTotals[i]*100) / 100
		projection = append(projection, InstallmentProjectionMonth{
			Month:       ym,
			TotalAmount: amt,
			PlansCount:  monthCounts[i],
		})
		if reliefMonth == "" && i > 0 && amt == 0 && monthTotals[i-1] > 0 {
			reliefMonth = ym
		}
	}

	return &InstallmentsOverviewResponse{
		Plans:             plans,
		MonthlyProjection: projection,
		TotalCommitted:    math.Round(totalCommitted*100) / 100,
		ReliefMonth:       reliefMonth,
	}, nil
}

func (s *FinanceAnalyticsService) GetFinanceCalendar(ctx context.Context, userID string, from, to time.Time) ([]domain.FinanceCalendarEvent, error) {
	return s.analyticsRepo.GetFinanceCalendar(ctx, userID, from, to)
}
