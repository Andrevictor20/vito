package handler_test

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/service"
)

type mockUserRepoForHandler struct{}

func (m *mockUserRepoForHandler) Create(u *domain.User) error             { return nil }
func (m *mockUserRepoForHandler) GetByID(id string) (*domain.User, error) { return nil, nil }
func (m *mockUserRepoForHandler) GetByEmail(email string) (*domain.User, error) {
	return nil, domain.ErrUserNotFound
}

func TestGoogleAuthHandler_StartLogin(t *testing.T) {
	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		JWTSecret:    "secret123",
	}

	authSvc := service.NewAuthService(&mockUserRepoForHandler{}, "secret123")
	googleAuthSvc := service.NewGoogleAuthService(cfg, &mockUserRepoForHandler{}, authSvc, nil)
	googleHandler := handler.NewGoogleAuthHandler(googleAuthSvc, authSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google/start?mode=login&redirect_scheme=vito://oauth/callback", nil)
	rec := httptest.NewRecorder()

	googleHandler.Start(rec, req)

	if rec.Code != http.StatusTemporaryRedirect && rec.Code != http.StatusFound {
		t.Fatalf("status de redirecionamento esperado, obteve: %d", rec.Code)
	}

	loc := rec.Header().Get("Location")
	if loc == "" {
		t.Fatal("esperava cabeçalho Location no redirecionamento")
	}

	parsedLoc, err := url.Parse(loc)
	if err != nil {
		t.Fatalf("Location inválido: %v", err)
	}

	if parsedLoc.Host != "accounts.google.com" {
		t.Errorf("host esperado accounts.google.com, obteve: %s", parsedLoc.Host)
	}
}

func TestGoogleAuthHandler_StartCalendar_RequiresAuth(t *testing.T) {
	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		JWTSecret:    "secret123",
	}

	authSvc := service.NewAuthService(&mockUserRepoForHandler{}, "secret123")
	googleAuthSvc := service.NewGoogleAuthService(cfg, &mockUserRepoForHandler{}, authSvc, nil)
	googleHandler := handler.NewGoogleAuthHandler(googleAuthSvc, authSvc)

	// Sem autenticação no modo calendar
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google/start?mode=calendar", nil)
	rec := httptest.NewRecorder()

	googleHandler.Start(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("esperava 401 Unauthorized para modo calendar sem token, obteve: %d", rec.Code)
	}
}

func TestGoogleAuthHandler_CallbackErrorParam(t *testing.T) {
	cfg := service.GoogleAuthConfig{
		ClientID:  "mock-client-id",
		JWTSecret: "secret123",
	}

	authSvc := service.NewAuthService(&mockUserRepoForHandler{}, "secret123")
	googleAuthSvc := service.NewGoogleAuthService(cfg, &mockUserRepoForHandler{}, authSvc, nil)
	googleHandler := handler.NewGoogleAuthHandler(googleAuthSvc, authSvc)

	// Simula usuário cancelando consentimento no Google
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google/callback?error=access_denied", nil)
	rec := httptest.NewRecorder()

	googleHandler.Callback(rec, req)

	if rec.Code != http.StatusTemporaryRedirect && rec.Code != http.StatusFound {
		t.Fatalf("esperava redirecionamento de erro para o app, obteve status: %d", rec.Code)
	}

	loc := rec.Header().Get("Location")
	if loc == "" {
		t.Fatal("esperava Location para o deep link do app com erro")
	}

	parsed, _ := url.Parse(loc)
	if parsed.Query().Get("error") != "access_denied" {
		t.Errorf("parâmetro de erro ausente ou incorreto no redirect: %s", loc)
	}
}
