package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/bots"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
)

type serverRoundTripper func(*http.Request) (*http.Response, error)

func (f serverRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestServer_AIRoutesIntegration(t *testing.T) {
	db, err := database.Open(filepath.Join(t.TempDir(), "server_ai_routes.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	aiProvRepo := repository.NewAIProviderRepository(db)
	aiSettingsRepo := repository.NewAISettingsRepository(db)
	convRepo := repository.NewConversationStoreRepository(db)
	triggerRepo := bots.NewTriggerRepository(db)
	chatRepo := repository.NewChatRepository(db)

	authSvc := service.NewAuthService(userRepo, "server-ai-jwt-secret")
	vault := service.NewAIKeyVault("0123456789abcdef0123456789abcdef")
	registry := service.NewUserProviderRegistry(vault, adkengine.NewADKLLMFactory(), aiProvRepo, 0)
	aiProvSvc := service.NewAIProviderService(aiProvRepo, aiSettingsRepo, convRepo, triggerRepo, vault, registry, 0)
	aiProvSvc.SetVerifyHTTPClientForTest(&http.Client{
		Transport: serverRoundTripper(func(r *http.Request) (*http.Response, error) {
			rec := httptest.NewRecorder()
			rec.Header().Set("Content-Type", "application/json")
			rec.WriteHeader(http.StatusOK)
			_, _ = fmt.Fprint(rec, `{"data":[{"id":"gpt-4o","object":"model"}]}`)
			return rec.Result(), nil
		}),
	})

	authH := handler.NewAuthHandler(authSvc, userRepo)
	aiH := handler.NewAIProviderHandler(aiProvSvc)
	chatH := handler.NewChatHandler(service.NewChatService(chatRepo))
	chatH.SetAIProviderService(aiProvSvc)
	botH := bots.NewBotHandler(db, bots.NewBotRepository(db), nil)
	botH.SetAIProviderService(aiProvSvc)

	srv := server.New(server.Config{
		AuthHandler:       authH,
		AIProviderHandler: aiH,
		ChatHandler:       chatH,
		BotHandler:        botH,
		AuthSvc:           authSvc,
	})
	ts := httptest.NewServer(srv.Router())
	t.Cleanup(func() { ts.Close() })

	// 401 sem JWT
	unauthResp, err := http.Get(ts.URL + "/api/v1/ai/providers")
	if err != nil {
		t.Fatalf("GET unauth: %v", err)
	}
	unauthResp.Body.Close()
	if unauthResp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("esperava 401 sem JWT, obteve %d", unauthResp.StatusCode)
	}

	// Registra usuário e obtém JWT
	regBody, _ := json.Marshal(map[string]string{"name": "Server AI", "email": "srvai@vito.test", "password": "Password123!"})
	regResp, err := http.Post(ts.URL+"/api/v1/auth/register", "application/json", bytes.NewReader(regBody))
	if err != nil {
		t.Fatalf("register: %v", err)
	}
	var regOut struct {
		Token string      `json:"token"`
		User  domain.User `json:"user"`
	}
	_ = json.NewDecoder(regResp.Body).Decode(&regOut)
	regResp.Body.Close()
	if regOut.Token == "" || regOut.User.ID == "" {
		t.Fatalf("token/user vazios no register: %+v", regOut)
	}

	now := time.Now().UTC()
	th, _ := convRepo.GetOrCreateThread(context.Background(), regOut.User.ID, "app_mobile", "srv-th-1")
	_ = triggerRepo.Create(&domain.Trigger{
		ID: "srv-bot-1", UserID: regOut.User.ID, Title: "Bot Srv", Category: domain.CategoryCustom,
		Query: "q", ConditionType: domain.ConditionChangeDetected, Status: domain.TriggerStatusActive,
		Frequency: domain.FrequencyDailyMorning, CreatedAt: now, UpdatedAt: now,
	})

	callAuth := func(method, path, body string) int {
		req, _ := http.NewRequest(method, ts.URL+path, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+regOut.Token)
		req.Header.Set("Content-Type", "application/json")
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("%s %s err: %v", method, path, err)
		}
		resp.Body.Close()
		return resp.StatusCode
	}

	if code := callAuth(http.MethodPut, "/api/v1/ai/providers/openai", `{"api_key":"sk-proj-serverroute123456789"}`); code != http.StatusOK {
		t.Fatalf("PUT provider = %d", code)
	}
	for _, tc := range []struct{ m, p, b string }{
		{http.MethodGet, "/api/v1/ai/providers", ""},
		{http.MethodPost, "/api/v1/ai/providers/openai/test", ""},
		{http.MethodGet, "/api/v1/ai/providers/openai/models", ""},
		{http.MethodGet, "/api/v1/ai/models", ""},
		{http.MethodPut, "/api/v1/ai/preferences", `{"default_model":"openai:gpt-4o","default_effort":"med"}`},
		{http.MethodGet, "/api/v1/ai/preferences", ""},
		{http.MethodPatch, "/api/v1/threads/" + th.ID + "/model", `{"model_pref":"openai:gpt-4o","effort_pref":"low"}`},
		{http.MethodPatch, "/api/v1/bots/srv-bot-1/model", `{"model_pref":"srv:auto","effort_pref":"auto"}`},
		{http.MethodDelete, "/api/v1/ai/providers/openai", ""},
	} {
		if code := callAuth(tc.m, tc.p, tc.b); code != http.StatusOK {
			t.Fatalf("%s %s = %d, want 200", tc.m, tc.p, code)
		}
	}
}
