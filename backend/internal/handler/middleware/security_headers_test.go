package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/handler/middleware"
)

func TestSecurityHeadersMiddleware(t *testing.T) {
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware.SecurityHeadersMiddleware(dummyHandler)

	req := httptest.NewRequest("GET", "/healthz", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Header().Get("X-Content-Type-Options") != "nosniff" {
		t.Errorf("esperava X-Content-Type-Options nosniff")
	}
	if rec.Header().Get("X-Frame-Options") != "DENY" {
		t.Errorf("esperava X-Frame-Options DENY")
	}
	if rec.Header().Get("X-XSS-Protection") != "1; mode=block" {
		t.Errorf("esperava X-XSS-Protection 1; mode=block")
	}
	if rec.Header().Get("Referrer-Policy") != "strict-origin-when-cross-origin" {
		t.Errorf("esperava Referrer-Policy strict-origin-when-cross-origin")
	}
}

func TestSecurityHeadersMiddleware_HSTSOnHTTPS(t *testing.T) {
	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	handler := middleware.SecurityHeadersMiddleware(dummyHandler)

	req := httptest.NewRequest("GET", "/healthz", nil)
	req.Header.Set("X-Forwarded-Proto", "https")
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if hsts := rec.Header().Get("Strict-Transport-Security"); hsts == "" {
		t.Errorf("esperava cabeçalho HSTS quando requisição é encaminhada via HTTPS")
	}
}
