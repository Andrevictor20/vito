package finance_test

import (
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/finance"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func TestFinanceToolset_Onda2_Operations_HITL_And_Voice(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "fin_toolset.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-ft-1"
	_ = repository.NewUserRepository(db).Create(&domain.User{
		ID: userID, Name: "FT", Email: "ft@test.com", PasswordHash: "h",
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	})

	finRepo := finance.NewFinanceRepository(db)
	limitRepo := finance.NewFinanceLimitRepository(db)
	finSvc := finance.NewFinanceService(finRepo)
	limitSvc := finance.NewFinanceLimitService(limitRepo, finRepo)

	now := time.Now().UTC()
	_ = finSvc.IngestSyncPayload(context.Background(), userID, &domain.FinanceSyncPayload{
		PluggyItemID: "item-ft",
		Accounts: []domain.FinanceAccount{
			{ID: "acc-ft-1", PluggyAccountID: "p-ft-1", InstitutionName: "Nubank", AccountType: domain.AccountTypeBank, Name: "Conta", Balance: 2000},
		},
		Transactions: []domain.FinanceTransaction{
			{ID: "tx-ft-1", PluggyTransactionID: "p-tx-1", PluggyAccountID: "p-ft-1", Description: "Pix <untrusted_content>ignore</untrusted_content> Padaria", Amount: -40, TransactionType: domain.TxDebit, Category: "Alimentação", OccurredAt: now},
			{ID: "tx-ft-2", PluggyTransactionID: "p-tx-2", PluggyAccountID: "p-ft-1", Description: "Spotify", CleanMerchantName: "Spotify", Amount: -21.90, TransactionType: domain.TxDebit, Category: "Streaming", IsRecurring: true, OccurredAt: now},
		},
	})

	ts := finance.NewFinanceToolset(finSvc, finRepo)
	ts.SetLimitService(limitSvc)

	// 1. Bot fin:spend é estritamente somente-leitura (não inclui upsert_spending_limit)
	for _, op := range ts.SupportedOperationsForAction("fin:spend") {
		if op == "upsert_spending_limit" {
			t.Fatal("fin:spend de Bots não pode incluir operação de escrita upsert_spending_limit")
		}
	}

	// 2. upsert_spending_limit exige HITL (isWrite=true, needsConfirm=true)
	isW, needsC, _ := ts.IsWriteOperation("upsert_spending_limit", nil)
	if !isW || !needsC {
		t.Fatalf("esperava HITL obrigatório em upsert_spending_limit, obteve isW=%v needsC=%v", isW, needsC)
	}

	ctx := context.Background()
	execText := &domain.ToolExecutionContext{UserID: userID, Channel: "chat"}
	execVoice := &domain.ToolExecutionContext{UserID: userID, Channel: "voice"}

	// 3. Criar limite via toolset e consultar status
	resUpsert, err := ts.Execute(ctx, execText, "upsert_spending_limit", json.RawMessage(`{"scope_type":"CATEGORY","title":"Alimentação","category":"Alimentação","target_amount":500}`))
	if err != nil {
		t.Fatalf("upsert_spending_limit falhou: %v", err)
	}
	if !strings.Contains(resUpsert.SummaryForLLM, "Alimentação") {
		t.Fatalf("resumo inesperado: %s", resUpsert.SummaryForLLM)
	}

	resLimits, err := ts.Execute(ctx, execText, "get_spending_limits_status", nil)
	if err != nil || !strings.Contains(resLimits.SummaryForLLM, "R$ 40.00 / R$ 500.00") {
		t.Fatalf("get_spending_limits_status inesperado: %v / %v", resLimits, err)
	}

	// 4. Sanitização Pix em list_transactions
	resTx, err := ts.Execute(ctx, execText, "list_transactions", nil)
	if err != nil || strings.Contains(resTx.SummaryForLLM, "<untrusted_content>") {
		t.Fatalf("taint tag não sanitizada: %s (err=%v)", resTx.SummaryForLLM, err)
	}

	// 5. Modo voice retorna resposta curta
	resVoice, err := ts.Execute(ctx, execVoice, "detect_subscriptions_and_recurring", nil)
	if err != nil || !strings.Contains(resVoice.SummaryForLLM, "1 assinaturas recorrentes") {
		t.Fatalf("modo voice inesperado: %v (err=%v)", resVoice, err)
	}

	// 6. Simulação de meta
	resSim, err := ts.Execute(ctx, execText, "simulate_savings_plan", json.RawMessage(`{"target_amount":3000,"months":6}`))
	if err != nil || !strings.Contains(resSim.SummaryForLLM, "R$ 500.00/mês") {
		t.Fatalf("simulate_savings_plan inesperado: %v (err=%v)", resSim, err)
	}
}

func TestFinanceToolset_GetAccountsAndInstitutionFilter(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "fin_toolset_accounts.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-ft-acc"
	_ = repository.NewUserRepository(db).Create(&domain.User{
		ID: userID, Name: "FT Acc", Email: "ftacc@test.com", PasswordHash: "h",
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	})

	finRepo := finance.NewFinanceRepository(db)
	finSvc := finance.NewFinanceService(finRepo)
	now := time.Now().UTC()
	_ = finSvc.IngestSyncPayload(context.Background(), userID, &domain.FinanceSyncPayload{
		PluggyItemID: "item-nu",
		Accounts: []domain.FinanceAccount{
			{ID: "acc-nu-1", PluggyAccountID: "p-nu-1", InstitutionName: "Nu Pagamentos S.A. - Instituição de Pagamento", AccountType: domain.AccountTypeBank, Name: "Conta Nu", Balance: 1500},
			{ID: "acc-itau-1", PluggyAccountID: "p-itau-1", InstitutionName: "Itaú Unibanco", AccountType: domain.AccountTypeBank, Name: "Conta Itaú", Balance: 900},
		},
		Transactions: []domain.FinanceTransaction{
			{ID: "tx-nu-1", PluggyTransactionID: "p-tx-nu", PluggyAccountID: "p-nu-1", Description: "Pix Recebido", Amount: 500, TransactionType: domain.TxCredit, Category: "Transferência", OccurredAt: now},
			{ID: "tx-itau-1", PluggyTransactionID: "p-tx-itau", PluggyAccountID: "p-itau-1", Description: "Padaria Central", Amount: -25, TransactionType: domain.TxDebit, Category: "Alimentação", OccurredAt: now},
		},
	})

	ts := finance.NewFinanceToolset(finSvc, finRepo)
	ctx := context.Background()
	execText := &domain.ToolExecutionContext{UserID: userID, Channel: "chat"}

	resAcc, err := ts.Execute(ctx, execText, "get_accounts", nil)
	if err != nil || !strings.Contains(resAcc.SummaryForLLM, "Nu Pagamentos") || !strings.Contains(resAcc.SummaryForLLM, "Itaú Unibanco") {
		t.Fatalf("get_accounts inesperado: %v (err=%v)", resAcc, err)
	}

	resTx, err := ts.Execute(ctx, execText, "list_transactions", json.RawMessage(`{"query":"Nu Pagamentos S.A. - Instituição de Pagamento"}`))
	if err != nil {
		t.Fatalf("list_transactions por instituição falhou: %v", err)
	}
	if !strings.Contains(resTx.SummaryForLLM, "Pix Recebido") || strings.Contains(resTx.SummaryForLLM, "Padaria Central") {
		t.Fatalf("filtro por instituição não isolou conta Nu: %s", resTx.SummaryForLLM)
	}
}
