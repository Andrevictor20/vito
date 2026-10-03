package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// MockUserRepositoryInMemory para testes de autenticação Google
type MockUserRepositoryInMemory struct {
	users map[string]*domain.User
}

func NewMockUserRepositoryInMemory() *MockUserRepositoryInMemory {
	return &MockUserRepositoryInMemory{users: make(map[string]*domain.User)}
}

func (m *MockUserRepositoryInMemory) Create(user *domain.User) error {
	m.users[user.Email] = user
	return nil
}

func (m *MockUserRepositoryInMemory) GetByID(id string) (*domain.User, error) {
	for _, u := range m.users {
		if u.ID == id {
			return u, nil
		}
	}
	return nil, domain.ErrUserNotFound
}

func (m *MockUserRepositoryInMemory) GetByEmail(email string) (*domain.User, error) {
	u, ok := m.users[email]
	if !ok {
		return nil, domain.ErrUserNotFound
	}
	return u, nil
}

// MockSyncServiceInMemory para registrar integração de calendário
type MockSyncServiceInMemory struct {
	connectedProvider string
	connectedEmail    string
	connectedCreds    string
	syncTriggered     bool
}

func (m *MockSyncServiceInMemory) ConnectIntegration(ctx context.Context, userID, provider, email, creds, calID, calName string) (*domain.CalendarIntegration, error) {
	m.connectedProvider = provider
	m.connectedEmail = email
	m.connectedCreds = creds
	return &domain.CalendarIntegration{
		ID:           "integ-123",
		UserID:       userID,
		Provider:     provider,
		AccountEmail: email,
		Status:       "active",
	}, nil
}

func (m *MockSyncServiceInMemory) SyncIntegration(ctx context.Context, userID, provider string) error {
	m.syncTriggered = true
	return nil
}

func TestGoogleAuthService_StateHMAC(t *testing.T) {
	jwtSecret := "test-secret-key-12345"
	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		JWTSecret:    jwtSecret,
	}

	svc := service.NewGoogleAuthService(cfg, nil, nil, nil)

	// 1. Gera state válido para login
	stateStr, err := svc.GenerateState("login", "", "vito://oauth/callback")
	if err != nil {
		t.Fatalf("falha ao gerar state: %v", err)
	}

	parsed, err := svc.ValidateState(stateStr)
	if err != nil {
		t.Fatalf("falha ao validar state legítimo: %v", err)
	}

	if parsed.Mode != "login" || parsed.RedirectScheme != "vito://oauth/callback" {
		t.Errorf("state retornado incorreto: %+v", parsed)
	}

	// 2. Rejeição de state adulterado
	tamperedState := stateStr + "xyz"
	_, err = svc.ValidateState(tamperedState)
	if err == nil {
		t.Error("esperava erro de assinatura adulterada no state, mas passou")
	}
}

func TestGoogleAuthService_GetAuthURL(t *testing.T) {
	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		JWTSecret:    "secret123",
	}

	svc := service.NewGoogleAuthService(cfg, nil, nil, nil)

	// Teste URL para login
	loginURL, err := svc.GetAuthURL("login", "", "vito://oauth/callback")
	if err != nil {
		t.Fatalf("falha ao obter URL de login: %v", err)
	}

	parsedLogin, err := url.Parse(loginURL)
	if err != nil {
		t.Fatalf("URL gerada inválida: %v", err)
	}

	q := parsedLogin.Query()
	if q.Get("client_id") != "mock-client-id" {
		t.Errorf("client_id incorreto: %s", q.Get("client_id"))
	}
	if q.Get("access_type") != "offline" {
		t.Errorf("access_type esperado 'offline', obteve: %s", q.Get("access_type"))
	}
	if q.Get("scope") != "openid email profile" {
		t.Errorf("scope de login incorreto: %s", q.Get("scope"))
	}

	// Teste URL para calendário
	calURL, err := svc.GetAuthURL("calendar", "user-uuid-1", "vito://oauth/callback")
	if err != nil {
		t.Fatalf("falha ao obter URL de calendário: %v", err)
	}
	parsedCal, _ := url.Parse(calURL)
	qCal := parsedCal.Query()
	expectedCalScope := "openid email profile https://www.googleapis.com/auth/calendar.events"
	if qCal.Get("scope") != expectedCalScope {
		t.Errorf("scope de calendário esperado '%s', obteve: '%s'", expectedCalScope, qCal.Get("scope"))
	}
}

func TestGoogleAuthService_HandleCallback_LoginMode(t *testing.T) {
	// Mock server para emular endpoints do Google (Token e UserInfo)
	googleServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token":  "mock-access-token-123",
				"refresh_token": "mock-refresh-token-456",
				"expires_in":    3600,
				"token_type":    "Bearer",
			})
		case "/userinfo":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"sub":     "google-sub-999",
				"email":   "andre@gmail.com",
				"name":    "André Victor",
				"picture": "https://lh3.googleusercontent.com/a/photo.jpg",
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer googleServer.Close()

	userRepo := NewMockUserRepositoryInMemory()
	authSvc := service.NewAuthService(userRepo, "test-jwt-secret")

	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		TokenURL:     googleServer.URL + "/token",
		UserInfoURL:  googleServer.URL + "/userinfo",
		JWTSecret:    "test-jwt-secret",
	}

	googleAuthSvc := service.NewGoogleAuthService(cfg, userRepo, authSvc, nil)

	stateStr, _ := googleAuthSvc.GenerateState("login", "", "vito://oauth/callback")

	redirectURL, err := googleAuthSvc.HandleCallback(context.Background(), "mock-auth-code", stateStr)
	if err != nil {
		t.Fatalf("falha ao processar callback: %v", err)
	}

	parsedRedirect, err := url.Parse(redirectURL)
	if err != nil {
		t.Fatalf("redirect URL inválido: %v", err)
	}

	if parsedRedirect.Scheme != "vito" || parsedRedirect.Host != "oauth" {
		t.Errorf("scheme/host de redirect inesperado: %s", redirectURL)
	}

	token := parsedRedirect.Query().Get("token")
	if token == "" {
		t.Error("esperava token JWT nos parâmetros de query do redirect")
	}

	// Verifica se usuário foi criado no repositório
	createdUser, err := userRepo.GetByEmail("andre@gmail.com")
	if err != nil {
		t.Fatalf("usuário não foi persistido no repositório: %v", err)
	}
	if createdUser.Name != "André Victor" {
		t.Errorf("nome de usuário esperado 'André Victor', obteve '%s'", createdUser.Name)
	}
}

func TestGoogleAuthService_HandleCallback_CalendarMode(t *testing.T) {
	googleServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token":  "mock-cal-access-token",
				"refresh_token": "mock-cal-refresh-token",
				"expires_in":    3600,
			})
		case "/userinfo":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"email": "victorandre280@gmail.com",
				"name":  "Victor André",
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer googleServer.Close()

	userRepo := NewMockUserRepositoryInMemory()
	authSvc := service.NewAuthService(userRepo, "test-jwt-secret")
	mockSync := &MockSyncServiceInMemory{}

	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		TokenURL:     googleServer.URL + "/token",
		UserInfoURL:  googleServer.URL + "/userinfo",
		JWTSecret:    "test-jwt-secret",
	}

	googleAuthSvc := service.NewGoogleAuthService(cfg, userRepo, authSvc, mockSync)

	stateStr, _ := googleAuthSvc.GenerateState("calendar", "user-uuid-123", "vito://oauth/callback")

	redirectURL, err := googleAuthSvc.HandleCallback(context.Background(), "mock-auth-code", stateStr)
	if err != nil {
		t.Fatalf("falha ao processar callback de calendário: %v", err)
	}

	parsed, _ := url.Parse(redirectURL)
	if parsed.Query().Get("status") != "success" || parsed.Query().Get("provider") != "google" {
		t.Errorf("parâmetros de callback inesperados: %s", redirectURL)
	}

	if mockSync.connectedEmail != "victorandre280@gmail.com" {
		t.Errorf("e-mail conectado esperado 'victorandre280@gmail.com', obteve '%s'", mockSync.connectedEmail)
	}

	// Aguarda goroutine de sync
	time.Sleep(50 * time.Millisecond)
	if !mockSync.syncTriggered {
		t.Error("esperava que a sincronização inicial fosse engatilhada em segundo plano")
	}
}
