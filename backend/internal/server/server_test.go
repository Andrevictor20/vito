package server_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
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
