package service_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestSpendingLimitEvaluator_AntiSpamAndSyncHook(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "eval.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-eval-1"
	_ = repository.NewUserRepository(db).Create(&domain.User{
		ID: userID, Name: "Eval", Email: "eval@test.com", PasswordHash: "h",
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	})

	finRepo := repository.NewFinanceRepository(db)
	limitRepo := repository.NewFinanceLimitRepository(db)
	limitSvc := service.NewFinanceLimitService(limitRepo, finRepo)
	finSvc := service.NewFinanceService(finRepo)
	att := service.NewAttentionBudgetService(db, nil)
	eval := service.NewSpendingLimitEvaluator(limitRepo, att)

	// Criar limite de R$ 200 em Delivery com patamares 80 e 100
	_, err = limitSvc.UpsertLimit(context.Background(), userID, &domain.FinanceLimitRule{
		ScopeType:       domain.LimitScopeCategory,
		Title:           "Delivery",
		CategoryFilter:  "Delivery",
		TargetAmount:    200,
		AlertThresholds: []int{80, 100},
		IsActive:        true,
	})
	if err != nil {
		t.Fatal(err)
	}

	now := time.Now().UTC()
	// 1. Sync com gasto de R$ 170 (85%) -> deve disparar exatamente 1 alerta (80%)
	_ = finSvc.IngestSyncPayload(context.Background(), userID, &domain.FinanceSyncPayload{
		PluggyItemID: "item-eval",
		Accounts:     []domain.FinanceAccount{{ID: "acc-e1", PluggyAccountID: "p-e1", InstitutionName: "Nubank", AccountType: domain.AccountTypeBank, Name: "CC", Balance: 500}},
		Transactions: []domain.FinanceTransaction{{ID: "tx-e1", PluggyTransactionID: "pe1", PluggyAccountID: "p-e1", Description: "iFood", Amount: -170, TransactionType: domain.TxDebit, Category: "Delivery", OccurredAt: now}},
	})

	events1, err := eval.EvaluateUserLimits(context.Background(), userID, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(events1) != 1 || events1[0].ThresholdPercent != 80 {
		t.Fatalf("esperava 1 evento no patamar 80%%, obteve %+v", events1)
	}

	// 2. Reavaliação imediata sem novas transações -> 0 novos eventos (anti-spam!)
	events2, err := eval.EvaluateUserLimits(context.Background(), userID, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(events2) != 0 {
		t.Fatalf("esperava 0 eventos duplicados, obteve %+v", events2)
	}

	// 3. Nova compra de R$ 50 (total R$ 220 = 110%) -> dispara apenas o patamar 100%
	_ = finSvc.IngestSyncPayload(context.Background(), userID, &domain.FinanceSyncPayload{
		PluggyItemID: "item-eval",
		Transactions: []domain.FinanceTransaction{{ID: "tx-e2", PluggyTransactionID: "pe2", PluggyAccountID: "p-e1", Description: "iFood 2", Amount: -50, TransactionType: domain.TxDebit, Category: "Delivery", OccurredAt: now}},
	})
	events3, err := eval.EvaluateUserLimits(context.Background(), userID, now)
	if err != nil {
		t.Fatal(err)
	}
	if len(events3) != 1 || events3[0].ThresholdPercent != 100 {
		t.Fatalf("esperava 1 evento no patamar 100%%, obteve %+v", events3)
	}

	// 4. FinanceTriggerCollector detecta cobrança duplicada < 10 min
	_ = finSvc.IngestSyncPayload(context.Background(), userID, &domain.FinanceSyncPayload{
		PluggyItemID: "item-eval",
		Transactions: []domain.FinanceTransaction{
			{ID: "tx-dup1", PluggyTransactionID: "pdup1", PluggyAccountID: "p-e1", Description: "Uber *Trip", Amount: -25.50, TransactionType: domain.TxDebit, Category: "Transporte", OccurredAt: now.Add(-3 * time.Minute)},
			{ID: "tx-dup2", PluggyTransactionID: "pdup2", PluggyAccountID: "p-e1", Description: "Uber *Trip", Amount: -25.50, TransactionType: domain.TxDebit, Category: "Transporte", OccurredAt: now},
		},
	})
	collector := service.NewFinanceTriggerCollector(finRepo, eval, att)
	if err := collector.CollectAndNotify(context.Background(), userID, now); err != nil {
		t.Fatalf("collector falhou: %v", err)
	}
}
