package server_test

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/andrevmp/vito/backend/internal/catalog"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestServer_TriggersDeprecationHeaderAndBotsRoutes(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "server_bots.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	botRepo := repository.NewBotRepository(db)
	cat, err := catalog.LoadDefaultCatalog()
	if err != nil {
		t.Fatalf("LoadDefaultCatalog: %v", err)
	}

	authSvc := service.NewAuthService(userRepo, "bots-route-secret")
	trigH := handler.NewTriggerHandler(service.NewTriggerService(triggerRepo), nil)
	botH := handler.NewBotHandler(db, botRepo, cat)

	srv := server.New(server.Config{
		AuthSvc:        authSvc,
		TriggerHandler: trigH,
		BotHandler:     botH,
	})
	ts := httptest.NewServer(srv.Router())
	t.Cleanup(func() { ts.Close() })

	// /api/v1/triggers/* deve retornar header Deprecation: true
	resp, err := http.Get(ts.URL + "/api/v1/triggers/templates")
	if err != nil {
		t.Fatalf("GET /triggers/templates: %v", err)
	}
	resp.Body.Close()
	if got := resp.Header.Get("Deprecation"); got != "true" {
		t.Fatalf("esperava header Deprecation: true em /api/v1/triggers/*, obteve %q", got)
	}

	// /api/v1/bots/* protegido por JWT (401 sem token)
	unauth, err := http.Get(ts.URL + "/api/v1/bots")
	if err != nil {
		t.Fatalf("GET /bots: %v", err)
	}
	unauth.Body.Close()
	if unauth.StatusCode != http.StatusUnauthorized {
		t.Fatalf("esperava 401 sem JWT em /api/v1/bots, obteve %d", unauth.StatusCode)
	}
}
