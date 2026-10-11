package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/service"
)

func TestDubShortenerService_NoApiKeyFallback(t *testing.T) {
	shortener := service.NewDubShortenerService("", "http://localhost:8080")
	targetURL := "http://localhost:8080/book/andre/call"

	link, err := shortener.ShortenLink(context.Background(), targetURL, "andre-call")
	if err != nil {
		t.Fatalf("não esperava erro com fallback sem chave: %v", err)
	}
	if link != targetURL {
		t.Errorf("esperado link canônico %q, obteve %q", targetURL, link)
	}
}

func TestDubShortenerService_SuccessWithApi(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer dub_token_123" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		var req map[string]string
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req["key"] != "andre-call" {
			http.Error(w, "wrong key", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"shortLink": "https://dub.sh/andre-call",
		})
	}))
	defer server.Close()

	shortener := service.NewDubShortenerService("dub_token_123", "http://localhost:8080")
	shortener.SetEndpoint(server.URL)

	targetURL := "http://localhost:8080/book/andre/call"
	link, err := shortener.ShortenLink(context.Background(), targetURL, "andre-call")
	if err != nil {
		t.Fatalf("esperado sucesso, obteve erro: %v", err)
	}
	if link != "https://dub.sh/andre-call" {
		t.Errorf("esperado link encurtado https://dub.sh/andre-call, obteve %q", link)
	}
}

func TestDubShortenerService_HttpErrorGracefulFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
	}))
	defer server.Close()

	shortener := service.NewDubShortenerService("dub_token_123", "http://localhost:8080")
	shortener.SetEndpoint(server.URL)

	targetURL := "http://localhost:8080/book/andre/call"
	link, err := shortener.ShortenLink(context.Background(), targetURL, "andre-call")
	if err != nil {
		t.Fatalf("não esperava erro de bloqueio: %v", err)
	}
	if link != targetURL {
		t.Errorf("esperado fallback para URL canônica %q, obteve %q", targetURL, link)
	}
}
