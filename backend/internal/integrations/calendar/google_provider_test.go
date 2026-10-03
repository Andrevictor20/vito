package calendar_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/integrations/calendar"
)

func TestGoogleProvider_FetchEvents_FullSync(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer test-access-token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		resp := map[string]interface{}{
			"nextSyncToken": "next-sync-tok-123",
			"items": []map[string]interface{}{
				{
					"id":          "gcal-evt-1",
					"etag":        `"etag-001"`,
					"summary":     "Reunião de Diretoria",
					"description": "Alinhamento trimestral",
					"location":    "Sala Executiva",
					"status":      "confirmed",
					"start": map[string]string{
						"dateTime": "2026-10-05T14:00:00Z",
					},
					"end": map[string]string{
						"dateTime": "2026-10-05T15:00:00Z",
					},
				},
			},
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	provider := calendar.NewGoogleProvider(calendar.GoogleConfig{
		BaseURL:    ts.URL,
		HTTPClient: ts.Client(),
	})

	res, err := provider.FetchEvents(context.Background(), "test-access-token", "primary", "", time.Now(), time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("falha ao buscar eventos do Google: %v", err)
	}

	if res.NewSyncToken != "next-sync-tok-123" {
		t.Errorf("esperava syncToken 'next-sync-tok-123', obteve %q", res.NewSyncToken)
	}
	if len(res.Items) != 1 {
		t.Fatalf("esperava 1 item, obteve %d", len(res.Items))
	}

	item := res.Items[0]
	if item.ExternalID != "gcal-evt-1" || item.Title != "Reunião de Diretoria" {
		t.Errorf("dados de evento divergentes: %+v", item)
	}
}

func TestGoogleProvider_FetchEvents_SyncTokenExpired_ReturnsFullSyncReq(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Retorna HTTP 410 Gone quando syncToken expira
		w.WriteHeader(http.StatusGone)
	}))
	defer ts.Close()

	provider := calendar.NewGoogleProvider(calendar.GoogleConfig{
		BaseURL:    ts.URL,
		HTTPClient: ts.Client(),
	})

	res, err := provider.FetchEvents(context.Background(), "token", "primary", "expired-token", time.Now(), time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("não deve retornar erro fatal quando token expira: %v", err)
	}

	if !res.FullSyncReq {
		t.Errorf("esperava FullSyncReq=true para HTTP 410")
	}
}

func TestGoogleProvider_CreateEvent(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		resp := map[string]interface{}{
			"id":      "new-gcal-id-999",
			"etag":    `"etag-created-999"`,
			"summary": "Evento Criado",
			"status":  "confirmed",
		}
		w.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	provider := calendar.NewGoogleProvider(calendar.GoogleConfig{
		BaseURL:    ts.URL,
		HTTPClient: ts.Client(),
	})

	event := &domain.Event{
		Title:   "Evento Criado",
		StartAt: time.Now().UTC(),
		EndAt:   time.Now().Add(time.Hour).UTC(),
	}

	created, err := provider.CreateEvent(context.Background(), "token", "primary", event)
	if err != nil {
		t.Fatalf("falha ao criar evento no Google: %v", err)
	}

	if created.ExternalID != "new-gcal-id-999" || created.ETag != `"etag-created-999"` {
		t.Fatalf("retorno de criação incorreto: %+v", created)
	}
}

func TestGoogleProvider_RefreshToken(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"access_token": "brand-new-access-token",
			"expires_in":   3600,
			"token_type":   "Bearer",
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer ts.Close()

	provider := calendar.NewGoogleProvider(calendar.GoogleConfig{
		AuthURL:      ts.URL,
		ClientID:     "cid",
		ClientSecret: "csec",
		HTTPClient:   ts.Client(),
	})

	newCreds, err := provider.RefreshToken(context.Background(), `{"refresh_token":"valid_refresh_token"}`)
	if err != nil {
		t.Fatalf("falha ao renovar token: %v", err)
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal([]byte(newCreds), &parsed); err != nil {
		t.Fatalf("falha ao decodificar novas credenciais: %v", err)
	}

	if parsed["access_token"] != "brand-new-access-token" {
		t.Errorf("access_token incorreto: %v", parsed["access_token"])
	}
}
