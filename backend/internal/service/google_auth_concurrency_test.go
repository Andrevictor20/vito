package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/andrevmp/vito/backend/internal/service"
)

func TestGoogleAuthService_ConcurrentMultiDevice_DesktopAndMobile(t *testing.T) {
	googleServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/token":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"access_token":  "mock-access-token-999",
				"refresh_token": "mock-refresh-token-999",
				"expires_in":    3600,
				"token_type":    "Bearer",
			})
		case "/userinfo":
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"sub":     "google-sub-concurrency",
				"email":   "andre.concurrency@gmail.com",
				"name":    "André Victor Concurrency",
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
		JWTSecret:    "test-jwt-secret-concurrency",
		AllowedOrigins: []string{
			"https://vitoassistant.rasppi.cloud",
			"https://vito.rasppi.cloud",
			"http://localhost:8190",
		},
	}

	googleAuthSvc := service.NewGoogleAuthService(cfg, userRepo, authSvc, nil)

	// 1. Simula início e callback de login no PC Desktop (Web)
	pcStateStr, err := googleAuthSvc.GenerateStateWithDevice("login", "", "https://vitoassistant.rasppi.cloud/auth/callback", "Navegador Web (Windows)")
	if err != nil {
		t.Fatalf("falha ao gerar state para PC: %v", err)
	}

	pcRedirectURL, err := googleAuthSvc.HandleCallback(context.Background(), "mock-auth-code-pc", pcStateStr)
	if err != nil {
		t.Fatalf("falha no callback do PC: %v", err)
	}

	pcURL, _ := url.Parse(pcRedirectURL)
	pcSessionID := pcURL.Query().Get("session_id")
	pcRefreshToken := pcURL.Query().Get("refresh_token")
	if pcSessionID == "" || pcRefreshToken == "" {
		t.Fatalf("esperava session_id e refresh_token válidos no redirect do PC: %s", pcRedirectURL)
	}

	// 2. Simula início e callback de login no Celular Mobile (App Android)
	mobileStateStr, err := googleAuthSvc.GenerateStateWithDevice("login", "", "vito://oauth/callback", "Android (Vito App)")
	if err != nil {
		t.Fatalf("falha ao gerar state para Mobile: %v", err)
	}

	mobileRedirectURL, err := googleAuthSvc.HandleCallback(context.Background(), "mock-auth-code-mobile", mobileStateStr)
	if err != nil {
		t.Fatalf("falha no callback do Mobile: %v", err)
	}

	mobileURL, _ := url.Parse(mobileRedirectURL)
	mobileSessionID := mobileURL.Query().Get("session_id")
	mobileRefreshToken := mobileURL.Query().Get("refresh_token")
	if mobileSessionID == "" || mobileRefreshToken == "" {
		t.Fatalf("esperava session_id e refresh_token válidos no redirect do Mobile: %s", mobileRedirectURL)
	}

	// 3. Usuário cadastrado
	user, err := userRepo.GetByEmail("andre.concurrency@gmail.com")
	if err != nil {
		t.Fatalf("usuário não encontrado: %v", err)
	}

	// 4. CRÍTICO: Sessão do PC NÃO pode ter sido revogada pelo login subsequente no Mobile!
	if authSvc.IsSessionRevoked(user.ID, pcSessionID) {
		t.Fatalf("FALHA CRÍTICA: Sessão do PC (ID=%s) foi REVOGADA após o login no Celular!", pcSessionID)
	}
	if authSvc.IsSessionRevoked(user.ID, mobileSessionID) {
		t.Fatalf("FALHA CRÍTICA: Sessão do Mobile (ID=%s) foi revogada!", mobileSessionID)
	}

	// 5. PC consegue renovar seu token normalmente
	_, pcNewPair, err := authSvc.RefreshSession(pcRefreshToken, "Navegador Web (Windows)", "200.100.50.1")
	if err != nil {
		t.Fatalf("falha ao renovar sessão do PC: %v", err)
	}
	if pcNewPair.AccessToken == "" {
		t.Error("esperava novo access token para o PC")
	}

	// 6. Mobile consegue renovar seu token normalmente
	_, mobileNewPair, err := authSvc.RefreshSession(mobileRefreshToken, "Android (Vito App)", "189.50.20.2")
	if err != nil {
		t.Fatalf("falha ao renovar sessão do Mobile: %v", err)
	}
	if mobileNewPair.AccessToken == "" {
		t.Error("esperava novo access token para o Mobile")
	}

	// 7. ListSessions exibe os 2 dispositivos conectados simultaneamente
	sessions, err := authSvc.ListSessions(user.ID, mobileNewPair.SessionID)
	if err != nil {
		t.Fatalf("erro ao listar sessões: %v", err)
	}
	if len(sessions) != 2 {
		t.Fatalf("esperava 2 sessões ativas simultâneas (PC e Celular), encontrou %d", len(sessions))
	}
}
