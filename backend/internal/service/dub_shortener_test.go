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

func TestDubShortenerService_ConflictRetryWithoutKeySuccess(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		var req map[string]string
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req["key"] != "" {
			// Simula conflito de key existente na plataforma Dub
			w.WriteHeader(http.StatusConflict)
			_, _ = w.Write([]byte(`{"error":{"message":"Key is already taken"}}`))
			return
		}
		// Segunda chamada sem key gera slug automático com sucesso
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"shortLink": "https://dub.sh/random123",
		})
	}))
	defer server.Close()

	shortener := service.NewDubShortenerService("dub_token_123", "http://localhost:8080")
	shortener.SetEndpoint(server.URL)

	targetURL := "http://localhost:8080/book/andre/call"
	link, err := shortener.ShortenLink(context.Background(), targetURL, "andre-call")
	if err != nil {
		t.Fatalf("não esperava erro: %v", err)
	}
	if link != "https://dub.sh/random123" {
		t.Errorf("esperado link com retry automático https://dub.sh/random123, obteve %q", link)
	}
	if attempts != 2 {
		t.Errorf("esperadas 2 tentativas (1 com key, 1 sem key), obteve %d", attempts)
	}
}

func TestDubShortenerService_CustomDomain(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var req map[string]string
		_ = json.NewDecoder(r.Body).Decode(&req)
		if req["domain"] != "links.meudominio.com" {
			http.Error(w, "missing or wrong domain", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"shortLink": "https://links.meudominio.com/call",
		})
	}))
	defer server.Close()

	shortener := service.NewDubShortenerService("dub_token_123", "http://localhost:8080")
	shortener.SetEndpoint(server.URL)
	shortener.SetDomain("links.meudominio.com")

	targetURL := "http://localhost:8080/book/andre/call"
	link, err := shortener.ShortenLink(context.Background(), targetURL, "call")
	if err != nil {
		t.Fatalf("não esperava erro: %v", err)
	}
	if link != "https://links.meudominio.com/call" {
		t.Errorf("esperado link custom domain, obteve %q", link)
	}
}
