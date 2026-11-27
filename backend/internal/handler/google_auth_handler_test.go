package handler_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
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
func (m *mockUserRepoForHandler) GetByPhone(phone string) (*domain.User, error) {
	return nil, domain.ErrUserNotFound
}
func (m *mockUserRepoForHandler) UpdatePhone(id, phone string) error    { return nil }
func (m *mockUserRepoForHandler) Delete(id string) error                { return nil }
func (m *mockUserRepoForHandler) IncrementTokenVersion(id string) error { return nil }
func (m *mockUserRepoForHandler) ListAll() ([]domain.User, error)       { return nil, nil }

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

func TestGoogleAuthHandler_StartGmail_RequiresAuth(t *testing.T) {
	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		JWTSecret:    "secret123",
	}

	authSvc := service.NewAuthService(&mockUserRepoForHandler{}, "secret123")
	googleAuthSvc := service.NewGoogleAuthService(cfg, &mockUserRepoForHandler{}, authSvc, nil)
	googleHandler := handler.NewGoogleAuthHandler(googleAuthSvc, authSvc)

	// Sem autenticação no modo gmail deve falhar com 401
	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google/start?mode=gmail", nil)
	rec := httptest.NewRecorder()

	googleHandler.Start(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("esperava 401 Unauthorized para modo gmail sem token, obteve: %d", rec.Code)
	}
}

func TestGoogleAuthHandler_StartGmail_WithAuth(t *testing.T) {
	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		ClientSecret: "mock-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		JWTSecret:    "secret123",
	}

	authSvc := service.NewAuthService(&mockUserRepoForHandler{}, "secret123")
	token, err := authSvc.GenerateTokenForUser(&domain.User{ID: "user-123", Email: "test@example.com"})
	if err != nil {
		t.Fatalf("falha ao gerar token: %v", err)
	}

	googleAuthSvc := service.NewGoogleAuthService(cfg, &mockUserRepoForHandler{}, authSvc, nil)
	googleHandler := handler.NewGoogleAuthHandler(googleAuthSvc, authSvc)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/auth/google/start?mode=gmail&token="+token, nil)
	rec := httptest.NewRecorder()

	googleHandler.Start(rec, req)

	if rec.Code != http.StatusTemporaryRedirect && rec.Code != http.StatusFound {
		t.Fatalf("esperava redirect para Google OAuth no modo gmail, obteve status: %d", rec.Code)
	}

	loc := rec.Header().Get("Location")
	if loc == "" {
		t.Fatal("esperava Location no redirect")
	}
	parsed, err := url.Parse(loc)
	if err != nil {
		t.Fatalf("URL inválida: %v", err)
	}
	if parsed.Host != "accounts.google.com" {
		t.Errorf("host esperado accounts.google.com, obteve %s", parsed.Host)
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

type failingCreateUserRepo struct {
	mockUserRepoForHandler
}

func (f *failingCreateUserRepo) Create(u *domain.User) error {
	return errors.New(`falha com "aspas" no erro`)
}

func TestGoogleAuthHandler_NativeAuth_ReturnsJSONErrorEscaped(t *testing.T) {
	tokenInfoSrv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"sub":"sub-1","email":"u@example.com","email_verified":"true","name":"User","aud":"mock-client-id","iss":"https://accounts.google.com","exp":"9999999999"}`))
	}))
	defer tokenInfoSrv.Close()

	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-client-id",
		JWTSecret:    "secret123",
		TokenInfoURL: tokenInfoSrv.URL,
	}
	repo := &failingCreateUserRepo{}
	authSvc := service.NewAuthService(repo, "secret123")
	googleAuthSvc := service.NewGoogleAuthService(cfg, repo, authSvc, nil)
	googleHandler := handler.NewGoogleAuthHandler(googleAuthSvc, authSvc)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/google/native", strings.NewReader(`{"id_token":"tok"}`))
	req.Header.Set("Content-Type", "application/json")
	rec := httptest.NewRecorder()

	googleHandler.NativeAuth(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("esperava 401, obteve %d", rec.Code)
	}
	if ct := rec.Header().Get("Content-Type"); !strings.Contains(ct, "application/json") {
		t.Fatalf("esperava Content-Type application/json, obteve %q", ct)
	}
	var payload map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &payload); err != nil {
		t.Fatalf("corpo de erro deveria ser JSON válido, obteve %q (err=%v)", rec.Body.String(), err)
	}
	if !strings.Contains(payload["error"], `"aspas"`) {
		t.Errorf("mensagem de erro esperada no campo error, obteve %q", payload["error"])
	}
}
