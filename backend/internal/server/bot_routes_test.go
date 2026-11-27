package server_test

import (
	"github.com/andrevmp/vito/backend/internal/bots"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/andrevmp/vito/backend/internal/bots/catalog"
	"github.com/andrevmp/vito/backend/internal/platform/database"
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
	botRepo := bots.NewBotRepository(db)
	cat, err := catalog.LoadDefaultCatalog()
	if err != nil {
		t.Fatalf("LoadDefaultCatalog: %v", err)
	}

	authSvc := service.NewAuthService(userRepo, "bots-route-secret")
	botH := bots.NewBotHandler(db, botRepo, cat)

	srv := server.New(server.Config{
		AuthSvc:    authSvc,
		BotHandler: botH,
	})
	ts := httptest.NewServer(srv.Router())
	t.Cleanup(func() { ts.Close() })

	// /api/v1/triggers/* deve retornar 404 após a extinção do legado (AC-08)
	resp, err := http.Get(ts.URL + "/api/v1/triggers/templates")
	if err != nil {
		t.Fatalf("GET /triggers/templates: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("esperava 404 em /api/v1/triggers/*, obteve %d", resp.StatusCode)
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
