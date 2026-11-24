package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type rtRoundTripper func(*http.Request) (*http.Response, error)

func (f rtRoundTripper) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func setupAIProviderHandlerTest(t *testing.T, verifyStatus int) (*chi.Mux, string, string, string) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "ai_handler.db"))
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	userID := "u-ai-handler-1"
	now := time.Now().UTC()
	_ = userRepo.Create(&domain.User{ID: userID, Name: "Handler User", Email: "aih@vito.test", CreatedAt: now, UpdatedAt: now})

	aiProvRepo := repository.NewAIProviderRepository(db)
	aiSettingsRepo := repository.NewAISettingsRepository(db)
	convRepo := repository.NewConversationStoreRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	chatRepo := repository.NewChatRepository(db)

	vault := service.NewAIKeyVault("0123456789abcdef0123456789abcdef")
	registry := service.NewUserProviderRegistry(vault, adkengine.NewADKLLMFactory(), aiProvRepo, 0)
	svc := service.NewAIProviderService(aiProvRepo, aiSettingsRepo, convRepo, triggerRepo, vault, registry, 0)
	svc.SetVerifyHTTPClientForTest(&http.Client{
		Transport: rtRoundTripper(func(r *http.Request) (*http.Response, error) {
			rec := httptest.NewRecorder()
			rec.Header().Set("Content-Type", "application/json")
			rec.WriteHeader(verifyStatus)
			if verifyStatus == http.StatusOK {
				_, _ = fmt.Fprint(rec, `{"data":[{"id":"claude-sonnet-4-20250514","display_name":"Claude Sonnet 4"}]}`)
			} else {
				_, _ = fmt.Fprint(rec, `{"error":"invalid_api_key"}`)
			}
			return rec.Result(), nil
		}),
	})

	th, err := convRepo.GetOrCreateThread(context.Background(), userID, "app_mobile", "th-h-1")
	if err != nil {
		t.Fatalf("GetOrCreateThread: %v", err)
	}
	_ = triggerRepo.Create(&domain.Trigger{
		ID: "bot-h-1", UserID: userID, Title: "Bot Handler", Category: domain.CategoryCustom,
		Query: "check", ConditionType: domain.ConditionChangeDetected, Status: domain.TriggerStatusActive,
		Frequency: domain.FrequencyDailyMorning, CreatedAt: now, UpdatedAt: now,
	})

	aiH := handler.NewAIProviderHandler(svc)
	chatH := handler.NewChatHandler(service.NewChatService(chatRepo))
	chatH.SetAIProviderService(svc)
	botH := handler.NewBotHandler(db, repository.NewBotRepository(db), nil)
	botH.SetAIProviderService(svc)

	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			next.ServeHTTP(w, req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, userID)))
		})
	})
	r.Get("/api/v1/ai/providers", aiH.ListProviders)
	r.Put("/api/v1/ai/providers/{key}", aiH.ConnectProvider)
	r.Post("/api/v1/ai/providers/{key}/test", aiH.TestProvider)
	r.Delete("/api/v1/ai/providers/{key}", aiH.RemoveProvider)
	r.Get("/api/v1/ai/providers/{key}/models", aiH.GetProviderModels)
	r.Get("/api/v1/ai/models", aiH.ListSelectableModels)
	r.Get("/api/v1/ai/preferences", aiH.GetPreferences)
	r.Put("/api/v1/ai/preferences", aiH.UpdatePreferences)
	r.Patch("/api/v1/threads/{id}/model", chatH.UpdateThreadModelPref)
	r.Patch("/api/v1/bots/{id}/model", botH.UpdateBotModelPref)

	return r, userID, th.ID, "bot-h-1"
}

func TestAIProviderHandler_FullCRUDAndNoKeyExposure_AI02(t *testing.T) {
	r, _, threadID, botID := setupAIProviderHandlerTest(t, http.StatusOK)
	rawKey := "sk-ant-api03-never-leak-this-secret-8899"

	doReq := func(method, path string, body any) *httptest.ResponseRecorder {
		var buf bytes.Buffer
		if body != nil {
			_ = json.NewEncoder(&buf).Encode(body)
		}
		req := httptest.NewRequest(method, path, &buf)
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		return rec
	}

	// PUT /providers/anthropic (AI-02: nunca devolve chave inteira)
	rec := doReq(http.MethodPut, "/api/v1/ai/providers/anthropic", map[string]string{"api_key": rawKey})
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT provider = %d: %s", rec.Code, rec.Body.String())
	}
	if strings.Contains(rec.Body.String(), rawKey) || !strings.Contains(rec.Body.String(), `"8899"`) {
		t.Fatalf("AI-02 violado: body=%s", rec.Body.String())
	}

	// GET /providers, /models, /providers/anthropic/models, POST /test
	for _, tc := range []struct {
		m, p string
	}{
		{http.MethodGet, "/api/v1/ai/providers"},
		{http.MethodGet, "/api/v1/ai/models"},
		{http.MethodGet, "/api/v1/ai/providers/anthropic/models?refresh=1"},
		{http.MethodPost, "/api/v1/ai/providers/anthropic/test"},
	} {
		resp := doReq(tc.m, tc.p, nil)
		if resp.Code != http.StatusOK {
			t.Fatalf("%s %s = %d: %s", tc.m, tc.p, resp.Code, resp.Body.String())
		}
		if strings.Contains(resp.Body.String(), rawKey) {
			t.Fatalf("AI-02 vazou chave em %s %s", tc.m, tc.p)
		}
	}

	// Preferences + Thread + Bot PATCH
	if resp := doReq(http.MethodPut, "/api/v1/ai/preferences", map[string]string{
		"default_model": "anthropic:claude-sonnet-4-20250514", "default_effort": "high",
	}); resp.Code != http.StatusOK {
		t.Fatalf("PUT preferences = %d: %s", resp.Code, resp.Body.String())
	}
	if resp := doReq(http.MethodGet, "/api/v1/ai/preferences", nil); resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), "claude-sonnet-4-20250514") {
		t.Fatalf("GET preferences = %d: %s", resp.Code, resp.Body.String())
	}
	if resp := doReq(http.MethodPatch, "/api/v1/threads/"+threadID+"/model", map[string]string{
		"model_pref": "anthropic:claude-sonnet-4-20250514", "effort_pref": "low",
	}); resp.Code != http.StatusOK {
		t.Fatalf("PATCH thread = %d: %s", resp.Code, resp.Body.String())
	}
	if resp := doReq(http.MethodPatch, "/api/v1/bots/"+botID+"/model", map[string]string{
		"model_pref": "srv:auto", "effort_pref": "auto",
	}); resp.Code != http.StatusOK {
		t.Fatalf("PATCH bot = %d: %s", resp.Code, resp.Body.String())
	}

	// DELETE /providers/anthropic
	if resp := doReq(http.MethodDelete, "/api/v1/ai/providers/anthropic", nil); resp.Code != http.StatusOK || !strings.Contains(resp.Body.String(), `"removed"`) {
		t.Fatalf("DELETE provider = %d: %s", resp.Code, resp.Body.String())
	}
}

func TestAIProviderHandler_RateLimit429(t *testing.T) {
	r, _, _, _ := setupAIProviderHandlerTest(t, http.StatusUnauthorized)
	for i := 0; i < 5; i++ {
		req := httptest.NewRequest(http.MethodPut, "/api/v1/ai/providers/anthropic", strings.NewReader(`{"api_key":"sk-ant-invalidkey123456"}`))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		r.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("tentativa %d esperava 400, obteve %d", i+1, rec.Code)
		}
	}
	req6 := httptest.NewRequest(http.MethodPut, "/api/v1/ai/providers/anthropic", strings.NewReader(`{"api_key":"sk-ant-invalidkey123456"}`))
	req6.Header.Set("Content-Type", "application/json")
	rec6 := httptest.NewRecorder()
	r.ServeHTTP(rec6, req6)
	if rec6.Code != http.StatusTooManyRequests {
		t.Fatalf("6ª tentativa esperava HTTP 429, obteve %d (%s)", rec6.Code, rec6.Body.String())
	}
}
