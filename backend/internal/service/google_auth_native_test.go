package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/service"
)

func TestGoogleAuthService_AuthenticateNativeIDToken(t *testing.T) {
	// Mock server do Google simulando o endpoint /tokeninfo
	googleServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/tokeninfo":
			idToken := r.URL.Query().Get("id_token")
			if idToken == "valid-native-google-token" {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"sub":            "google-sub-native-12345",
					"email":          "andre.native@gmail.com",
					"email_verified": "true",
					"name":           "André Victor Nativo",
					"picture":        "https://lh3.googleusercontent.com/photo_native.jpg",
				})
				return
			}
			http.Error(w, `{"error_description":"Invalid Value"}`, http.StatusBadRequest)
		default:
			http.NotFound(w, r)
		}
	}))
	defer googleServer.Close()

	authSvc, userRepo, _ := setupAuthServiceWithSessions(t)

	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-native-client-id",
		ClientSecret: "mock-native-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		TokenInfoURL: googleServer.URL + "/tokeninfo",
		JWTSecret:    "jwt-secret-native-google-test",
	}

	googleAuthSvc := service.NewGoogleAuthService(cfg, userRepo, authSvc, nil)

	ctx := context.Background()

	// 1. Token inválido deve retornar erro
	_, _, err := googleAuthSvc.AuthenticateNativeIDToken(ctx, "invalid-token", "Vito Mobile (Android)", "189.50.10.1")
	if err == nil {
		t.Fatal("esperava erro ao autenticar com token inválido, obteve sucesso")
	}

	// 2. Token válido deve autenticar com sucesso e criar/obter usuário
	tokens, user, err := googleAuthSvc.AuthenticateNativeIDToken(ctx, "valid-native-google-token", "Vito Mobile (Android)", "189.50.10.1")
	if err != nil {
		t.Fatalf("falha ao autenticar com id_token válido: %v", err)
	}

	if tokens.AccessToken == "" || tokens.RefreshToken == "" || tokens.SessionID == "" {
		t.Fatalf("tokens de sessão incompletos: %+v", tokens)
	}

	if user.Email != "andre.native@gmail.com" {
		t.Errorf("e-mail esperado 'andre.native@gmail.com', obteve '%s'", user.Email)
	}
	if user.Name != "André Victor Nativo" {
		t.Errorf("nome esperado 'André Victor Nativo', obteve '%s'", user.Name)
	}

	// 3. Concorrência com desktop: Desktop loga na mesma conta
	pcTokens, err := authSvc.IssueSessionForUser(user, "Navegador Web (Windows)", "200.100.50.1")
	if err != nil {
		t.Fatalf("falha ao emitir sessão para desktop: %v", err)
	}
	if pcTokens.AccessToken == "" {
		t.Fatal("token desktop vazio")
	}

	// 4. ListSessions deve retornar AMBOS os aparelhos simultaneamente
	sessions, err := authSvc.ListSessions(user.ID, "")
	if err != nil {
		t.Fatalf("falha ao listar sessões: %v", err)
	}
	if len(sessions) < 2 {
		t.Fatalf("esperava ao menos 2 sessões ativas (mobile + desktop), obteve %d", len(sessions))
	}
}
