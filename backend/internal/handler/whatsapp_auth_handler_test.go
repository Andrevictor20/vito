package handler_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"regexp"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockEvolutionClientForAuthHandler struct {
	sentTo          string
	sentText        string
	mockOwnerJID    string
	mockOwnerJIDErr error
}

func (m *mockEvolutionClientForAuthHandler) CreateInstance(ctx context.Context, instanceName, phone string) error {
	return nil
}
func (m *mockEvolutionClientForAuthHandler) SetWebhook(ctx context.Context, instanceName, webhookURL string) error {
	return nil
}
func (m *mockEvolutionClientForAuthHandler) SetSettings(ctx context.Context, instanceName string, settings map[string]interface{}) error {
	return nil
}
func (m *mockEvolutionClientForAuthHandler) GetPairingCode(ctx context.Context, instanceName, phone string) (string, error) {
	return "1234-5678", nil
}
func (m *mockEvolutionClientForAuthHandler) GetConnectionState(ctx context.Context, instanceName string) (string, error) {
	return "open", nil
}
func (m *mockEvolutionClientForAuthHandler) DeleteInstance(ctx context.Context, instanceName string) error {
	return nil
}
func (m *mockEvolutionClientForAuthHandler) Logout(ctx context.Context, instanceName string) error {
	return nil
}
func (m *mockEvolutionClientForAuthHandler) SendText(ctx context.Context, instanceName, to, text string) error {
	m.sentTo = to
	m.sentText = text
	return nil
}
func (m *mockEvolutionClientForAuthHandler) SendTextWithQuoted(ctx context.Context, instanceName, to, text, quotedID string) error {
	m.sentTo = to
	m.sentText = text
	return nil
}
func (m *mockEvolutionClientForAuthHandler) GetMediaBase64(ctx context.Context, instanceName string, messagePayload interface{}) (string, error) {
	return "", nil
}
func (m *mockEvolutionClientForAuthHandler) FindContacts(ctx context.Context, instanceName string) ([]service.WhatsAppContact, error) {
	return nil, nil
}
func (m *mockEvolutionClientForAuthHandler) SendReaction(ctx context.Context, instanceName, remoteJid, messageID, reaction string) error {
	return nil
}

func setupWhatsAppAuthHandlerTest(t *testing.T) (*handler.WhatsAppAuthHandler, *mockEvolutionClientForAuthHandler, domain.UserRepository) {
	tmpDir := t.TempDir()
	db, err := database.Open(filepath.Join(tmpDir, "test_wa_auth_h.db"))
	if err != nil {
		t.Fatalf("falha ao abrir test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	otpRepo := repository.NewWhatsAppAuthRepository(db)
	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	authSvc := service.NewAuthService(userRepo, "test-jwt-secret-session")
	authSvc.SetSessionRepository(sessionRepo)

	evoClient := &mockEvolutionClientForAuthHandler{}
	svc := service.NewWhatsAppAuthService(
		otpRepo,
		userRepo,
		authSvc,
		evoClient,
		"vito_system",
		"test-hmac-secret",
	)

	h := handler.NewWhatsAppAuthHandler(svc)
	return h, evoClient, userRepo
}

// TestWhatsAppAuthHandler_RequestOTP_RefusesUnknownPhone garante que a API recusa números
// sem conta Vito, sem enviar mensagem, e sinaliza ao app que ele deve direcionar o usuário
// para o cadastro (code PHONE_NOT_LINKED / action register).
func TestWhatsAppAuthHandler_RequestOTP_RefusesUnknownPhone(t *testing.T) {
	h, evoClient, _ := setupWhatsAppAuthHandlerTest(t)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/whatsapp/request-otp", bytes.NewBufferString(`{"phone": "11999998888"}`))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.RequestOTP(w, req)

	if w.Code != http.StatusForbidden {
		t.Fatalf("esperava status 403, obteve %d (%s)", w.Code, w.Body.String())
	}
	if evoClient.sentText != "" {
		t.Errorf("nenhuma mensagem deveria ter sido enviada: %q", evoClient.sentText)
	}

	var payload map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &payload); err != nil {
		t.Fatalf("resposta não é JSON válido: %v (%s)", err, w.Body.String())
	}
	if payload["code"] != "PHONE_NOT_LINKED" {
		t.Errorf("esperava code PHONE_NOT_LINKED, obteve %q", payload["code"])
	}
	if payload["action"] != "register" {
		t.Errorf("esperava action register, obteve %q", payload["action"])
	}
	if payload["error"] == "" {
		t.Error("mensagem de erro vazia: o app precisa avisar o usuário")
	}
}

func TestWhatsAppAuthHandler_RequestAndVerify(t *testing.T) {
	h, evoClient, userRepo := setupWhatsAppAuthHandlerTest(t)

	// 0. O número precisa pertencer a uma conta Vito para receber o código.
	linkedPhone := "+5511987654321"
	linkedUser := &domain.User{
		ID:        "user-wa-handler",
		Name:      "André Victor",
		Email:     "andre.handler@test.com",
		Phone:     &linkedPhone,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(linkedUser); err != nil {
		t.Fatalf("falha ao criar usuário vinculado: %v", err)
	}

	// 1. Request OTP com payload válido
	reqBody := `{"phone": "11987654321"}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/whatsapp/request-otp", bytes.NewBufferString(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	h.RequestOTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("esperava status 200, obteve %d (%s)", w.Code, w.Body.String())
	}

	if evoClient.sentTo != "+5511987654321" {
		t.Errorf("destinatário esperado +5511987654321, obteve %s", evoClient.sentTo)
	}

	// Extrai código de 6 dígitos via regex da mensagem enviada
	re := regexp.MustCompile(`\b\d{6}\b`)
	code := re.FindString(evoClient.sentText)
	if code == "" {
		t.Fatalf("código não encontrado na mensagem: %s", evoClient.sentText)
	}

	// 2. Verify OTP com código correto
	verifyBody := map[string]string{
		"phone": "11987654321",
		"code":  code,
	}
	bodyBytes, _ := json.Marshal(verifyBody)
	reqVerify := httptest.NewRequest(http.MethodPost, "/api/v1/auth/whatsapp/verify-otp", bytes.NewBuffer(bodyBytes))
	reqVerify.Header.Set("Content-Type", "application/json")
	reqVerify.Header.Set("User-Agent", "Pixel 8 Pro (Android)")
	wVerify := httptest.NewRecorder()

	h.VerifyOTP(wVerify, reqVerify)

	if wVerify.Code != http.StatusOK {
		t.Fatalf("esperava status 200 no verify, obteve %d (%s)", wVerify.Code, wVerify.Body.String())
	}

	var resp struct {
		Data struct {
			User      domain.User       `json:"user"`
			TokenPair service.TokenPair `json:"token_pair"`
		} `json:"data"`
	}
	if err := json.NewDecoder(wVerify.Body).Decode(&resp); err != nil {
		t.Fatalf("falha ao decodificar resposta: %v", err)
	}

	if resp.Data.TokenPair.AccessToken == "" || resp.Data.TokenPair.RefreshToken == "" {
		t.Error("esperava tokens não vazios")
	}
	if resp.Data.User.Phone == nil || *resp.Data.User.Phone != "+5511987654321" {
		t.Errorf("telefone do usuário inesperado: %v", resp.Data.User.Phone)
	}

	// 3. Verify OTP com código errado -> 401
	verifyBadBody := `{"phone": "11987654321", "code": "000000"}`
	reqBad := httptest.NewRequest(http.MethodPost, "/api/v1/auth/whatsapp/verify-otp", bytes.NewBufferString(verifyBadBody))
	reqBad.Header.Set("Content-Type", "application/json")
	wBad := httptest.NewRecorder()

	h.VerifyOTP(wBad, reqBad)
	if wBad.Code != http.StatusUnauthorized {
		t.Errorf("esperava status 401 para código inválido, obteve %d", wBad.Code)
	}
}

func (m *mockEvolutionClientForAuthHandler) FindMessages(ctx context.Context, in service.EvolutionFindMessagesInput) ([]service.WhatsAppChatMessage, error) {
	return nil, nil
}

func (m *mockEvolutionClientForAuthHandler) FindGroups(ctx context.Context, instanceName string) ([]service.WhatsAppGroup, error) {
	return nil, nil
}

func (m *mockEvolutionClientForAuthHandler) FindParticipants(ctx context.Context, instanceName, groupJid string) ([]string, error) {
	return nil, nil
}

func (m *mockEvolutionClientForAuthHandler) FindOwnerJID(ctx context.Context, instanceName string) (string, error) {
	return m.mockOwnerJID, m.mockOwnerJIDErr
}
