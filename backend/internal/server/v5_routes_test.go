package server_test

import (
	"bytes"
	"context"
	"encoding/json"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupV5HTTPServer(t *testing.T) (*httptest.Server, string, string, *repository.NotificationsInboxRepositorySQLite) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "v5_http.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	q := database.NewSingleWriterQueue(64)
	database.SetDefaultWriterQueue(q)
	t.Cleanup(func() {
		q.Close()
		database.SetDefaultWriterQueue(nil)
	})

	userRepo := repository.NewUserRepository(db)
	authSvc := service.NewAuthService(userRepo, "v5-test-secret")
	now := time.Now().UTC()

	alice := &domain.User{ID: "u-alice", Name: "Alice", Email: "alice@v5.test", PasswordHash: "h1", TokenVersion: 1, CreatedAt: now, UpdatedAt: now}
	bob := &domain.User{ID: "u-bob", Name: "Bob", Email: "bob@v5.test", PasswordHash: "h2", TokenVersion: 1, CreatedAt: now, UpdatedAt: now}
	_ = userRepo.Create(alice)
	_ = userRepo.Create(bob)

	alicePair, err := authSvc.IssueSessionForUser(alice, "test", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	bobPair, err := authSvc.IssueSessionForUser(bob, "test", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}

	inboxRepo := repository.NewNotificationsInboxRepository(db)
	budgetSvc := service.NewAttentionBudgetService(db, calendar.NewEventRepository(db))
	inboxSvc := service.NewNotificationsInboxService(inboxRepo)
	inboxSvc.SetAttentionBudget(budgetSvc)
	inboxSvc.SetTodoRepository(tasks.NewTodoRepository(db))

	storeRepo := repository.NewStoreComplianceRepository(db)
	storeSvc := service.NewStoreComplianceService(storeRepo)

	srv := server.New(server.Config{
		AuthSvc:                authSvc,
		NotifHandler:           handler.NewNotificationHandler(service.NewNotificationService(repository.NewDeviceTokenRepository(db))),
		NotifInboxHandler:      handler.NewNotificationsInboxHandler(inboxSvc),
		StoreComplianceHandler: handler.NewStoreComplianceHandler(storeSvc),
	})
	ts := httptest.NewServer(srv.Router())
	t.Cleanup(ts.Close)
	return ts, alicePair.AccessToken, bobPair.AccessToken, inboxRepo
}

func doAuthReq(t *testing.T, method, url, token string, body any) *http.Response {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req, err := http.NewRequest(method, url, &buf)
	if err != nil {
		t.Fatal(err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestV5Endpoints_AuthRequiredAndEndToEnd(t *testing.T) {
	ts, aliceTok, bobTok, inboxRepo := setupV5HTTPServer(t)

	// 1. Todas as rotas novas exigem autenticação (401 sem token).
	unauthPaths := [][2]string{
		{http.MethodGet, "/api/v1/notifications"},
		{http.MethodPost, "/api/v1/notifications/read-all"},
		{http.MethodGet, "/api/v1/notifications/preferences"},
		{http.MethodPut, "/api/v1/notifications/preferences"},
		{http.MethodGet, "/api/v1/billing/subscription"},
		{http.MethodPost, "/api/v1/billing/subscription"},
		{http.MethodPost, "/api/v1/billing/restore"},
		{http.MethodGet, "/api/v1/privacy/settings"},
		{http.MethodPut, "/api/v1/privacy/settings"},
		{http.MethodPost, "/api/v1/account/export"},
		{http.MethodPost, "/api/v1/account/delete"},
		{http.MethodPost, "/api/v1/support/contact"},
		{http.MethodPost, "/api/v1/ai/report"},
	}
	for _, p := range unauthPaths {
		resp := doAuthReq(t, p[0], ts.URL+p[1], "", nil)
		resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("%s %s sem token deveria retornar 401, obteve %d", p[0], p[1], resp.StatusCode)
		}
	}

	// 2. Cria notificação para Alice; Bob não pode vê-la nem agir nela.
	_ = inboxRepo.Create(context.Background(), &domain.UserNotification{
		ID: "nt-alice", UserID: "u-alice", GroupKey: "Hoje", Type: domain.NotificationTypeAlert,
		SourceDomain: "financas", SourceID: "card-1", Title: "Fatura fechando", Body: "R$ 500",
		Actions: []domain.NotificationAction{{ID: "view_cards", Label: "Ver cartões", Style: "primary"}}, IsUnread: true,
	})

	respBobAct := doAuthReq(t, http.MethodPost, ts.URL+"/api/v1/notifications/nt-alice/action", bobTok, map[string]string{"action": "read"})
	respBobAct.Body.Close()
	if respBobAct.StatusCode != http.StatusNotFound {
		t.Fatalf("Bob agindo em notificação de Alice deveria retornar 404, obteve %d", respBobAct.StatusCode)
	}

	// Alice lista, executa read-all e atualiza preferências.
	respList := doAuthReq(t, http.MethodGet, ts.URL+"/api/v1/notifications", aliceTok, nil)
	defer respList.Body.Close()
	if respList.StatusCode != http.StatusOK {
		t.Fatalf("GET /notifications obteve %d", respList.StatusCode)
	}
	var listPayload struct {
		Notifications []domain.UserNotification `json:"notifications"`
		UnreadCount   int                       `json:"unread_count"`
	}
	if err := json.NewDecoder(respList.Body).Decode(&listPayload); err != nil {
		t.Fatal(err)
	}
	if len(listPayload.Notifications) != 1 || listPayload.UnreadCount != 1 {
		t.Fatalf("esperava 1 notificação não lida, obteve %+v", listPayload)
	}

	respReadAll := doAuthReq(t, http.MethodPost, ts.URL+"/api/v1/notifications/read-all", aliceTok, nil)
	respReadAll.Body.Close()
	if respReadAll.StatusCode != http.StatusOK {
		t.Fatalf("POST /notifications/read-all obteve %d", respReadAll.StatusCode)
	}

	respPrefs := doAuthReq(t, http.MethodPut, ts.URL+"/api/v1/notifications/preferences", aliceTok, map[string]bool{"promo": true, "bots": false})
	respPrefs.Body.Close()
	if respPrefs.StatusCode != http.StatusOK {
		t.Fatalf("PUT /notifications/preferences obteve %d", respPrefs.StatusCode)
	}

	// 3. Billing, Privacy, LGPD Export, Delete (422 -> 200), Support e AI Report.
	respSub := doAuthReq(t, http.MethodPost, ts.URL+"/api/v1/billing/subscription", aliceTok, map[string]any{
		"plan": "pro", "billing_cycle": "year", "start_trial": true,
	})
	respSub.Body.Close()
	if respSub.StatusCode != http.StatusOK {
		t.Fatalf("POST /billing/subscription obteve %d", respSub.StatusCode)
	}

	respRestore := doAuthReq(t, http.MethodPost, ts.URL+"/api/v1/billing/restore", aliceTok, map[string]string{})
	defer respRestore.Body.Close()
	var restoreOut map[string]any
	_ = json.NewDecoder(respRestore.Body).Decode(&restoreOut)
	if respRestore.StatusCode != http.StatusOK || restoreOut["restored"] != true {
		t.Fatalf("POST /billing/restore inesperado: status=%d body=%+v", respRestore.StatusCode, restoreOut)
	}

	respPriv := doAuthReq(t, http.MethodPut, ts.URL+"/api/v1/privacy/settings", aliceTok, map[string]any{"analytics_enabled": false})
	respPriv.Body.Close()
	if respPriv.StatusCode != http.StatusOK {
		t.Fatalf("PUT /privacy/settings obteve %d", respPriv.StatusCode)
	}

	respExport := doAuthReq(t, http.MethodPost, ts.URL+"/api/v1/account/export", aliceTok, nil)
	respExport.Body.Close()
	if respExport.StatusCode != http.StatusOK {
		t.Fatalf("POST /account/export obteve %d", respExport.StatusCode)
	}

	respDelBad := doAuthReq(t, http.MethodPost, ts.URL+"/api/v1/account/delete", aliceTok, map[string]string{"confirmation": "NOPE"})
	respDelBad.Body.Close()
	if respDelBad.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("POST /account/delete confirmação inválida deveria retornar 422, obteve %d", respDelBad.StatusCode)
	}

	respDelOK := doAuthReq(t, http.MethodPost, ts.URL+"/api/v1/account/delete", aliceTok, map[string]string{"confirmation": "EXCLUIR"})
	respDelOK.Body.Close()
	if respDelOK.StatusCode != http.StatusOK {
		t.Fatalf("POST /account/delete válido obteve %d", respDelOK.StatusCode)
	}

	respSupport := doAuthReq(t, http.MethodPost, ts.URL+"/api/v1/support/contact", aliceTok, map[string]string{
		"subject": "Dúvida", "message": "Preciso de ajuda com sincronização",
	})
	respSupport.Body.Close()
	if respSupport.StatusCode != http.StatusCreated {
		t.Fatalf("POST /support/contact obteve %d", respSupport.StatusCode)
	}

	respReport := doAuthReq(t, http.MethodPost, ts.URL+"/api/v1/ai/report", aliceTok, map[string]string{
		"thread_id": "th-123", "reason": "Informação incorreta",
	})
	respReport.Body.Close()
	if respReport.StatusCode != http.StatusCreated {
		t.Fatalf("POST /ai/report obteve %d", respReport.StatusCode)
	}
}
