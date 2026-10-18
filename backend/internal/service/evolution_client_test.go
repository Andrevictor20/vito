package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/service"
)

func TestEvolutionClient_GetPairingCode_DirectGET(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/instance/connect/test_inst" && r.URL.Query().Get("number") == "559884417165" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"pairingCode": "ABCD-1234",
				"count":       1,
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := service.NewDefaultEvolutionClient(server.URL, "test_api_key", server.Client())
	code, err := client.GetPairingCode(context.Background(), "test_inst", "559884417165")
	if err != nil {
		t.Fatalf("esperava sucesso, obteve erro: %v", err)
	}
	if code != "ABCD-1234" {
		t.Fatalf("esperava ABCD-1234, obteve %s", code)
	}
}

func TestEvolutionClient_GetPairingCode_FallbackToPOSTConnect(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet && r.URL.Path == "/instance/connect/test_inst" {
			// Simula o bug de count: 0 da Evolution API v2
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"count":0}`))
			return
		}
		if r.Method == http.MethodPost && r.URL.Path == "/instance/connect/test_inst" {
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["number"] == "559884417165" {
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(map[string]interface{}{
					"pairingCode": "POST-5678",
					"count":       1,
				})
				return
			}
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := service.NewDefaultEvolutionClient(server.URL, "test_api_key", server.Client())
	code, err := client.GetPairingCode(context.Background(), "test_inst", "559884417165")
	if err != nil {
		t.Fatalf("esperava sucesso no fallback POST, obteve erro: %v", err)
	}
	if code != "POST-5678" {
		t.Fatalf("esperava POST-5678, obteve %s", code)
	}
}

func TestEvolutionClient_GetPairingCode_FallbackToPairEndpoint(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/instance/connect/test_inst" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"count":0}`))
			return
		}
		if r.Method == http.MethodPost && r.URL.Path == "/instance/pair/test_inst" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"code":  "PAIR-9999",
				"count": 1,
			})
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := service.NewDefaultEvolutionClient(server.URL, "test_api_key", server.Client())
	code, err := client.GetPairingCode(context.Background(), "test_inst", "559884417165")
	if err != nil {
		t.Fatalf("esperava sucesso no fallback pair, obteve erro: %v", err)
	}
	if code != "PAIR-9999" {
		t.Fatalf("esperava PAIR-9999, obteve %s", code)
	}
}

func TestEvolutionClient_DeleteInstance(t *testing.T) {
	var deleteCalled bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete && r.URL.Path == "/instance/delete/test_inst" {
			deleteCalled = true
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(`{"status":"SUCCESS"}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := service.NewDefaultEvolutionClient(server.URL, "test_api_key", server.Client())
	err := client.DeleteInstance(context.Background(), "test_inst")
	if err != nil {
		t.Fatalf("esperava sucesso no delete, obteve: %v", err)
	}
	if !deleteCalled {
		t.Fatalf("esperava que DELETE /instance/delete/test_inst fosse chamado")
	}
}

func TestEvolutionClient_SetSettings(t *testing.T) {
	var settingsCalled bool
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/settings/set/test_inst" {
			settingsCalled = true
			var body map[string]interface{}
			_ = json.NewDecoder(r.Body).Decode(&body)
			if body["syncFullHistory"] == false {
				w.WriteHeader(http.StatusOK)
				_, _ = w.Write([]byte(`{"status":"SUCCESS"}`))
				return
			}
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := service.NewDefaultEvolutionClient(server.URL, "test_api_key", server.Client())
	err := client.SetSettings(context.Background(), "test_inst", map[string]interface{}{
		"syncFullHistory": false,
	})
	if err != nil {
		t.Fatalf("esperava sucesso no SetSettings, obteve: %v", err)
	}
	if !settingsCalled {
		t.Fatalf("esperava que POST /settings/set/test_inst fosse chamado com syncFullHistory=false")
	}
}
