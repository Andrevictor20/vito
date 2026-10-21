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

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockEvolutionAPIClientForHandler struct {
	pairingCode string
}

func (m *mockEvolutionAPIClientForHandler) CreateInstance(ctx context.Context, instanceName, phone string) error {
	return nil
}
func (m *mockEvolutionAPIClientForHandler) SetWebhook(ctx context.Context, instanceName, webhookURL string) error {
	return nil
}
func (m *mockEvolutionAPIClientForHandler) SetSettings(ctx context.Context, instanceName string, settings map[string]interface{}) error {
	return nil
}
func (m *mockEvolutionAPIClientForHandler) GetPairingCode(ctx context.Context, instanceName, phone string) (string, error) {
	return m.pairingCode, nil
}
func (m *mockEvolutionAPIClientForHandler) GetConnectionState(ctx context.Context, instanceName string) (string, error) {
	return "close", nil
}
func (m *mockEvolutionAPIClientForHandler) DeleteInstance(ctx context.Context, instanceName string) error {
	return nil
}
func (m *mockEvolutionAPIClientForHandler) Logout(ctx context.Context, instanceName string) error {
	return nil
}
func (m *mockEvolutionAPIClientForHandler) SendText(ctx context.Context, instanceName, to, text string) error {
	return nil
}
func (m *mockEvolutionAPIClientForHandler) SendTextWithQuoted(ctx context.Context, instanceName, to, text, quotedID string) error {
	return nil
}
func (m *mockEvolutionAPIClientForHandler) GetMediaBase64(ctx context.Context, instanceName string, messagePayload interface{}) (string, error) {
	return "", nil
}
func (m *mockEvolutionAPIClientForHandler) FindContacts(ctx context.Context, instanceName string) ([]service.WhatsAppContact, error) {
	return nil, nil
}
func (m *mockEvolutionAPIClientForHandler) SendReaction(ctx context.Context, instanceName, remoteJid, messageID, reaction string) error {
	return nil
}

type mockHandlerAIGateway struct{}

func (m *mockHandlerAIGateway) ParseIntent(ctx context.Context, input ai.UserInput) (*ai.ParsedIntent, error) {
	return &ai.ParsedIntent{
		Action:  ai.ActionGeneralChat,
		Message: "Olá!",
	}, nil
}

func setupWhatsAppHandlerTest(t *testing.T) (*handler.WhatsAppHandler, *repository.WhatsAppRepositorySQLite) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "test_wa_handler.db"))
	if err != nil {
		t.Fatalf("falha ao abrir test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	_ = userRepo.Create(&domain.User{
		ID:        "user-h-1",
		Name:      "User Handler",
		Email:     "handler@example.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	})

	waRepo := repository.NewWhatsAppRepository(db)
	mockClient := &mockEvolutionAPIClientForHandler{
		pairingCode: "5678-ABCD",
	}

	astSvc := service.NewAssistantService(&mockHandlerAIGateway{}, nil, nil, nil)
	waSvc := service.NewWhatsAppService(service.WhatsAppServiceConfig{
		WebhookBaseURL: "http://localhost:8180",
	}, waRepo, mockClient, astSvc)

	return handler.NewWhatsAppHandler(waSvc), waRepo
}

func TestWhatsAppHandler_RequestPairingCode_Unauthorized(t *testing.T) {
	h, _ := setupWhatsAppHandlerTest(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/whatsapp/pairing-code", stringsReader(`{"phone":"11988887777"}`))
	rec := httptest.NewRecorder()

	h.RequestPairingCode(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("esperava 401 Unauthorized, obteve %d", rec.Code)
	}
}

func TestWhatsAppHandler_RequestPairingCode_Success(t *testing.T) {
	h, _ := setupWhatsAppHandlerTest(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/whatsapp/pairing-code", stringsReader(`{"phone":"(11) 98888-7777"}`))
	ctx := context.WithValue(req.Context(), middleware.UserIDKey, "user-h-1")
	req = req.WithContext(ctx)
	rec := httptest.NewRecorder()

	h.RequestPairingCode(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK, obteve %d: %s", rec.Code, rec.Body.String())
	}

	var res map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if res["pairing_code"] != "5678-ABCD" {
		t.Errorf("pairing_code incorreto: %v", res["pairing_code"])
	}
}

func TestWhatsAppHandler_GetStatus_Success(t *testing.T) {
	h, waRepo := setupWhatsAppHandlerTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-h-1",
		UserID:       "user-h-1",
		InstanceName: "vito_user_h_1",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnecting,
		PairingCode:  "5678-ABCD",
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/whatsapp/status", nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-h-1"))
	rec := httptest.NewRecorder()

	h.GetStatus(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK, obteve %d", rec.Code)
	}

	var res map[string]interface{}
	_ = json.Unmarshal(rec.Body.Bytes(), &res)
	if res["status"] != domain.WhatsAppStatusConnecting {
		t.Errorf("status inesperado: %v", res["status"])
	}
}

func TestWhatsAppHandler_Disconnect_Success(t *testing.T) {
	h, waRepo := setupWhatsAppHandlerTest(t)
	ctx := context.Background()

	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "wa-h-1",
		UserID:       "user-h-1",
		InstanceName: "vito_user_h_1",
		Phone:        "5511988887777",
		Status:       domain.WhatsAppStatusConnected,
	})

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/integrations/whatsapp/disconnect", nil)
	req = req.WithContext(context.WithValue(req.Context(), middleware.UserIDKey, "user-h-1"))
	rec := httptest.NewRecorder()

	h.Disconnect(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK, obteve %d", rec.Code)
	}

	saved, _ := waRepo.GetByUserID(ctx, "user-h-1")
	if saved.Status != domain.WhatsAppStatusDisconnected {
		t.Errorf("status deveria ser disconnected, obteve %s", saved.Status)
	}
}

func TestWhatsAppHandler_Webhook_PublicEndpoint(t *testing.T) {
	h, _ := setupWhatsAppHandlerTest(t)

	body := []byte(`{"event":"connection.update","instance":"vito_user_h_1","data":{"state":"open"}}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/integrations/whatsapp/webhook", bytes.NewReader(body))
	rec := httptest.NewRecorder()

	h.Webhook(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK no webhook, obteve %d", rec.Code)
	}
}

func TestWhatsAppHandler_GetContacts(t *testing.T) {
	h, _ := setupWhatsAppHandlerTest(t)

	// Sem autenticação -> 401
	unauthReq := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/whatsapp/contacts", nil)
	unauthRec := httptest.NewRecorder()
	h.GetContacts(unauthRec, unauthReq)
	if unauthRec.Code != http.StatusUnauthorized {
		t.Errorf("esperava 401 Unauthorized, obteve %d", unauthRec.Code)
	}

	// Com autenticação -> 200 OK
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, "user-h-1")
	req := httptest.NewRequest(http.MethodGet, "/api/v1/integrations/whatsapp/contacts", nil).WithContext(ctx)
	rec := httptest.NewRecorder()
	h.GetContacts(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK, obteve %d", rec.Code)
	}

	var res struct {
		Contacts []domain.ContactMatchResult `json:"contacts"`
		Count    int                         `json:"count"`
	}
	if err := json.NewDecoder(rec.Body).Decode(&res); err != nil {
		t.Fatalf("falha ao deserializar resposta: %v", err)
	}
	if res.Contacts == nil {
		t.Errorf("contacts array não deveria ser nulo")
	}
}

func stringsReader(s string) *bytes.Reader {
	return bytes.NewReader([]byte(s))
}

func (m *mockEvolutionAPIClientForHandler) FindMessages(ctx context.Context, in service.EvolutionFindMessagesInput) ([]service.WhatsAppChatMessage, error) {
	return nil, nil
}

func (m *mockEvolutionAPIClientForHandler) FindGroups(ctx context.Context, instanceName string) ([]service.WhatsAppGroup, error) {
	return nil, nil
}

func (m *mockEvolutionAPIClientForHandler) FindParticipants(ctx context.Context, instanceName, groupJid string) ([]string, error) {
	return nil, nil
}
