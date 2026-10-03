package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupHandlerTest(t *testing.T) (*chi.Mux, *service.CalendarSyncService, string) {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("falha ao inicializar banco: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userID := uuid.New().String()
	now := time.Now().UTC()
	_, _ = db.Exec("INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
		userID, "User", userID+"@example.com", "hash", now, now)

	eventRepo := repository.NewEventRepository(db)
	syncRepo := repository.NewCalendarSyncRepository(db)
	encKey := "test-secret-key-for-handler-32ch"

	syncSvc := service.NewCalendarSyncService(syncRepo, eventRepo, encKey)
	syncHandler := handler.NewCalendarSyncHandler(syncSvc)

	r := chi.NewRouter()
	// Mock middleware de autenticação injetando userID no context
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
			ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
			next.ServeHTTP(w, req.WithContext(ctx))
		})
	})

	r.Route("/api/v1/integrations/calendars", func(cr chi.Router) {
		cr.Get("/", syncHandler.ListIntegrations)
		cr.Post("/connect", syncHandler.ConnectIntegration)
		cr.Post("/{provider}/sync", syncHandler.SyncIntegration)
		cr.Delete("/{provider}", syncHandler.DisconnectIntegration)
		cr.Post("/google/webhook", syncHandler.GoogleWebhook)
	})

	return r, syncSvc, userID
}

func TestCalendarSyncHandler_ConnectAndList(t *testing.T) {
	router, _, _ := setupHandlerTest(t)

	// 1. Connect Google
	body := map[string]string{
		"provider":      domain.ProviderGoogle,
		"account_email": "andrevictor@gmail.com",
		"credentials":   `{"refresh_token":"tok-abc-123"}`,
		"calendar_id":   "primary",
		"calendar_name": "Agenda Pessoal",
	}
	bodyBytes, _ := json.Marshal(body)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/calendars/connect", bytes.NewReader(bodyBytes))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Fatalf("esperava status 201 Created, obteve %d: %s", rec.Code, rec.Body.String())
	}

	var created domain.CalendarIntegration
	if err := json.NewDecoder(rec.Body).Decode(&created); err != nil {
		t.Fatalf("falha ao decodificar resposta: %v", err)
	}

	if created.AccountEmail != "andrevictor@gmail.com" || created.Provider != domain.ProviderGoogle {
		t.Errorf("dados divergentes: %+v", created)
	}

	// 2. List
	reqList := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/calendars", nil)
	recList := httptest.NewRecorder()

	router.ServeHTTP(recList, reqList)

	if recList.Code != http.StatusOK {
		t.Fatalf("esperava status 200 OK na listagem, obteve %d", recList.Code)
	}

	var list []domain.CalendarIntegration
	if err := json.NewDecoder(recList.Body).Decode(&list); err != nil {
		t.Fatalf("falha ao decodificar listagem: %v", err)
	}

	if len(list) != 1 || list[0].AccountEmail != "andrevictor@gmail.com" {
		t.Fatalf("listagem incorreta: %+v", list)
	}
}

func TestCalendarSyncHandler_Disconnect(t *testing.T) {
	router, syncSvc, userID := setupHandlerTest(t)

	_, _ = syncSvc.ConnectIntegration(context.Background(), userID, domain.ProviderGoogle, "andre@gmail.com", "tok", "primary", "Agenda")

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/integrations/calendars/google", nil)
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK && rec.Code != http.StatusNoContent {
		t.Fatalf("esperava sucesso na desconexão, obteve %d: %s", rec.Code, rec.Body.String())
	}

	list, _ := syncSvc.ListIntegrations(context.Background(), userID)
	if len(list) != 0 {
		t.Fatalf("esperava 0 integrações após desconexão, obteve %d", len(list))
	}
}

func TestCalendarSyncHandler_GoogleWebhook(t *testing.T) {
	router, _, _ := setupHandlerTest(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/calendars/google/webhook", nil)
	req.Header.Set("X-Goog-Resource-State", "sync")
	rec := httptest.NewRecorder()

	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("webhook deveria responder 200 OK, obteve %d", rec.Code)
	}
}
