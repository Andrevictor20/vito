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

func (m *MockUserRepositoryInMemory) IncrementTokenVersion(id string) error {
	for _, u := range m.users {
		if u.ID == id {
			u.TokenVersion++
			return nil
		}
	}
	return domain.ErrUserNotFound
}

func (m *MockUserRepositoryInMemory) GetByPhone(phone string) (*domain.User, error) {
	for _, u := range m.users {
		if u.Phone != nil && *u.Phone == phone {
			return u, nil
		}
	}
	return nil, domain.ErrUserNotFound
}

func (m *MockUserRepositoryInMemory) UpdatePhone(id, phone string) error {
	for _, u := range m.users {
		if u.ID == id {
			u.Phone = &phone
			return nil
		}
	}
	return domain.ErrUserNotFound
}

func (m *MockUserRepositoryInMemory) ListAll() ([]domain.User, error) {
	var list []domain.User
	for _, u := range m.users {
		list = append(list, *u)
	}
	return list, nil
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

func TestGoogleAuthService_RedirectSchemeAllowlist(t *testing.T) {
	cfg := service.GoogleAuthConfig{
		ClientID:       "mock-client-id",
		ClientSecret:   "mock-client-secret",
		RedirectURL:    "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		JWTSecret:      "secret123",
		AllowedOrigins: []string{"https://meuapp.custom.com"},
	}
	svc := service.NewGoogleAuthService(cfg, nil, nil, nil)

	// 1. Esquema malicioso externo deve sofrer fallback para vito://oauth/callback
	stateEvil, err := svc.GenerateState("login", "", "https://evil-attacker-site.com/steal-token")
	if err != nil {
		t.Fatalf("falha ao gerar state: %v", err)
	}
	parsedEvil, err := svc.ValidateState(stateEvil)
	if err != nil {
		t.Fatalf("falha ao validar state: %v", err)
	}
	if parsedEvil.RedirectScheme != "vito://oauth/callback" {
		t.Errorf("esperava sanitização para 'vito://oauth/callback', obteve: %s", parsedEvil.RedirectScheme)
	}

	// 2. Subdomínio falso com ataque de prefixo deve ser rejeitado
	stateSubEvil, _ := svc.GenerateState("login", "", "https://vitoassistant.rasppi.cloud.attacker.com/steal")
	parsedSubEvil, _ := svc.ValidateState(stateSubEvil)
	if parsedSubEvil.RedirectScheme != "vito://oauth/callback" {
		t.Errorf("esperava sanitização para 'vito://oauth/callback', obteve: %s", parsedSubEvil.RedirectScheme)
	}

	// 3. Esquema legítimo vito:// deve ser aceito
	stateLegit, _ := svc.GenerateState("login", "", "vito://custom/path")
	parsedLegit, _ := svc.ValidateState(stateLegit)
	if parsedLegit.RedirectScheme != "vito://custom/path" {
		t.Errorf("esperava 'vito://custom/path', obteve: %s", parsedLegit.RedirectScheme)
	}

	// 4. Esquema Expo em dev deve ser aceito
	stateExpo, _ := svc.GenerateState("login", "", "exp://192.168.1.50:8081/--/oauth/callback")
	parsedExpo, _ := svc.ValidateState(stateExpo)
	if parsedExpo.RedirectScheme != "exp://192.168.1.50:8081/--/oauth/callback" {
		t.Errorf("esperava scheme exp:// aceito, obteve: %s", parsedExpo.RedirectScheme)
	}

	// 5. Desktop web em produção: vitoassistant.rasppi.cloud deve ser aceito
	stateDesktop, _ := svc.GenerateState("login", "", "https://vitoassistant.rasppi.cloud/auth/callback")
	parsedDesktop, _ := svc.ValidateState(stateDesktop)
	if parsedDesktop.RedirectScheme != "https://vitoassistant.rasppi.cloud/auth/callback" {
		t.Errorf("esperava 'https://vitoassistant.rasppi.cloud/auth/callback', obteve: %s", parsedDesktop.RedirectScheme)
	}

	// 6. Desktop web em vito.rasppi.cloud deve ser aceito
	stateVitoWeb, _ := svc.GenerateState("login", "", "https://vito.rasppi.cloud/auth/callback")
	parsedVitoWeb, _ := svc.ValidateState(stateVitoWeb)
	if parsedVitoWeb.RedirectScheme != "https://vito.rasppi.cloud/auth/callback" {
		t.Errorf("esperava 'https://vito.rasppi.cloud/auth/callback', obteve: %s", parsedVitoWeb.RedirectScheme)
	}

	// 7. Desktop web local (localhost:8190) deve ser aceito
	stateLocal, _ := svc.GenerateState("login", "", "http://localhost:8190/auth/callback")
	parsedLocal, _ := svc.ValidateState(stateLocal)
	if parsedLocal.RedirectScheme != "http://localhost:8190/auth/callback" {
		t.Errorf("esperava 'http://localhost:8190/auth/callback', obteve: %s", parsedLocal.RedirectScheme)
	}

	// 8. Origem explicitamente configurada em AllowedOrigins deve ser aceita
	stateCustom, _ := svc.GenerateState("login", "", "https://meuapp.custom.com/auth/callback")
	parsedCustom, _ := svc.ValidateState(stateCustom)
	if parsedCustom.RedirectScheme != "https://meuapp.custom.com/auth/callback" {
		t.Errorf("esperava 'https://meuapp.custom.com/auth/callback', obteve: %s", parsedCustom.RedirectScheme)
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
	expectedLoginScope := "openid email profile"
	if q.Get("scope") != expectedLoginScope {
		t.Errorf("scope de login incorreto: esperado '%s', obteve '%s'", expectedLoginScope, q.Get("scope"))
	}

	if q.Get("prompt") != "select_account" {
		t.Errorf("prompt esperado 'select_account' no modo login, obteve: %s", q.Get("prompt"))
	}

	// Teste URL para calendário
	calURL, err := svc.GetAuthURL("calendar", "user-uuid-1", "vito://oauth/callback")
	if err != nil {
		t.Fatalf("falha ao obter URL de calendário: %v", err)
	}
	parsedCal, _ := url.Parse(calURL)
	qCal := parsedCal.Query()
	expectedCalScope := "openid email profile https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events"
	if qCal.Get("scope") != expectedCalScope {
		t.Errorf("scope de calendário esperado '%s', obteve: '%s'", expectedCalScope, qCal.Get("scope"))
	}
	if qCal.Get("prompt") != "consent" {
		t.Errorf("prompt esperado 'consent' no modo calendar, obteve: %s", qCal.Get("prompt"))
	}

	// Teste URL para gmail
	gmailURL, err := svc.GetAuthURL("gmail", "user-uuid-1", "vito://oauth/callback")
	if err != nil {
		t.Fatalf("falha ao obter URL de gmail: %v", err)
	}
	parsedGmail, _ := url.Parse(gmailURL)
	qGmail := parsedGmail.Query()
	expectedGmailScope := "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose"
	if qGmail.Get("scope") != expectedGmailScope {
		t.Errorf("scope de gmail esperado '%s', obteve: '%s'", expectedGmailScope, qGmail.Get("scope"))
	}
	if qGmail.Get("prompt") != "consent" {
		t.Errorf("prompt esperado 'consent' no modo gmail, obteve: %s", qGmail.Get("prompt"))
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

func TestGoogleAuthService_HandleCallback_LoginMode_DualTokenSession(t *testing.T) {
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
				"email":   "andre.session@gmail.com",
				"name":    "André Victor Dual",
				"picture": "https://lh3.googleusercontent.com/a/photo.jpg",
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer googleServer.Close()

	authSvc, userRepo, _ := setupAuthServiceWithSessions(t)

	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		TokenURL:     googleServer.URL + "/token",
		UserInfoURL:  googleServer.URL + "/userinfo",
		JWTSecret:    "test-super-secret-jwt-key",
	}

	googleAuthSvc := service.NewGoogleAuthService(cfg, userRepo, authSvc, nil)

	stateStr, _ := googleAuthSvc.GenerateState("login", "", "vito://oauth/callback")

	redirectURL, err := googleAuthSvc.HandleCallback(context.Background(), "mock-auth-code", stateStr)
	if err != nil {
		t.Fatalf("falha ao processar callback com sessão: %v", err)
	}

	parsedRedirect, err := url.Parse(redirectURL)
	if err != nil {
		t.Fatalf("redirect URL inválido: %v", err)
	}

	q := parsedRedirect.Query()
	if q.Get("token") == "" {
		t.Error("esperava token JWT nos parâmetros de query do redirect")
	}
	if q.Get("access_token") == "" {
		t.Error("esperava access_token nos parâmetros de query do redirect")
	}
	if q.Get("refresh_token") == "" {
		t.Error("esperava refresh_token (30 dias) nos parâmetros de query do redirect para manter o app logado")
	}
	if q.Get("session_id") == "" {
		t.Error("esperava session_id nos parâmetros de query do redirect")
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

type MockGmailRepositoryInMemory struct {
	saved *domain.GmailIntegration
}

func (m *MockGmailRepositoryInMemory) GetByUserID(ctx context.Context, userID string) (*domain.GmailIntegration, error) {
	if m.saved == nil || m.saved.UserID != userID {
		return nil, domain.ErrGmailNotConnected
	}
	return m.saved, nil
}

func (m *MockGmailRepositoryInMemory) Upsert(ctx context.Context, integ *domain.GmailIntegration) error {
	m.saved = integ
	return nil
}

func (m *MockGmailRepositoryInMemory) UpdateStatus(ctx context.Context, userID, status string) error {
	if m.saved != nil && m.saved.UserID == userID {
		m.saved.Status = status
		return nil
	}
	return domain.ErrGmailNotConnected
}

func (m *MockGmailRepositoryInMemory) UpdateLastScanned(ctx context.Context, userID, historyID string, scannedAt time.Time) error {
	if m.saved != nil && m.saved.UserID == userID {
		m.saved.HistoryID = historyID
		m.saved.LastScannedAt = &scannedAt
		return nil
	}
	return domain.ErrGmailNotConnected
}

func (m *MockGmailRepositoryInMemory) DeleteByUserID(ctx context.Context, userID string) error {
	m.saved = nil
	return nil
}

func TestGoogleAuthService_HandleCallback_GmailMode(t *testing.T) {
	googleServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token":  "mock-gmail-access-token",
				"refresh_token": "mock-gmail-refresh-token",
				"expires_in":    3600,
				"token_type":    "Bearer",
			})
		case "/userinfo":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"sub":   "google-sub-gmail",
				"email": "andre.gmail@gmail.com",
				"name":  "André Gmail",
			})
		default:
			http.NotFound(w, r)
		}
	}))
	defer googleServer.Close()

	userRepo := NewMockUserRepositoryInMemory()
	authSvc := service.NewAuthService(userRepo, "test-jwt-secret")
	mockSync := &MockSyncServiceInMemory{}
	mockGmailRepo := &MockGmailRepositoryInMemory{}

	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		TokenURL:     googleServer.URL + "/token",
		UserInfoURL:  googleServer.URL + "/userinfo",
		JWTSecret:    "test-jwt-secret",
	}

	googleAuthSvc := service.NewGoogleAuthService(cfg, userRepo, authSvc, mockSync)
	googleAuthSvc.SetGmailRepository(mockGmailRepo, "encryption-key-32-chars-long12")

	stateStr, _ := googleAuthSvc.GenerateState("gmail", "user-uuid-999", "vito://oauth/callback")

	redirectURL, err := googleAuthSvc.HandleCallback(context.Background(), "mock-auth-code", stateStr)
	if err != nil {
		t.Fatalf("falha ao processar callback de gmail: %v", err)
	}

	parsed, _ := url.Parse(redirectURL)
	if parsed.Query().Get("status") != "success" || parsed.Query().Get("provider") != "gmail" {
		t.Errorf("parâmetros de callback inesperados: %s", redirectURL)
	}

	if mockGmailRepo.saved == nil {
		t.Fatal("esperava que a integração do Gmail fosse salva no repositório")
	}
	if mockGmailRepo.saved.AccountEmail != "andre.gmail@gmail.com" {
		t.Errorf("e-mail salvo divergente: %s", mockGmailRepo.saved.AccountEmail)
	}
	if mockGmailRepo.saved.Status != domain.GmailStatusActive {
		t.Errorf("status salvo divergente: %s", mockGmailRepo.saved.Status)
	}
}
