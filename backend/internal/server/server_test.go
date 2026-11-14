package server_test

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestHealthCheckEndpoint(t *testing.T) {
	srv := server.New()
	ts := httptest.NewServer(srv.Router())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatalf("failed to make GET request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status 'ok', got '%v'", body["status"])
	}

	if body["service"] != "vito-backend" {
		t.Errorf("expected service 'vito-backend', got '%v'", body["service"])
	}
}

func TestTriggersRouting_PublicTemplates_And_ProtectedCRUD(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := tmpDir + "/test_triggers_routing.db"

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	authSvc := service.NewAuthService(userRepo, "test-secret")
	triggerRepo := repository.NewTriggerRepository(db)
	triggerSvc := service.NewTriggerService(triggerRepo)
	triggerHandler := handler.NewTriggerHandler(triggerSvc)

	srv := server.New(server.Config{
		AuthSvc:        authSvc,
		TriggerHandler: triggerHandler,
	})
	ts := httptest.NewServer(srv.Router())
	defer ts.Close()

	// 1. GET /api/v1/triggers/templates SEM cabeçalho Authorization DEVE retornar 200 OK
	res, err := http.Get(ts.URL + "/api/v1/triggers/templates")
	if err != nil {
		t.Fatalf("falha ao consultar templates: %v", err)
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		t.Fatalf("esperava status 200 para templates públicos, veio %d", res.StatusCode)
	}

	var payload struct {
		Templates []domain.TriggerTemplate `json:"templates"`
	}
	if err := json.NewDecoder(res.Body).Decode(&payload); err != nil {
		t.Fatalf("falha ao deserializar templates: %v", err)
	}
	if len(payload.Templates) < 8 {
		t.Errorf("esperava ao menos 8 templates, obteve %d", len(payload.Templates))
	}

	// 2. GET /api/v1/triggers SEM cabeçalho Authorization DEVE ser protegido (401)
	resTriggers, err := http.Get(ts.URL + "/api/v1/triggers")
	if err != nil {
		t.Fatalf("falha ao consultar triggers: %v", err)
	}
	defer resTriggers.Body.Close()

	if resTriggers.StatusCode != http.StatusUnauthorized {
		t.Errorf("esperava status 401 para /api/v1/triggers desprotegido, veio %d", resTriggers.StatusCode)
	}

	// 3. POST /api/v1/triggers/templates/tmpl-career-jobs/activate SEM Authorization DEVE ser protegido (401)
	resActivate, err := http.Post(ts.URL+"/api/v1/triggers/templates/tmpl-career-jobs/activate", "application/json", nil)
	if err != nil {
		t.Fatalf("falha ao tentar ativar template: %v", err)
	}
	defer resActivate.Body.Close()

	if resActivate.StatusCode != http.StatusUnauthorized {
		t.Errorf("esperava status 401 para activate sem token, veio %d", resActivate.StatusCode)
	}
}

func TestFinanceRouting_ByokBackupAndLegacyRemoved(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "test_finance_routing.db"))
	if err != nil {
		t.Fatalf("failed to open database: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	authSvc := service.NewAuthService(userRepo, "test-secret")
	authHandler := handler.NewAuthHandler(authSvc, userRepo)
	financeRepo := repository.NewFinanceRepository(db)
	financeSvc := service.NewFinanceService(financeRepo)
	financeHandler := handler.NewFinanceHandler(financeSvc)

	srv := server.New(server.Config{
		AuthSvc:        authSvc,
		AuthHandler:    authHandler,
		FinanceHandler: financeHandler,
	})
	ts := httptest.NewServer(srv.Router())
	defer ts.Close()

	// 1. Sem JWT -> 401
	unauthRes, err := http.Get(ts.URL + "/api/v1/finance/byok-backup")
	if err != nil {
		t.Fatal(err)
	}
	unauthRes.Body.Close()
	if unauthRes.StatusCode != http.StatusUnauthorized {
		t.Fatalf("esperava 401 sem token, obteve %d", unauthRes.StatusCode)
	}

	// Registrar usuário para obter JWT
	regBody, _ := json.Marshal(map[string]string{
		"name":     "Finance User",
		"email":    "fin-byok@vito.test",
		"password": "senhaSegura123",
	})
	regRes, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(regBody))
	if err != nil {
		t.Fatal(err)
	}
	defer regRes.Body.Close()
	if regRes.StatusCode != http.StatusCreated {
		t.Fatalf("esperava 201 no registro, obteve %d", regRes.StatusCode)
	}
	var regOut struct {
		Token string `json:"token"`
	}
	_ = json.NewDecoder(regRes.Body).Decode(&regOut)

	// 2. Rotas legadas removidas -> 404
	legacyReqs := []struct{ method, path string }{
		{"POST", "/api/v1/finance/connect-token"},
		{"GET", "/api/v1/finance/session-token"},
		{"GET", "/api/v1/finance/test-token"},
	}
	for _, lr := range legacyReqs {
		req, _ := http.NewRequest(lr.method, ts.URL+lr.path, nil)
		req.Header.Set("Authorization", "Bearer "+regOut.Token)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusNotFound {
			t.Errorf("rota legada %s %s deveria retornar 404, obteve %d", lr.method, lr.path, resp.StatusCode)
		}
	}

	// 3. PUT / GET / DELETE /api/v1/finance/byok-backup
	cipherB64 := base64.StdEncoding.EncodeToString([]byte("encrypted-keys"))
	nonceB64 := base64.StdEncoding.EncodeToString([]byte("123456789012"))
	putJSON, _ := json.Marshal(map[string]any{
		"ciphertext":  cipherB64,
		"nonce":       nonceB64,
		"key_version": 1,
	})
	putReq, _ := http.NewRequest("PUT", ts.URL+"/api/v1/finance/byok-backup", bytes.NewReader(putJSON))
	putReq.Header.Set("Authorization", "Bearer "+regOut.Token)
	putReq.Header.Set("Content-Type", "application/json")
	putResp, err := http.DefaultClient.Do(putReq)
	if err != nil {
		t.Fatal(err)
	}
	putResp.Body.Close()
	if putResp.StatusCode != http.StatusOK {
		t.Fatalf("esperava 200 no PUT byok-backup, obteve %d", putResp.StatusCode)
	}

	getReq, _ := http.NewRequest("GET", ts.URL+"/api/v1/finance/byok-backup", nil)
	getReq.Header.Set("Authorization", "Bearer "+regOut.Token)
	getResp, err := http.DefaultClient.Do(getReq)
	if err != nil {
		t.Fatal(err)
	}
	defer getResp.Body.Close()
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("esperava 200 no GET byok-backup, obteve %d", getResp.StatusCode)
	}

	delReq, _ := http.NewRequest("DELETE", ts.URL+"/api/v1/finance/byok-backup", nil)
	delReq.Header.Set("Authorization", "Bearer "+regOut.Token)
	delResp, err := http.DefaultClient.Do(delReq)
	if err != nil {
		t.Fatal(err)
	}
	delResp.Body.Close()
	if delResp.StatusCode != http.StatusNoContent {
		t.Fatalf("esperava 204 no DELETE byok-backup, obteve %d", delResp.StatusCode)
	}
}
