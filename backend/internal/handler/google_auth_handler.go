package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// GoogleAuthHandler processa as requisições de início de OAuth2 e callback do Google.
type GoogleAuthHandler struct {
	googleAuthSvc *service.GoogleAuthService
	authSvc       *service.AuthService
}

// NewGoogleAuthHandler instancia o handler de autenticação Google.
func NewGoogleAuthHandler(googleAuthSvc *service.GoogleAuthService, authSvc *service.AuthService) *GoogleAuthHandler {
	return &GoogleAuthHandler{
		googleAuthSvc: googleAuthSvc,
		authSvc:       authSvc,
	}
}

// Start inicia o fluxo OAuth2 redirecionando para a tela de consentimento do Google.
func (h *GoogleAuthHandler) Start(w http.ResponseWriter, r *http.Request) {
	mode := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("mode")))
	if mode != "calendar" {
		mode = "login"
	}

	redirectScheme := r.URL.Query().Get("redirect_scheme")
	if redirectScheme == "" {
		redirectScheme = "vito://oauth/callback"
	}

	var userID string
	// Tenta extrair usuário do contexto autenticado via middleware
	if ctxUserID, ok := middleware.UserIDFromContext(r.Context()); ok {
		userID = ctxUserID
	}

	// Se não veio do contexto, tenta pelo parâmetro token de query ou cabeçalho Authorization
	if userID == "" {
		tokenStr := r.URL.Query().Get("token")
		if tokenStr == "" {
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}
		if tokenStr != "" && h.authSvc != nil {
			claims, err := h.authSvc.ValidateToken(tokenStr)
			if err == nil && claims != nil {
				userID = claims.UserID
			}
		}
	}

	// Se o modo for 'calendar', autenticação do usuário do Vito é mandatória
	if mode == "calendar" && userID == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusUnauthorized)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": "autenticação de usuário necessária para vincular calendário",
		})
		return
	}

	authURL, err := h.googleAuthSvc.GetAuthURL(mode, userID, redirectScheme)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("falha ao gerar URL de autorização: %v", err),
		})
		return
	}

	// Se cliente pedir JSON explicitamente
	if r.URL.Query().Get("json") == "true" || r.Header.Get("Accept") == "application/json" {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{
			"url": authURL,
		})
		return
	}

	http.Redirect(w, r, authURL, http.StatusTemporaryRedirect)
}

// Callback processa a resposta da tela de consentimento do Google e devolve para o app via Deep Link.
func (h *GoogleAuthHandler) Callback(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	googleErr := q.Get("error")
	code := q.Get("code")
	stateStr := q.Get("state")

	defaultRedirectScheme := "vito://oauth/callback"

	// Usuário cancelou ou houve erro no Google
	if googleErr != "" {
		redirectScheme := defaultRedirectScheme
		if stateStr != "" {
			if parsedState, err := h.googleAuthSvc.ValidateState(stateStr); err == nil && parsedState.RedirectScheme != "" {
				redirectScheme = parsedState.RedirectScheme
			}
		}
		errURL := fmt.Sprintf("%s?error=%s", redirectScheme, url.QueryEscape(googleErr))
		http.Redirect(w, r, errURL, http.StatusTemporaryRedirect)
		return
	}

	if code == "" || stateStr == "" {
		http.Error(w, `{"error":"parâmetros code e state são obrigatórios"}`, http.StatusBadRequest)
		return
	}

	redirectURL, err := h.googleAuthSvc.HandleCallback(r.Context(), code, stateStr)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]string{
			"error": fmt.Sprintf("falha ao processar autenticação Google: %v", err),
		})
		return
	}

	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}
