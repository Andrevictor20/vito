package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBodyLimitMiddleware_AllowsSmallJSON(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/todos", bytes.NewReader([]byte(`{"title":"x"}`)))
	rec := httptest.NewRecorder()
	BodyLimitMiddleware(next).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("esperava 200, veio %d", rec.Code)
	}
}

func TestBodyLimitMiddleware_BlocksOversizedByLength(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/todos", bytes.NewReader(make([]byte, 16)))
	req.ContentLength = DefaultBodyLimitBytes + 1
	rec := httptest.NewRecorder()
	BodyLimitMiddleware(next).ServeHTTP(rec, req)
	if rec.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("esperava 413, veio %d", rec.Code)
	}
}

func TestBodyLimitMiddleware_AllowsLargeAudio(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	req := httptest.NewRequest(http.MethodPost, "/api/v1/assistant/audio", bytes.NewReader([]byte(`{}`)))
	req.ContentLength = DefaultBodyLimitBytes + 1
	rec := httptest.NewRecorder()
	BodyLimitMiddleware(next).ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("áudio deveria aceitar acima de 1MB, veio %d", rec.Code)
	}
}
