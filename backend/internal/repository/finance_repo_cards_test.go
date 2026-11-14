package repository_test

import (
	"context"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func intPtr(v int) *int { return &v }

func TestFinanceRepo_TransacaoResolveContaPeloPluggyAccountID(t *testing.T) {
	repo, userID := setupTestFinanceRepo(t)
	ctx := context.Background()

	if err := repo.UpsertAccountsBatch(ctx, userID, []domain.FinanceAccount{{
		PluggyAccountID: "pl-acc-1", InstitutionName: "Pluggy Bank", AccountType: domain.AccountTypeCredit,
		Name: "Cartão", ClosingDay: intPtr(10), DueDay: intPtr(15),
	}}); err != nil {
		t.Fatalf("conta: %v", err)
	}
	accs, err := repo.ListAccounts(ctx, userID)
	if err != nil || len(accs) != 1 {
		t.Fatalf("contas: %v (%d)", err, len(accs))
	}
	if accs[0].ClosingDay == nil || *accs[0].ClosingDay != 10 || accs[0].DueDay == nil || *accs[0].DueDay != 15 {
		t.Fatalf("ciclo do cartão não persistiu: %+v", accs[0])
	}

	err = repo.UpsertTransactionsBatch(ctx, userID, []domain.FinanceTransaction{
		{
			PluggyTransactionID: "tx-1", PluggyAccountID: "pl-acc-1", Description: "NETFLIX.COM",
			Amount: -55.9, TransactionType: domain.TxDebit, Category: "Lazer",
			OccurredAt:        time.Date(2026, 5, 1, 12, 0, 0, 0, time.UTC),
			InstallmentNumber: intPtr(2), TotalInstallments: intPtr(6), PaymentType: "INSTALLMENT",
			MCC: intPtr(5812), Status: "POSTED",
		},
		{ // conta desconhecida: deve ser ignorada sem derrubar o lote
			PluggyTransactionID: "tx-orfa", PluggyAccountID: "nao-existe", Description: "X",
			Amount: -1, TransactionType: domain.TxDebit, OccurredAt: time.Now(),
		},
	})
	if err != nil {
		t.Fatalf("lote com transação órfã não deve falhar: %v", err)
	}
	list, err := repo.ListTransactions(ctx, userID, 50, 0)
	if err != nil || len(list) != 1 {
		t.Fatalf("esperava 1 transação, obteve %d (%v)", len(list), err)
	}
	got := list[0]
	if got.AccountID != accs[0].ID {
		t.Fatalf("account_id não resolvido: %q != %q", got.AccountID, accs[0].ID)
	}
	if got.InstallmentNumber == nil || *got.InstallmentNumber != 2 || got.TotalInstallments == nil || *got.TotalInstallments != 6 {
		t.Fatalf("parcelas não persistiram: %+v", got)
	}
	if got.PaymentType != "INSTALLMENT" || got.MCC == nil || *got.MCC != 5812 || got.Status != "POSTED" {
		t.Fatalf("metadados do cartão não persistiram: %+v", got)
	}
}

func TestFinanceRepo_SyncRepetidoNaoDuplicaTransacaoParcelada(t *testing.T) {
	repo, userID := setupTestFinanceRepo(t)
	ctx := context.Background()
	_ = repo.UpsertAccountsBatch(ctx, userID, []domain.FinanceAccount{{PluggyAccountID: "a", InstitutionName: "B", AccountType: domain.AccountTypeCredit, Name: "C"}})
	tx := domain.FinanceTransaction{
		PluggyTransactionID: "t1", PluggyAccountID: "a", Description: "TV", Amount: -100,
		TransactionType: domain.TxDebit, OccurredAt: time.Now(), InstallmentNumber: intPtr(1), TotalInstallments: intPtr(3),
	}
	for i := 0; i < 3; i++ {
		if err := repo.UpsertTransactionsBatch(ctx, userID, []domain.FinanceTransaction{tx}); err != nil {
			t.Fatal(err)
		}
	}
	list, _ := repo.ListTransactions(ctx, userID, 50, 0)
	if len(list) != 1 {
		t.Fatalf("idempotência quebrada: %d transações", len(list))
	}
}
