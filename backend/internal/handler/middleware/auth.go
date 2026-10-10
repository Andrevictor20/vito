package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/andrevmp/vito/backend/internal/service"
)

type contextKey string

const (
	UserIDKey    contextKey = "user_id"
	UserEmailKey contextKey = "user_email"
)

// AuthMiddleware intercepta requisições, valida o Bearer Token e injeta o UserID no Context.
func AuthMiddleware(authSvc *service.AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, `{"error":"cabeçalho de autorização ausente"}`, http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
				http.Error(w, `{"error":"formato de token inválido (esperado: Bearer <token>)"}`, http.StatusUnauthorized)
				return
			}

			claims, err := authSvc.ValidateToken(parts[1])
			if err != nil {
				http.Error(w, `{"error":"token inválido ou expirado"}`, http.StatusUnauthorized)
				return
			}

			// Valida se o usuário referenciado no token realmente existe no banco ativo
			user, err := authSvc.GetUserByID(claims.UserID)
			if err != nil || user == nil {
				http.Error(w, `{"error":"sessão inválida ou usuário não encontrado no banco ativo"}`, http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), UserIDKey, claims.UserID)
			ctx = context.WithValue(ctx, UserEmailKey, claims.Email)

			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserIDFromContext recupera o ID do usuário injetado pelo AuthMiddleware.
func UserIDFromContext(ctx context.Context) (string, bool) {
	val, ok := ctx.Value(UserIDKey).(string)
	return val, ok
}
