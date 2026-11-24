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

	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func TestFinanceHandler_UpdateConnectionStatusAndSyncTelemetry(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "sync_telemetry.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-sync-tel-1"
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID:           userID,
		Name:         "Sync Tel",
		Email:        "synctel@test.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}); err != nil {
		t.Fatal(err)
	}

	repo := finance.NewFinanceRepository(db)
	svc := finance.NewFinanceService(repo)
	h := finance.NewFinanceHandler(svc)

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID)))
		})
	})
	r.Post("/api/v1/finance/sync", h.SyncPayload)
	r.Get("/api/v1/finance/connections", h.ListConnections)
	r.Patch("/api/v1/finance/connections/{id}/status", h.UpdateConnectionStatus)

	// 1. SyncPayload com telemetria real (connector_id, pluggy_execution_status, last_bank_refresh_at)
	refreshAt := time.Now().UTC().Add(-5 * time.Minute).Truncate(time.Second)
	syncBody, _ := json.Marshal(domain.FinanceSyncPayload{
		PluggyItemID:          "item-nubank-1",
		ConnectorID:           212,
		InstitutionName:       "Nubank",
		Status:                domain.ConnectionStatusUpdated,
		PluggyExecutionStatus: "SUCCESS",
		LastBankRefreshAt:     &refreshAt,
		Accounts: []domain.FinanceAccount{
			{PluggyAccountID: "acc-nu-1", InstitutionName: "Nubank", AccountType: domain.AccountTypeBank, Name: "Conta", Balance: 1500},
		},
	})
	reqSync := httptest.NewRequest(http.MethodPost, "/api/v1/finance/sync", bytes.NewReader(syncBody))
	recSync := httptest.NewRecorder()
	r.ServeHTTP(recSync, reqSync)
	if recSync.Code != http.StatusOK {
		t.Fatalf("esperava 200 no sync, obteve %d: %s", recSync.Code, recSync.Body.String())
	}

	// 2. Listar conexões e validar telemetria gravada
	reqList := httptest.NewRequest(http.MethodGet, "/api/v1/finance/connections", nil)
	recList := httptest.NewRecorder()
	r.ServeHTTP(recList, reqList)
	var conns []domain.FinanceConnection
	if err := json.Unmarshal(recList.Body.Bytes(), &conns); err != nil || len(conns) != 1 {
		t.Fatalf("esperava 1 conexão, obteve %d (err=%v)", len(conns), err)
	}
	if conns[0].ConnectorID != 212 || conns[0].PluggyExecutionStatus != "SUCCESS" || conns[0].LastBankRefreshAt == nil {
		t.Fatalf("telemetria inesperada: %+v", conns[0])
	}

	// 3. PATCH /connections/{id}/status com WAITING_USER_INPUT deve incrementar consecutive_failures
	patchBody, _ := json.Marshal(domain.FinanceConnectionStatusUpdate{
		Status:                domain.ConnectionStatusWaitingInput,
		PluggyExecutionStatus: "WAITING_USER_INPUT",
		LastErrorCode:         "MFA_REQUIRED",
		LastErrorMessage:      "Token expirado",
	})
	reqPatch := httptest.NewRequest(http.MethodPatch, "/api/v1/finance/connections/"+conns[0].ID+"/status", bytes.NewReader(patchBody))
	recPatch := httptest.NewRecorder()
	r.ServeHTTP(recPatch, reqPatch)
	if recPatch.Code != http.StatusNoContent {
		t.Fatalf("esperava 204 no PATCH status, obteve %d: %s", recPatch.Code, recPatch.Body.String())
	}

	recList2 := httptest.NewRecorder()
	r.ServeHTTP(recList2, httptest.NewRequest(http.MethodGet, "/api/v1/finance/connections", nil))
	var conns2 []domain.FinanceConnection
	_ = json.Unmarshal(recList2.Body.Bytes(), &conns2)
	if conns2[0].Status != domain.ConnectionStatusWaitingInput || conns2[0].ConsecutiveFailures != 1 || conns2[0].LastErrorCode != "MFA_REQUIRED" {
		t.Fatalf("esperava WAITING_USER_INPUT e consecutive_failures=1, obteve %+v", conns2[0])
	}
}
