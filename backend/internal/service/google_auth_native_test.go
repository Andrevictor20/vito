package service_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

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
					"aud":            "mock-native-client-id",
					"iss":            "https://accounts.google.com",
					"exp":            fmt.Sprintf("%d", time.Now().Add(time.Hour).Unix()),
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

func TestGoogleAuthService_ValidateGoogleIDToken_RejectsUntrustedClaims(t *testing.T) {
	now := time.Now()
	baseClaims := func() map[string]interface{} {
		return map[string]interface{}{
			"sub":            "google-sub-native-12345",
			"email":          "andre.native@gmail.com",
			"email_verified": "true",
			"name":           "André Victor Nativo",
			"picture":        "https://lh3.googleusercontent.com/photo_native.jpg",
			"aud":            "mock-native-client-id",
			"iss":            "https://accounts.google.com",
			"exp":            fmt.Sprintf("%d", now.Add(time.Hour).Unix()),
		}
	}

	cases := []struct {
		name   string
		token  string
		mutate func(map[string]interface{})
	}{
		{name: "audiência de outro cliente", token: "wrong-aud", mutate: func(c map[string]interface{}) { c["aud"] = "other-client" }},
		{name: "emissor não confiável", token: "wrong-iss", mutate: func(c map[string]interface{}) { c["iss"] = "https://evil.example.com" }},
		{name: "e-mail não verificado", token: "unverified-email", mutate: func(c map[string]interface{}) { c["email_verified"] = "false" }},
		{name: "token expirado", token: "expired", mutate: func(c map[string]interface{}) { c["exp"] = fmt.Sprintf("%d", now.Add(-time.Minute).Unix()) }},
		{name: "sem identificador de usuário", token: "missing-sub", mutate: func(c map[string]interface{}) { delete(c, "sub") }},
		{name: "sem validade", token: "missing-exp", mutate: func(c map[string]interface{}) { delete(c, "exp") }},
	}

	payloads := make(map[string]map[string]interface{}, len(cases)+1)
	for _, tc := range cases {
		claims := baseClaims()
		tc.mutate(claims)
		payloads[tc.token] = claims
	}
	payloads["valid-claims"] = baseClaims()

	googleServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/tokeninfo" {
			http.NotFound(w, r)
			return
		}
		claims, ok := payloads[r.URL.Query().Get("id_token")]
		if !ok {
			http.Error(w, `{"error_description":"Invalid Value"}`, http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(claims)
	}))
	defer googleServer.Close()

	cfg := service.GoogleAuthConfig{
		ClientID:     "mock-native-client-id",
		ClientSecret: "mock-native-client-secret",
		RedirectURL:  "https://vito.rasppi.cloud/api/v1/auth/google/callback",
		TokenInfoURL: googleServer.URL + "/tokeninfo",
		JWTSecret:    "jwt-secret-native-google-test",
	}
	googleAuthSvc := service.NewGoogleAuthService(cfg, nil, nil, nil)
	ctx := context.Background()

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := googleAuthSvc.ValidateGoogleIDToken(ctx, tc.token); err == nil {
				t.Fatalf("esperava rejeição para %s (%s), obteve sucesso", tc.name, tc.token)
			}
		})
	}

	if _, err := googleAuthSvc.ValidateGoogleIDToken(ctx, "valid-claims"); err != nil {
		t.Fatalf("token com claims válidas deveria ser aceito: %v", err)
	}
}
