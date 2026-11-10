package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupTestFinanceHandler(t *testing.T) (*handler.FinanceHandler, string) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_finance_handler.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "user-handler-test"
	_ = userRepo.Create(&domain.User{
		ID:        userID,
		Name:      "User Handler",
		Email:     "handler@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	repo := repository.NewFinanceRepository(db)
	svc := service.NewFinanceService(repo, "", "")
	h := handler.NewFinanceHandler(svc)
	return h, userID
}

func withAuth(req *http.Request, userID string) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	return req.WithContext(ctx)
}

func TestFinanceHandler_SummaryAndConnectToken(t *testing.T) {
	h, userID := setupTestFinanceHandler(t)

	// 1. GetConnectToken
	req := httptest.NewRequest("POST", "/api/v1/finance/connect-token", nil)
	req = withAuth(req, userID)
	rec := httptest.NewRecorder()
	h.GetConnectToken(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 em connect-token, obteve %d", rec.Code)
	}

	var tokenRes map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &tokenRes)
	if tokenRes["connect_token"] == "" {
		t.Errorf("esperava connect_token não vazio")
	}

	// 2. GetSummary
	reqSummary := httptest.NewRequest("GET", "/api/v1/finance/summary", nil)
	reqSummary = withAuth(reqSummary, userID)
	recSummary := httptest.NewRecorder()
	h.GetSummary(recSummary, reqSummary)

	if recSummary.Code != http.StatusOK {
		t.Fatalf("esperava 200 em summary, obteve %d", recSummary.Code)
	}
}

func TestFinanceHandler_SyncPayload(t *testing.T) {
	h, userID := setupTestFinanceHandler(t)

	payload := domain.FinanceSyncPayload{
		ConnectionID: "conn-h1",
		PluggyItemID: "pluggy-h1",
		Accounts: []domain.FinanceAccount{
			{
				ID:              "acc-h1",
				PluggyAccountID: "plg-acc-h1",
				InstitutionName: "Nubank",
				AccountType:     domain.AccountTypeBank,
				Name:            "Conta",
				Balance:         1500.0,
			},
		},
		Transactions: []domain.FinanceTransaction{
			{
				ID:                  "tx-h1",
				AccountID:           "acc-h1",
				PluggyTransactionID: "plg-tx-h1",
				Description:         "Café",
				Amount:              -12.0,
				TransactionType:     domain.TxDebit,
				Category:            "Alimentação",
				OccurredAt:          time.Now().UTC(),
			},
		},
	}

	bodyBytes, _ := json.Marshal(payload)
	req := httptest.NewRequest("POST", "/api/v1/finance/sync", bytes.NewReader(bodyBytes))
	req = withAuth(req, userID)
	rec := httptest.NewRecorder()
	h.SyncPayload(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 no sync, obteve %d: %s", rec.Code, rec.Body.String())
	}

	var syncRes map[string]int
	_ = json.Unmarshal(rec.Body.Bytes(), &syncRes)
	if syncRes["processed_accounts"] != 1 || syncRes["processed_transactions"] != 1 {
		t.Errorf("esperava 1 conta e 1 transação processada, obteve %v", syncRes)
	}
}

func TestFinanceHandler_CreateAndDeleteConnection(t *testing.T) {
	h, userID := setupTestFinanceHandler(t)

	// Create
	reqBody := `{"pluggy_item_id": "item-created", "institution_name": "Inter"}`
	req := httptest.NewRequest("POST", "/api/v1/finance/connections", bytes.NewReader([]byte(reqBody)))
	req = withAuth(req, userID)
	rec := httptest.NewRecorder()
	h.CreateConnection(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("esperava 201 ao criar conexão, obteve %d", rec.Code)
	}

	var created domain.FinanceConnection
	_ = json.Unmarshal(rec.Body.Bytes(), &created)
	if created.ID == "" {
		t.Fatalf("esperava ID gerado para conexão")
	}

	// Delete
	r := chi.NewRouter()
	r.Delete("/api/v1/finance/connections/{id}", h.DeleteConnection)

	delReq := httptest.NewRequest("DELETE", "/api/v1/finance/connections/"+created.ID, nil)
	delReq = withAuth(delReq, userID)
	delRec := httptest.NewRecorder()
	r.ServeHTTP(delRec, delReq)

	if delRec.Code != http.StatusNoContent {
		t.Fatalf("esperava 204 ao deletar conexão, obteve %d", delRec.Code)
	}
}
