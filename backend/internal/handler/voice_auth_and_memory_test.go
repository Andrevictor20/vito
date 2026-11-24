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

	"google.golang.org/adk/v2/session"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestAC07_VoiceWSRequiresJWTAndMemoryFactPost(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "ac07.db"))
	if err != nil {
		t.Fatalf("erro ao abrir db: %v", err)
	}
	defer db.Close()

	userRepo := repository.NewUserRepository(db)
	userID := "user-ac07"
	user := &domain.User{
		ID: userID, Name: "AC07", Email: "ac07@vito.local", TokenVersion: 1, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
	_ = userRepo.Create(user)
	authSvc := service.NewAuthService(userRepo, "ac07-secret")
	token, err := authSvc.GenerateTokenForUser(user)
	if err != nil {
		t.Fatalf("GenerateToken falhou: %v", err)
	}

	memRepo := repository.NewMemoryHierarchyRepository(db)
	memHandler := handler.NewMemoryHandler(memRepo)
	voiceHandler := handler.NewVoiceStreamHandler()

	srv := server.New(server.Config{
		AuthSvc:       authSvc,
		VoiceHandler:  voiceHandler,
		MemoryHandler: memHandler,
	})
	ts := httptest.NewServer(srv.Router())
	defer ts.Close()

	// 1. /api/v1/voice/stream sem JWT retorna 401
	res, err := http.Get(ts.URL + "/api/v1/voice/stream")
	if err != nil {
		t.Fatalf("GET /api/v1/voice/stream falhou: %v", err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusUnauthorized {
		t.Fatalf("esperava 401 sem JWT em /api/v1/voice/stream, obteve %d", res.StatusCode)
	}

	// 2. POST /api/v1/memories/facts cria fato com sucesso
	reqBody, _ := json.Marshal(map[string]string{"category": "preference", "content": "Prefere café sem açúcar"})
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/v1/memories/facts", bytes.NewReader(reqBody))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")
	postRes, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST /api/v1/memories/facts falhou: %v", err)
	}
	postRes.Body.Close()
	if postRes.StatusCode != http.StatusCreated {
		t.Fatalf("esperava 201 Created em POST /api/v1/memories/facts, obteve %d", postRes.StatusCode)
	}

	// 3. SQLiteSessionService respeita limite LRU
	sessSvc := adkengine.NewSQLiteSessionService(nil)
	sessSvc.SetCacheLimitsForTest(2, time.Hour)
	ctx := context.Background()
	_, _ = sessSvc.Create(ctx, &session.CreateRequest{AppName: "vito", UserID: userID, SessionID: "s1"})
	_, _ = sessSvc.Create(ctx, &session.CreateRequest{AppName: "vito", UserID: userID, SessionID: "s2"})
	_, _ = sessSvc.Create(ctx, &session.CreateRequest{AppName: "vito", UserID: userID, SessionID: "s3"})
	listResp, _ := sessSvc.List(ctx, &session.ListRequest{AppName: "vito", UserID: userID})
	if len(listResp.Sessions) > 2 {
		t.Fatalf("esperava no máximo 2 sessões no cache LRU, obteve %d", len(listResp.Sessions))
	}
}
