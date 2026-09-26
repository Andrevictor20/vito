package server_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/kito/backend/internal/server"
)

func TestHealthCheckEndpoint(t *testing.T) {
	srv := server.New()
	ts := httptest.NewServer(srv.Router())
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/healthz")
	if err != nil {
		t.Fatalf("failed to make GET request: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected status %d, got %d", http.StatusOK, resp.StatusCode)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response JSON: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status 'ok', got '%v'", body["status"])
	}

	if body["service"] != "kito-backend" {
		t.Errorf("expected service 'kito-backend', got '%v'", body["service"])
	}
}
