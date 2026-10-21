package handler_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupWhatsAppContextHandlerTest(t *testing.T) (*handler.WhatsAppHandler, *service.WhatsAppContextService, *repository.WhatsAppConversationRepositorySQLite) {
	t.Helper()

	db, err := database.Open(filepath.Join(t.TempDir(), "handler_context.db"))
	if err != nil {
		t.Fatalf("erro ao abrir banco: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	phone := "5511999998888"
	if err := userRepo.Create(&domain.User{
		ID:        "user-hc-1",
		Email:     "hc@vito.local",
		Name:      "Contexto",
		Phone:     &phone,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("erro ao criar usuário: %v", err)
	}

	waRepo := repository.NewWhatsAppRepository(db)
	mockClient := &mockEvolutionAPIClientForHandler{}
	astSvc := service.NewAssistantService(&mockHandlerAIGateway{}, nil, nil, nil)
	waSvc := service.NewWhatsAppService(service.WhatsAppServiceConfig{
		WebhookBaseURL: "http://localhost:8180",
	}, waRepo, mockClient, astSvc)

	convRepo := repository.NewWhatsAppConversationRepository(db)
	contextSvc := service.NewWhatsAppContextService(convRepo, service.DefaultWhatsAppContextConfig())

	h := handler.NewWhatsAppHandler(waSvc)
	h.SetContextService(contextSvc)
	return h, contextSvc, convRepo
}

func withUser(req *http.Request, userID string) *http.Request {
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, userID)
	return req.WithContext(ctx)
}

// AC-F11 — GET devolve o escopo e o tamanho da janela.
func TestWhatsAppHandler_GetContextSettings_Success(t *testing.T) {
	h, _, _ := setupWhatsAppContextHandlerTest(t)

	req := withUser(httptest.NewRequest(http.MethodGet, "/api/v1/integrations/whatsapp/context-settings", nil), "user-hc-1")
	rec := httptest.NewRecorder()

	h.GetContextSettings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK, obteve %d: %s", rec.Code, rec.Body.String())
	}
	var res map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if res["scope"] != domain.WhatsAppContextScopeAll {
		t.Errorf("esperava scope %q, obteve %v", domain.WhatsAppContextScopeAll, res["scope"])
	}
	if res["window_size"] != float64(12) {
		t.Errorf("esperava window_size 12, obteve %v", res["window_size"])
	}
}

// AC-F11 — PUT persiste o novo escopo.
func TestWhatsAppHandler_UpdateContextSettings_Success(t *testing.T) {
	h, contextSvc, _ := setupWhatsAppContextHandlerTest(t)

	req := withUser(httptest.NewRequest(http.MethodPut, "/api/v1/integrations/whatsapp/context-settings",
		stringsReader(`{"scope":"chat","window_size":24}`)), "user-hc-1")
	rec := httptest.NewRecorder()

	h.UpdateContextSettings(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK, obteve %d: %s", rec.Code, rec.Body.String())
	}
	stored, err := contextSvc.Settings(context.Background(), "user-hc-1")
	if err != nil {
		t.Fatalf("Settings: %v", err)
	}
	if stored.Scope != domain.WhatsAppContextScopeChat || stored.WindowSize != 24 {
		t.Errorf("preferências não persistidas: %+v", stored)
	}
}

// Scope inválido devolve 400.
func TestWhatsAppHandler_UpdateContextSettings_InvalidScope(t *testing.T) {
	h, _, _ := setupWhatsAppContextHandlerTest(t)

	req := withUser(httptest.NewRequest(http.MethodPut, "/api/v1/integrations/whatsapp/context-settings",
		stringsReader(`{"scope":"invalido","window_size":12}`)), "user-hc-1")
	rec := httptest.NewRecorder()

	h.UpdateContextSettings(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Fatalf("esperava 400 Bad Request, obteve %d", rec.Code)
	}
}

// AC-F12 — DELETE apaga o histórico arquivado.
func TestWhatsAppHandler_PurgeContextMessages_Success(t *testing.T) {
	h, contextSvc, convRepo := setupWhatsAppContextHandlerTest(t)

	if err := contextSvc.Archive(context.Background(), &domain.WhatsAppConversationMessage{
		ID:               "h-msg-1",
		UserID:           "user-hc-1",
		InstanceName:     "vito_user_hc_1",
		ChatJID:          "5511999998888@s.whatsapp.net",
		ChatKind:         domain.WhatsAppChatKindSelf,
		ChatLabel:        "Você",
		SenderName:       "Contexto",
		Text:             "mensagem de teste",
		MessageTimestamp: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("Archive: %v", err)
	}

	req := withUser(httptest.NewRequest(http.MethodDelete, "/api/v1/integrations/whatsapp/context-messages", nil), "user-hc-1")
	rec := httptest.NewRecorder()

	h.PurgeContextMessages(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK, obteve %d: %s", rec.Code, rec.Body.String())
	}

	msgs, err := convRepo.RecentMessagesAcrossChats(context.Background(), "user-hc-1", 50, time.Now().Add(-72*time.Hour))
	if err != nil {
		t.Fatalf("falha ao reler o inbox: %v", err)
	}
	if len(msgs) != 0 {
		t.Fatalf("esperava o inbox vazio após a limpeza, restaram %d mensagens", len(msgs))
	}
}

// Endpoints protegidos exigem autenticação.
func TestWhatsAppHandler_ContextSettings_Unauthorized(t *testing.T) {
	h, _, _ := setupWhatsAppContextHandlerTest(t)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/whatsapp/context-settings", nil)
	rec := httptest.NewRecorder()
	h.GetContextSettings(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("esperava 401 Unauthorized, obteve %d", rec.Code)
	}

	rec = httptest.NewRecorder()
	h.PurgeContextMessages(rec, httptest.NewRequest(http.MethodDelete, "/api/v1/integrations/whatsapp/context-messages", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("esperava 401 Unauthorized, obteve %d", rec.Code)
	}
}
