package middleware_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

func TestRateLimiter(t *testing.T) {
	// Permite 3 requisições por segundo
	limiter := middleware.NewRateLimiter(3, 1*time.Second)

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	})

	handler := limiter(dummyHandler)

	for i := 0; i < 3; i++ {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = "192.168.1.100:12345"
		rr := httptest.NewRecorder()
		handler.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("esperava 200 OK na req %d, obteve: %d", i+1, rr.Code)
		}
	}

	// 4ª requisição imediata DEVE ser bloqueada com 429 Too Many Requests
	reqBlocked := httptest.NewRequest(http.MethodGet, "/test", nil)
	reqBlocked.RemoteAddr = "192.168.1.100:12345"
	rrBlocked := httptest.NewRecorder()
	handler.ServeHTTP(rrBlocked, reqBlocked)

	if rrBlocked.Code != http.StatusTooManyRequests {
		t.Fatalf("esperava 429 Too Many Requests na 4ª req, obteve: %d", rrBlocked.Code)
	}

	if rrBlocked.Header().Get("Retry-After") == "" {
		t.Error("esperava cabeçalho Retry-After presente na resposta 429")
	}

	// Cliente diferente (outro IP) NÃO deve ser afetado
	reqOther := httptest.NewRequest(http.MethodGet, "/test", nil)
	reqOther.RemoteAddr = "192.168.1.200:12345"
	rrOther := httptest.NewRecorder()
	handler.ServeHTTP(rrOther, reqOther)

	if rrOther.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK para outro IP, obteve: %d", rrOther.Code)
	}

	// Usuário autenticado usa UserID como chave de rate limiting
	ctx := context.WithValue(context.Background(), middleware.UserIDKey, "user-vip-1")
	reqUser := httptest.NewRequest(http.MethodGet, "/test", nil).WithContext(ctx)
	reqUser.RemoteAddr = "192.168.1.100:12345" // mesmo IP bloqueado antes, mas é usuário autenticado
	rrUser := httptest.NewRecorder()
	handler.ServeHTTP(rrUser, reqUser)

	if rrUser.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK para novo UserID isolado, obteve: %d", rrUser.Code)
	}
}
