package repository_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupTestFinanceRepo(t *testing.T) (repository.FinanceRepository, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_finance.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "user-finance-test-1"
	err = userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "Usuário Financeiro",
		Email:        "finance@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("falha ao criar usuário de teste: %v", err)
	}

	return repository.NewFinanceRepository(db), userID
}

func TestFinanceRepo_ConnectionLifecycle(t *testing.T) {
	repo, userID := setupTestFinanceRepo(t)
	ctx := context.Background()

	conn := &domain.FinanceConnection{
		ID:              "conn-1",
		UserID:          userID,
		PluggyItemID:    "item-pluggy-101",
		ConnectorID:     200,
		InstitutionName: "Meu Pluggy Nubank",
		Status:          domain.ConnectionStatusUpdated,
	}

	// 1. Upsert
	err := repo.UpsertConnection(ctx, conn)
	if err != nil {
		t.Fatalf("esperava nil ao salvar conexão, obteve %v", err)
	}

	// 2. Get por ID
	found, err := repo.GetConnection(ctx, userID, "conn-1")
	if err != nil {
		t.Fatalf("esperava encontrar conexão por ID, obteve %v", err)
	}
	if found.InstitutionName != "Meu Pluggy Nubank" {
		t.Errorf("esperava Meu Pluggy Nubank, obteve %s", found.InstitutionName)
	}

	// 3. Get por PluggyItemID
	byPluggy, err := repo.GetConnectionByPluggyItemID(ctx, userID, "item-pluggy-101")
	if err != nil {
		t.Fatalf("esperava encontrar por pluggy item id, obteve %v", err)
	}
	if byPluggy.ID != "conn-1" {
		t.Errorf("esperava id conn-1, obteve %s", byPluggy.ID)
	}

	// 4. List
	list, err := repo.ListConnections(ctx, userID)
	if err != nil {
		t.Fatalf("esperava listar conexões, obteve %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("esperava 1 conexão, obteve %d", len(list))
	}

	// 5. Delete
	err = repo.DeleteConnection(ctx, userID, "conn-1")
	if err != nil {
		t.Fatalf("esperava deletar com sucesso, obteve %v", err)
	}

	_, err = repo.GetConnection(ctx, userID, "conn-1")
	if err != domain.ErrFinanceConnectionNotFound {
		t.Errorf("esperava ErrFinanceConnectionNotFound após deletar, obteve %v", err)
	}
}

func TestFinanceRepo_TransactionsBatch_Idempotent(t *testing.T) {
	repo, userID := setupTestFinanceRepo(t)
	ctx := context.Background()

	// Cria conexão e conta primeiro
	_ = repo.UpsertConnection(ctx, &domain.FinanceConnection{
		ID:           "conn-idempotent",
		UserID:       userID,
		PluggyItemID: "pluggy-item-99",
	})
	_ = repo.UpsertAccountsBatch(ctx, userID, []domain.FinanceAccount{
		{
			ID:              "acc-1",
			UserID:          userID,
			ConnectionID:    "conn-idempotent",
			PluggyAccountID: "plg-acc-1",
			InstitutionName: "Itaú",
			AccountType:     domain.AccountTypeBank,
			Name:            "Conta Corrente",
			Balance:         1000.0,
		},
	})

	txs := []domain.FinanceTransaction{
		{
			ID:                  "tx-1",
			UserID:              userID,
			AccountID:           "acc-1",
			PluggyTransactionID: "plg-tx-1",
			Description:         "Supermercado Pão de Açúcar",
			Amount:              -150.50,
			TransactionType:     domain.TxDebit,
			Category:            "Alimentação",
			OccurredAt:          time.Now().UTC(),
		},
		{
			ID:                  "tx-2",
			UserID:              userID,
			AccountID:           "acc-1",
			PluggyTransactionID: "plg-tx-2",
			Description:         "Salário Empresa XYZ",
			Amount:              5000.00,
			TransactionType:     domain.TxCredit,
			Category:            "Renda",
			OccurredAt:          time.Now().UTC(),
		},
	}

	// 1ª Inserção em lote
	err := repo.UpsertTransactionsBatch(ctx, userID, txs)
	if err != nil {
		t.Fatalf("esperava sucesso na 1ª inserção em lote, obteve %v", err)
	}

	list1, err := repo.ListTransactions(ctx, userID, 10, 0)
	if err != nil || len(list1) != 2 {
		t.Fatalf("esperava 2 transações após 1º lote, obteve %d (err: %v)", len(list1), err)
	}

	// 2ª Inserção: MESMAS transações (simulando re-sincronização do extrato)
	txs[0].Description = "Supermercado Pão de Açúcar - Atualizado"
	err = repo.UpsertTransactionsBatch(ctx, userID, txs)
	if err != nil {
		t.Fatalf("esperava sucesso na 2ª inserção em lote (idempotente), obteve %v", err)
	}

	list2, err := repo.ListTransactions(ctx, userID, 10, 0)
	if err != nil || len(list2) != 2 {
		t.Fatalf("CRÍTICO: reenvio duplicou transações! esperava 2 transações, obteve %d", len(list2))
	}

	var updatedFound bool
	for _, it := range list2 {
		if it.PluggyTransactionID == "plg-tx-1" && it.Description == "Supermercado Pão de Açúcar - Atualizado" {
			updatedFound = true
			break
		}
	}
	if !updatedFound {
		t.Errorf("esperava descrição atualizada no DO UPDATE do ON CONFLICT")
	}
}

func TestFinanceRepo_GetFinancialSummary_Math(t *testing.T) {
	repo, userID := setupTestFinanceRepo(t)
	ctx := context.Background()

	_ = repo.UpsertConnection(ctx, &domain.FinanceConnection{
		ID:           "conn-math",
		UserID:       userID,
		PluggyItemID: "item-math",
	})

	_ = repo.UpsertAccountsBatch(ctx, userID, []domain.FinanceAccount{
		{
			ID:              "acc-bank",
			UserID:          userID,
			ConnectionID:    "conn-math",
			PluggyAccountID: "plg-bank-1",
			InstitutionName: "Nubank",
			AccountType:     domain.AccountTypeBank,
			Name:            "Conta Nu",
			Balance:         4000.0,
		},
		{
			ID:              "acc-credit",
			UserID:          userID,
			ConnectionID:    "conn-math",
			PluggyAccountID: "plg-credit-1",
			InstitutionName: "Nubank Roxinho",
			AccountType:     domain.AccountTypeCredit,
			Name:            "Cartão de Crédito",
			Balance:         -1000.0,
		},
	})

	now := time.Date(2026, 11, 10, 12, 0, 0, 0, time.UTC)
	_ = repo.UpsertTransactionsBatch(ctx, userID, []domain.FinanceTransaction{
		{
			ID:                  "tx-m1",
			UserID:              userID,
			AccountID:           "acc-bank",
			PluggyTransactionID: "plg-m1",
			Description:         "Aluguel",
			Amount:              -1200.0,
			TransactionType:     domain.TxDebit,
			Category:            "Moradia",
			OccurredAt:          time.Date(2026, 11, 5, 10, 0, 0, 0, time.UTC),
		},
		{
			ID:                  "tx-m2",
			UserID:              userID,
			AccountID:           "acc-bank",
			PluggyTransactionID: "plg-m2",
			Description:         "iFood",
			Amount:              -300.0,
			TransactionType:     domain.TxDebit,
			Category:            "Alimentação",
			OccurredAt:          time.Date(2026, 11, 8, 20, 0, 0, 0, time.UTC),
		},
	})

	summary, err := repo.GetFinancialSummary(ctx, userID, now)
	if err != nil {
		t.Fatalf("falha ao calcular sumário: %v", err)
	}

	if summary.ConsolidatedBalance != 4000.0 {
		t.Errorf("esperava saldo bancário 4000.0, obteve %f", summary.ConsolidatedBalance)
	}
	if summary.OpenInvoicesTotal != 1000.0 {
		t.Errorf("esperava fatura aberta 1000.0, obteve %f", summary.OpenInvoicesTotal)
	}
	if summary.MonthExpenses != 1500.0 {
		t.Errorf("esperava despesas do mês 1500.0, obteve %f", summary.MonthExpenses)
	}

	expectedDaily := 142.86
	if summary.SafeToSpendDaily != expectedDaily {
		t.Errorf("esperava SafeToSpendDaily %f, obteve %f", expectedDaily, summary.SafeToSpendDaily)
	}
	if summary.SafeToSpendDaysRemaining != 21 {
		t.Errorf("esperava 21 dias restantes, obteve %d", summary.SafeToSpendDaysRemaining)
	}
	if len(summary.CategorySpending) != 2 {
		t.Errorf("esperava 2 categorias agrupadas, obteve %d", len(summary.CategorySpending))
	}
}
