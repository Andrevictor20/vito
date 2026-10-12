package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/service"
)

func TestShortIoShortenerService_NoApiKeyFallback(t *testing.T) {
	shortener := service.NewShortIoShortenerService("", "link.vito.cloud", "https://vito.rasppi.cloud")
	targetURL := "https://vito.rasppi.cloud/book/andre/call"

	link, err := shortener.ShortenLink(context.Background(), targetURL, "andre-call")
	if err != nil {
		t.Fatalf("não esperava erro com fallback sem chave: %v", err)
	}
	if link != targetURL {
		t.Errorf("esperado link canônico original %q, obteve %q", targetURL, link)
	}
}

func TestShortIoShortenerService_SuccessWithApi(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "shortio_secret_123" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		if r.Header.Get("Content-Type") != "application/json" {
			http.Error(w, "invalid content type", http.StatusBadRequest)
			return
		}

		var req map[string]string
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		if req["domain"] != "link.vito.cloud" {
			http.Error(w, "domain incorreto", http.StatusBadRequest)
			return
		}
		if req["path"] != "andre-call" {
			http.Error(w, "path incorreto", http.StatusBadRequest)
			return
		}
		if req["originalURL"] != "https://vito.rasppi.cloud/book/andre/call" {
			http.Error(w, "originalURL incorreto", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"idString":    "lnk_abc123",
			"shortURL":    "https://link.vito.cloud/andre-call",
			"originalURL": req["originalURL"],
			"path":        "andre-call",
		})
	}))
	defer server.Close()

	shortener := service.NewShortIoShortenerService("shortio_secret_123", "link.vito.cloud", "https://vito.rasppi.cloud")
	shortener.SetEndpoint(server.URL)

	targetURL := "https://vito.rasppi.cloud/book/andre/call"
	link, err := shortener.ShortenLink(context.Background(), targetURL, "andre-call")
	if err != nil {
		t.Fatalf("esperava sucesso no encurtamento: %v", err)
	}
	if link != "https://link.vito.cloud/andre-call" {
		t.Errorf("esperado link encurtado https://link.vito.cloud/andre-call, obteve %q", link)
	}
}

func TestShortIoShortenerService_HttpErrorGracefulFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "rate limited", http.StatusTooManyRequests)
	}))
	defer server.Close()

	shortener := service.NewShortIoShortenerService("shortio_secret_123", "link.vito.cloud", "https://vito.rasppi.cloud")
	shortener.SetEndpoint(server.URL)

	targetURL := "https://vito.rasppi.cloud/book/andre/call"
	link, err := shortener.ShortenLink(context.Background(), targetURL, "andre-call")
	if err != nil {
		t.Fatalf("não deve propagar erro que quebre a chamada: %v", err)
	}
	if link != targetURL {
		t.Errorf("esperado fallback para a URL canônica %q, obteve %q", targetURL, link)
	}
}

func TestShortIoShortenerService_ConflictRetryWithoutPathSuccess(t *testing.T) {
	attempt := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempt++
		var req map[string]string
		_ = json.NewDecoder(r.Body).Decode(&req)

		if attempt == 1 {
			// Simula conflito de slug (path) duplicado no Short.io
			w.WriteHeader(http.StatusConflict)
			_ = json.NewEncoder(w).Encode(map[string]any{
				"error": "Slug already exists",
			})
			return
		}

		// Segunda tentativa (sem path especificado) deve ser aceita gerando slug aleatório
		if req["path"] != "" {
			http.Error(w, "esperado path vazio no retry", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"idString": "lnk_random789",
			"shortURL": "https://link.vito.cloud/random789",
		})
	}))
	defer server.Close()

	shortener := service.NewShortIoShortenerService("shortio_secret_123", "link.vito.cloud", "https://vito.rasppi.cloud")
	shortener.SetEndpoint(server.URL)

	targetURL := "https://vito.rasppi.cloud/book/andre/call"
	link, err := shortener.ShortenLink(context.Background(), targetURL, "andre-call")
	if err != nil {
		t.Fatalf("esperava sucesso no retry: %v", err)
	}
	if link != "https://link.vito.cloud/random789" {
		t.Errorf("esperado link com retry automático https://link.vito.cloud/random789, obteve %q", link)
	}
}

func TestShortIoShortenerService_TimeoutGracefulFallback(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond)
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	shortener := service.NewShortIoShortenerService("shortio_secret_123", "link.vito.cloud", "https://vito.rasppi.cloud")
	shortener.SetEndpoint(server.URL)
	shortener.SetTimeout(20 * time.Millisecond) // Timeout curto para simular perda de resposta

	targetURL := "https://vito.rasppi.cloud/book/andre/call"
	link, err := shortener.ShortenLink(context.Background(), targetURL, "andre-call")
	if err != nil {
		t.Fatalf("não deve falhar com erro fatal em timeout: %v", err)
	}
	if link != targetURL {
		t.Errorf("esperado fallback em timeout para %q, obteve %q", targetURL, link)
	}
}
