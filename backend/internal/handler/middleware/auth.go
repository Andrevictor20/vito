package middleware

import (
	"context"
	"github.com/andrevmp/vito/backend/internal/platform/httpx"
	"net/http"
	"strings"

	"github.com/andrevmp/vito/backend/internal/service"
)

type contextKey string

const (
	UserIDKey    contextKey = "user_id"
	UserEmailKey contextKey = "user_email"
	SessionIDKey contextKey = "session_id"
)

// AuthMiddleware intercepta requisições, valida o Bearer Token e injeta o UserID no Context.
func AuthMiddleware(authSvc *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenStr := ""
			authHeader := r.Header.Get("Authorization")
			if authHeader != "" {
				parts := strings.SplitN(authHeader, " ", 2)
				if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
					httpx.WriteJSONError(w, http.StatusUnauthorized, "formato de token inválido (esperado: Bearer <token>)")
					return
				}
				tokenStr = parts[1]
			} else if qToken := strings.TrimSpace(r.URL.Query().Get("token")); qToken != "" {
				tokenStr = qToken
			}

			if tokenStr == "" {
				httpx.WriteJSONError(w, http.StatusUnauthorized, "cabeçalho de autorização ausente")
				return
			}

			claims, err := authSvc.ValidateToken(tokenStr)
			if err != nil {
				httpx.WriteJSONError(w, http.StatusUnauthorized, "token inválido ou expirado")
				return
			}

			// Valida se o usuário referenciado no token realmente existe no banco ativo
			user, err := authSvc.GetUserByID(claims.UserID)
			if err != nil || user == nil {
				httpx.WriteJSONError(w, http.StatusUnauthorized, "sessão inválida ou usuário não encontrado no banco ativo")
				return
			}

			// Valida revogação ativa de sessão via TokenVersion (se o token for anterior ao reset)
			if user.TokenVersion > 0 && claims.TokenVersion > 0 && user.TokenVersion != claims.TokenVersion {
				httpx.WriteJSONError(w, http.StatusUnauthorized, "sessão revogada ou expirada. faça login novamente")
				return
			}

			// Valida revogação granular de dispositivo (Sprint 13)
			if claims.SessionID != "" && authSvc.IsSessionRevoked(claims.UserID, claims.SessionID) {
				httpx.WriteJSONError(w, http.StatusUnauthorized, "sessão deste dispositivo foi revogada. faça login novamente")
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UserEmailKey, claims.Email)
			if claims.SessionID != "" {
				ctx = context.WithValue(ctx, SessionIDKey, claims.SessionID)
			}

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext recupera o ID do usuário injetado pelo AuthMiddleware.
func UserIDFromContext(ctx context.Context) (string, bool) {
	val, ok := ctx.Value(UserIDKey).(string)
	return val, ok
}

// SessionIDFromContext recupera o ID da sessão do dispositivo atual injetado pelo AuthMiddleware.
func SessionIDFromContext(ctx context.Context) string {
	val, _ := ctx.Value(SessionIDKey).(string)
	return val
}
