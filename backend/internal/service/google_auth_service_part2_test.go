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
