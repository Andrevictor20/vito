package server_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/server"
)

func preflight(t *testing.T, srv *server.Server, origin string) *httptest.ResponseRecorder {
	t.Helper()
	req := httptest.NewRequest(http.MethodOptions, "/api/v1/todos", nil)
	req.Header.Set("Origin", origin)
	req.Header.Set("Access-Control-Request-Method", "GET")
	rec := httptest.NewRecorder()
	srv.Router().ServeHTTP(rec, req)
	return rec
}

// SEC-03: em produção sem origens configuradas, nada de wildcard (fail-closed).
func TestCORS_ProductionEmptyOriginsDeniesWildcard(t *testing.T) {
	srv := server.New(server.Config{Environment: "production"})
	rec := preflight(t, srv, "http://localhost:8081")
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got == "*" {
		t.Errorf("produção sem origens não deve responder wildcard, veio %q", got)
	}
}

// Fora de produção, lista vazia mantém o comportamento aberto de dev/testes.
func TestCORS_DevelopmentEmptyOriginsAllowsWildcard(t *testing.T) {
	srv := server.New(server.Config{Environment: "development"})
	rec := preflight(t, srv, "http://localhost:8081")
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "*" {
		t.Errorf("dev sem origens deveria responder wildcard, veio %q", got)
	}
}

// Origem explícita é refletida (caso do localhost:8081 do notebook).
func TestCORS_ExplicitOriginIsReflected(t *testing.T) {
	srv := server.New(server.Config{
		Environment:    "production",
		AllowedOrigins: []string{"https://vito.rasppi.cloud", "http://localhost:8081"},
	})
	rec := preflight(t, srv, "http://localhost:8081")
	if got := rec.Header().Get("Access-Control-Allow-Origin"); got != "http://localhost:8081" {
		t.Errorf("origem explícita deveria ser refletida, veio %q", got)
	}
}
