package finance_test

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/finance"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func TestFinanceOnda1_LimitsMultiScope_Recategorize_And_Installments(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "onda1.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-onda1"
	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID: userID, Name: "Onda 1", Email: "onda1@test.com", PasswordHash: "h",
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	})

	finRepo := finance.NewFinanceRepository(db)
	limitRepo := finance.NewFinanceLimitRepository(db)
	analyticsRepo := finance.NewFinanceAnalyticsRepository(db)

	finSvc := finance.NewFinanceService(finRepo, analyticsRepo)
	limitSvc := finance.NewFinanceLimitService(limitRepo, finRepo)

	limH := finance.NewFinanceLimitHandler(limitSvc)
	anaH := finance.NewFinanceAnalyticsHandler(finSvc)

	// Seed contas + transações no mês atual
	now := time.Now().UTC()
	_ = finSvc.IngestSyncPayload(context.Background(), userID, &domain.FinanceSyncPayload{
		PluggyItemID:    "item-o1",
		InstitutionName: "Nubank",
		Accounts: []domain.FinanceAccount{
			{ID: "acc-card-1", PluggyAccountID: "p-card-1", InstitutionName: "Nubank", AccountType: domain.AccountTypeCredit, Name: "Roxinho", Balance: 900},
		},
		Transactions: []domain.FinanceTransaction{
			{ID: "tx-1", PluggyTransactionID: "ptx-1", PluggyAccountID: "p-card-1", Description: "IFOOD *IFOOD", CleanMerchantName: "iFood", Amount: -150, TransactionType: domain.TxDebit, Category: "Delivery", IsRecurring: false, OccurredAt: now},
			{ID: "tx-2", PluggyTransactionID: "ptx-2", PluggyAccountID: "p-card-1", Description: "NETFLIX.COM", CleanMerchantName: "Netflix", Amount: -55.90, TransactionType: domain.TxDebit, Category: "Streaming", IsRecurring: true, OccurredAt: now},
			{ID: "tx-3", PluggyTransactionID: "ptx-3", PluggyAccountID: "p-card-1", Description: "IFOOD *IFOOD", CleanMerchantName: "iFood", Amount: -100, TransactionType: domain.TxDebit, Category: "Outros", IsRecurring: false, OccurredAt: now},
		},
	})

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID)))
		})
	})
	r.Post("/api/v1/finance/limits", limH.UpsertLimit)
	r.Get("/api/v1/finance/limits", limH.ListLimits)
	r.Get("/api/v1/finance/limits/suggestions", limH.GetLimitSuggestions)
	r.Patch("/api/v1/finance/transactions/{id}", anaH.RecategorizeTransaction)
	r.Get("/api/v1/finance/transactions", anaH.SearchTransactions)
	r.Get("/api/v1/finance/cards", anaH.GetCardsOverview)
	r.Get("/api/v1/finance/installments/projection", anaH.GetInstallmentsOverview)

	// 1. Recategorizar tx-3 com apply_to_merchant=true (deve atualizar tx-1 também)
	recatBody, _ := json.Marshal(domain.FinanceRecategorizeRequest{Category: "Restaurantes", ApplyToMerchant: true})
	recatRec := httptest.NewRecorder()
	r.ServeHTTP(recatRec, httptest.NewRequest(http.MethodPatch, "/api/v1/finance/transactions/tx-3", bytes.NewReader(recatBody)))
	if recatRec.Code != http.StatusOK {
		t.Fatalf("recategorize falhou: %d %s", recatRec.Code, recatRec.Body.String())
	}

	// 2. Criar limites multi-escopo: CARD, CATEGORY, SUBSCRIPTIONS, MERCHANT, GLOBAL_MONTHLY
	scopes := []domain.FinanceLimitRule{
		{ScopeType: domain.LimitScopeCard, Title: "Cartão Roxinho", AccountID: "acc-card-1", TargetAmount: 500, PeriodType: domain.LimitPeriodMonthly},
		{ScopeType: domain.LimitScopeCategory, Title: "Restaurantes", CategoryFilter: "Restaurantes", TargetAmount: 300},
		{ScopeType: domain.LimitScopeSubscriptions, Title: "Assinaturas", TargetAmount: 50},
		{ScopeType: domain.LimitScopeMerchant, Title: "iFood", MerchantPattern: "ifood", TargetAmount: 200},
		{ScopeType: domain.LimitScopeGlobalMonthly, Title: "Teto Mensal", TargetAmount: 1000},
	}
	for _, sc := range scopes {
		b, _ := json.Marshal(sc)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/finance/limits", bytes.NewReader(b)))
		if rec.Code != http.StatusCreated {
			t.Fatalf("esperava 201 para scope %s, obteve %d: %s", sc.ScopeType, rec.Code, rec.Body.String())
		}
	}

	// 3. Listar limites e validar cálculo determinístico
	listRec := httptest.NewRecorder()
	r.ServeHTTP(listRec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/limits", nil))
	var statuses []domain.FinanceLimitStatus
	_ = json.Unmarshal(listRec.Body.Bytes(), &statuses)
	if len(statuses) != 5 {
		t.Fatalf("esperava 5 limites, obteve %d", len(statuses))
	}
	for _, st := range statuses {
		switch st.Rule.ScopeType {
		case domain.LimitScopeSubscriptions:
			if st.StatusLabel != "EXCEEDED" || st.SpentAmount < 55 {
				t.Fatalf("esperava SUBSCRIPTIONS EXCEEDED (>=55), obteve %+v", st)
			}
		case domain.LimitScopeMerchant:
			if st.StatusLabel != "EXCEEDED" || st.SpentAmount != 250 {
				t.Fatalf("esperava MERCHANT iFood = 250 EXCEEDED, obteve %+v", st)
			}
		case domain.LimitScopeGlobalMonthly:
			if st.SpentAmount != 305.90 {
				t.Fatalf("esperava GLOBAL_MONTHLY = 305.90, obteve %.2f", st.SpentAmount)
			}
		}
	}

	// 4. Sugestões de limites + Busca textual no extrato + Cartões
	sugRec := httptest.NewRecorder()
	r.ServeHTTP(sugRec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/limits/suggestions", nil))
	if sugRec.Code != http.StatusOK {
		t.Fatalf("suggestions falhou: %d", sugRec.Code)
	}

	searchRec := httptest.NewRecorder()
	r.ServeHTTP(searchRec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/transactions?q=ifood", nil))
	var foundTxs []domain.FinanceTransaction
	_ = json.Unmarshal(searchRec.Body.Bytes(), &foundTxs)
	if len(foundTxs) != 2 {
		t.Fatalf("esperava 2 transações iFood, obteve %d", len(foundTxs))
	}

	// 5. Teste de conservação matemática da projeção 12M de parcelamentos (CAD-11)
	_, err = db.Exec(`INSERT INTO finance_installment_plans (id, user_id, account_id, plan_key, merchant_name, installment_count, installment_amount, total_amount, source, created_at, updated_at) VALUES ('plan-1', ?, 'acc-card-1', 'k1', 'Apple', 6, 200, 1200, 'PLUGGY', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`, userID)
	if err != nil {
		t.Fatal(err)
	}
	instRec := httptest.NewRecorder()
	r.ServeHTTP(instRec, httptest.NewRequest(http.MethodGet, "/api/v1/finance/installments/projection?months=12", nil))
	var projResp finance.InstallmentsOverviewResponse
	_ = json.Unmarshal(instRec.Body.Bytes(), &projResp)
	sumProj := 0.0
	for _, m := range projResp.MonthlyProjection {
		sumProj += m.TotalAmount
	}
	if sumProj != 1200 || projResp.TotalCommitted != 1200 {
		t.Fatalf("violação de conservação na projeção: sum=%.2f total=%.2f", sumProj, projResp.TotalCommitted)
	}
}
