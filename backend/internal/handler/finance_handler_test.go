package handler_test

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
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
	svc := service.NewFinanceService(repo)
	h := handler.NewFinanceHandler(svc)
	return h, userID
}

func withAuth(req *http.Request, userID string) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	return req.WithContext(ctx)
}

func TestFinanceHandler_Summary(t *testing.T) {
	h, userID := setupTestFinanceHandler(t)

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

func TestFinanceHandler_ByokBackup_LifecycleAndIsolation(t *testing.T) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "byok_handler.db"))
	if err != nil {
		t.Fatalf("falha ao abrir test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	aliceID := "user-byok-h-alice"
	bobID := "user-byok-h-bob"
	for _, u := range []struct{ id, email string }{
		{aliceID, "alice-h@example.com"},
		{bobID, "bob-h@example.com"},
	} {
		_ = userRepo.Create(&domain.User{
			ID:        u.id,
			Name:      u.id,
			Email:     u.email,
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		})
	}

	repo := repository.NewFinanceRepository(db)
	svc := service.NewFinanceService(repo)
	h := handler.NewFinanceHandler(svc)

	r := chi.NewRouter()
	r.Put("/api/v1/finance/byok-backup", h.PutByokBackup)
	r.Get("/api/v1/finance/byok-backup", h.GetByokBackup)
	r.Delete("/api/v1/finance/byok-backup", h.DeleteByokBackup)
	r.Get("/api/v1/finance/connections", h.ListConnections)
	r.Get("/api/v1/finance/summary", h.GetSummary)

	// 1. Sem usuário autenticado -> 401
	unauthReq := httptest.NewRequest("GET", "/api/v1/finance/byok-backup", nil)
	unauthRec := httptest.NewRecorder()
	r.ServeHTTP(unauthRec, unauthReq)
	if unauthRec.Code != http.StatusUnauthorized {
		t.Fatalf("esperava 401 sem auth, obteve %d", unauthRec.Code)
	}

	// 2. GET antes de salvar -> 404
	getEmptyReq := withAuth(httptest.NewRequest("GET", "/api/v1/finance/byok-backup", nil), aliceID)
	getEmptyRec := httptest.NewRecorder()
	r.ServeHTTP(getEmptyRec, getEmptyReq)
	if getEmptyRec.Code != http.StatusNotFound {
		t.Fatalf("esperava 404 antes de existir backup, obteve %d", getEmptyRec.Code)
	}

	// 3. PUT inválido (vazio / base64 inválido / tamanho excedido) -> 400
	oversized := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte("x"), domain.MaxByokCiphertextBytes+1))
	invalidBodies := []string{
		`{}`,
		`{"ciphertext":"","nonce":"AQID","key_version":1}`,
		`{"ciphertext":"AQID","nonce":"","key_version":1}`,
		`{"ciphertext":"%%%invalido%%%","nonce":"AQID","key_version":1}`,
		`{"ciphertext":"` + oversized + `","nonce":"AQID","key_version":1}`,
	}
	for _, body := range invalidBodies {
		req := withAuth(httptest.NewRequest("PUT", "/api/v1/finance/byok-backup", strings.NewReader(body)), aliceID)
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("esperava 400 para payload inválido, obteve %d (%s)", rec.Code, rec.Body.String())
		}
	}

	// 4. PUT válido para Alice -> 200 e sem vazar ciphertext/nonce na resposta do PUT
	secretCipherB64 := base64.StdEncoding.EncodeToString([]byte("cipher-alice-secret-blob"))
	secretNonceB64 := base64.StdEncoding.EncodeToString([]byte("123456789012"))
	putBody := `{"ciphertext":"` + secretCipherB64 + `","nonce":"` + secretNonceB64 + `","key_version":3}`
	putReq := withAuth(httptest.NewRequest("PUT", "/api/v1/finance/byok-backup", strings.NewReader(putBody)), aliceID)
	putRec := httptest.NewRecorder()
	r.ServeHTTP(putRec, putReq)
	if putRec.Code != http.StatusOK {
		t.Fatalf("esperava 200 no PUT byok-backup, obteve %d: %s", putRec.Code, putRec.Body.String())
	}
	if strings.Contains(putRec.Body.String(), secretCipherB64) || strings.Contains(putRec.Body.String(), secretNonceB64) {
		t.Fatalf("PUT não deveria ecoar ciphertext/nonce na resposta: %s", putRec.Body.String())
	}

	// 5. GET para Alice -> 200 com ciphertext, nonce, key_version e updated_at
	getReq := withAuth(httptest.NewRequest("GET", "/api/v1/finance/byok-backup", nil), aliceID)
	getRec := httptest.NewRecorder()
	r.ServeHTTP(getRec, getReq)
	if getRec.Code != http.StatusOK {
		t.Fatalf("esperava 200 no GET byok-backup, obteve %d", getRec.Code)
	}
	var got struct {
		Ciphertext string    `json:"ciphertext"`
		Nonce      string    `json:"nonce"`
		KeyVersion int       `json:"key_version"`
		UpdatedAt  time.Time `json:"updated_at"`
	}
	if err := json.Unmarshal(getRec.Body.Bytes(), &got); err != nil {
		t.Fatalf("erro ao decodificar resposta GET: %v", err)
	}
	if got.Ciphertext != secretCipherB64 || got.Nonce != secretNonceB64 || got.KeyVersion != 3 || got.UpdatedAt.IsZero() {
		t.Fatalf("resposta GET inesperada: %+v", got)
	}

	// 6. Isolamento: Bob não vê backup de Alice -> 404
	bobGetReq := withAuth(httptest.NewRequest("GET", "/api/v1/finance/byok-backup", nil), bobID)
	bobGetRec := httptest.NewRecorder()
	r.ServeHTTP(bobGetRec, bobGetReq)
	if bobGetRec.Code != http.StatusNotFound {
		t.Fatalf("Bob não deveria enxergar backup de Alice, obteve %d", bobGetRec.Code)
	}

	// 7. Backup nunca aparece em /connections nem /summary
	for _, path := range []string{"/api/v1/finance/connections", "/api/v1/finance/summary"} {
		listReq := withAuth(httptest.NewRequest("GET", path, nil), aliceID)
		listRec := httptest.NewRecorder()
		r.ServeHTTP(listRec, listReq)
		if listRec.Code != http.StatusOK {
			t.Fatalf("esperava 200 em %s, obteve %d", path, listRec.Code)
		}
		if strings.Contains(listRec.Body.String(), secretCipherB64) || strings.Contains(listRec.Body.String(), "byok") {
			t.Fatalf("endpoint %s vazou dados de backup BYOK: %s", path, listRec.Body.String())
		}
	}

	// 8. DELETE para Alice -> 204 e GET subsequente -> 404
	delReq := withAuth(httptest.NewRequest("DELETE", "/api/v1/finance/byok-backup", nil), aliceID)
	delRec := httptest.NewRecorder()
	r.ServeHTTP(delRec, delReq)
	if delRec.Code != http.StatusNoContent {
		t.Fatalf("esperava 204 no DELETE byok-backup, obteve %d", delRec.Code)
	}
	getAfterDelReq := withAuth(httptest.NewRequest("GET", "/api/v1/finance/byok-backup", nil), aliceID)
	getAfterDelRec := httptest.NewRecorder()
	r.ServeHTTP(getAfterDelRec, getAfterDelReq)
	if getAfterDelRec.Code != http.StatusNotFound {
		t.Fatalf("esperava 404 após DELETE, obteve %d", getAfterDelRec.Code)
	}
}
