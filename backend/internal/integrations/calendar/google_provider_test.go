package calendar_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
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

func TestGoogleProvider_FetchEvents_DateFormats(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"items": []map[string]interface{}{
				{
					"id":      "evt-millis",
					"summary": "Evento com Milissegundos",
					"status":  "confirmed",
					"start": map[string]string{
						"dateTime": "2026-10-05T14:00:00.000-03:00",
					},
					"end": map[string]string{
						"dateTime": "2026-10-05T15:00:00.000-03:00",
					},
				},
				{
					"id":      "evt-allday",
					"summary": "Evento Dia Inteiro",
					"status":  "confirmed",
					"start": map[string]string{
						"date": "2026-10-06",
					},
					"end": map[string]string{
						"date": "2026-10-07",
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

	res, err := provider.FetchEvents(context.Background(), "token", "primary", "", time.Now(), time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("fetch events failed: %v", err)
	}

	for _, item := range res.Items {
		if item.StartAt.IsZero() {
			t.Errorf("item %s StartAt is zero! Date was not parsed properly", item.ExternalID)
		}
	}
}

func TestGoogleProvider_FetchEvents_QueryParametersAndSingleEvents(t *testing.T) {
	var capturedQueryParams string
	var calendarListCalled bool

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/calendar/v3/users/me/calendarList" {
			calendarListCalled = true
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{"id": "primary", "primary": true, "summary": "Principal"},
					{"id": "secondary-cal-id@group.calendar.google.com", "summary": "Aulas da Faculdade", "backgroundColor": "#8E24AA"},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}

		if r.URL.Path == "/calendar/v3/calendars/primary/events" {
			capturedQueryParams = r.URL.RawQuery
			resp := map[string]interface{}{
				"items": []map[string]interface{}{
					{
						"id":      "evt-single-1",
						"summary": "Aula Recorrente Expandida",
						"status":  "confirmed",
						"start": map[string]string{
							"dateTime": "2026-10-04T10:00:00Z",
						},
						"end": map[string]string{
							"dateTime": "2026-10-04T11:00:00Z",
						},
					},
				},
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(resp)
			return
		}

		// Secondary calendar
		resp := map[string]interface{}{
			"items": []map[string]interface{}{
				{
					"id":      "evt-secondary-1",
					"summary": "Prova Bimestral",
					"status":  "confirmed",
					"start": map[string]string{
						"dateTime": "2026-10-08T14:00:00Z",
					},
					"end": map[string]string{
						"dateTime": "2026-10-08T16:00:00Z",
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

	from := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 10, 31, 23, 59, 59, 0, time.UTC)

	res, err := provider.FetchEvents(context.Background(), "token", "primary", "", from, to)
	if err != nil {
		t.Fatalf("fetch events failed: %v", err)
	}

	if !calendarListCalled {
		t.Errorf("esperava que calendarList fosse consultado para descobrir agendas do usuário")
	}

	// Verifica se os parâmetros padrão do Google Calendar e Noctalia v5 estão presentes
	if !strings.Contains(capturedQueryParams, "singleEvents=true") {
		t.Errorf("esperava singleEvents=true na query, obteve: %s", capturedQueryParams)
	}
	if !strings.Contains(capturedQueryParams, "orderBy=startTime") {
		t.Errorf("esperava orderBy=startTime na query, obteve: %s", capturedQueryParams)
	}
	if !strings.Contains(capturedQueryParams, "maxResults=2500") {
		t.Errorf("esperava maxResults=2500 na query, obteve: %s", capturedQueryParams)
	}

	// Verifica se ambos os eventos (primário e da agenda secundária) foram agregados
	if len(res.Items) != 2 {
		t.Fatalf("esperava 2 eventos de múltiplas agendas, obteve %d", len(res.Items))
	}
}

func TestGoogleProvider_FetchEvents_AllDayExclusiveEnd(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		resp := map[string]interface{}{
			"items": []map[string]interface{}{
				{
					"id":      "evt-allday-oct4",
					"summary": "Evento de Dia Inteiro no Domingo",
					"status":  "confirmed",
					"start": map[string]string{
						"date": "2026-10-04",
					},
					"end": map[string]string{
						"date": "2026-10-05", // Google end.date é exclusivo (termina em 04/10 às 23:59:59)
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

	res, err := provider.FetchEvents(context.Background(), "token", "single-cal", "", time.Now(), time.Now().Add(24*time.Hour))
	if err != nil {
		t.Fatalf("fetch events failed: %v", err)
	}

	if len(res.Items) != 1 {
		t.Fatalf("esperava 1 item, obteve %d", len(res.Items))
	}

	item := res.Items[0]
	if !item.IsAllDay {
		t.Errorf("esperava IsAllDay=true")
	}

	// O evento deve começar e terminar no mesmo dia civil (2026-10-04)
	if item.StartAt.Day() != 4 || item.EndAt.Day() != 4 {
		t.Errorf("evento de dia inteiro deve pertencer a 04/10, mas obteve Start=%v End=%v", item.StartAt, item.EndAt)
	}
}

func TestGoogleProvider_CreateUpdateDelete_EscapedCalendarID(t *testing.T) {
	var capturedCreatePath, capturedUpdatePath, capturedDeletePath string
	var capturedCreatePayload map[string]interface{}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			capturedCreatePath = r.RequestURI
			_ = json.NewDecoder(r.Body).Decode(&capturedCreatePayload)
			w.WriteHeader(http.StatusCreated)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":     "created-123",
				"etag":   `"etag-123"`,
				"status": "confirmed",
			})
		case http.MethodPatch:
			capturedUpdatePath = r.RequestURI
			w.WriteHeader(http.StatusOK)
			_ = json.NewEncoder(w).Encode(map[string]interface{}{
				"id":     "updated-123",
				"etag":   `"etag-updated-123"`,
				"status": "confirmed",
			})
		case http.MethodDelete:
			capturedDeletePath = r.RequestURI
			w.WriteHeader(http.StatusNoContent)
		default:
			w.WriteHeader(http.StatusMethodNotAllowed)
		}
	}))
	defer ts.Close()

	provider := calendar.NewGoogleProvider(calendar.GoogleConfig{
		BaseURL:    ts.URL,
		HTTPClient: ts.Client(),
	})

	now := time.Now().UTC()
	// Evento com EndAt igual ou anterior a StartAt para validar ajuste defensivo
	event := &domain.Event{
		Title:   "Almoço Executivo",
		StartAt: now,
		EndAt:   now, // Deve ser ajustado automaticamente para now + 1h
	}

	calID := "andrevictor20@gmail.com"
	created, err := provider.CreateEvent(context.Background(), "token", calID, event)
	if err != nil {
		t.Fatalf("CreateEvent falhou: %v", err)
	}
	if created.ExternalID != "created-123" {
		t.Errorf("ID inesperado: %s", created.ExternalID)
	}

	expectedPath := "/calendar/v3/calendars/andrevictor20%40gmail.com/events"
	if capturedCreatePath != expectedPath {
		t.Errorf("Path do CreateEvent incorreto: esperava %s, obteve %s", expectedPath, capturedCreatePath)
	}

	// Valida que end.dateTime foi ajustado após start.dateTime
	startStr := capturedCreatePayload["start"].(map[string]interface{})["dateTime"].(string)
	endStr := capturedCreatePayload["end"].(map[string]interface{})["dateTime"].(string)
	tStart, _ := time.Parse(time.RFC3339, startStr)
	tEnd, _ := time.Parse(time.RFC3339, endStr)
	if !tEnd.After(tStart) {
		t.Errorf("esperava tEnd posterior a tStart, mas tStart=%v tEnd=%v", tStart, tEnd)
	}

	// UpdateEvent
	_, err = provider.UpdateEvent(context.Background(), "token", calID, "ext-999", event)
	if err != nil {
		t.Fatalf("UpdateEvent falhou: %v", err)
	}
	expectedUpdatePath := "/calendar/v3/calendars/andrevictor20%40gmail.com/events/ext-999"
	if capturedUpdatePath != expectedUpdatePath {
		t.Errorf("Path do UpdateEvent incorreto: esperava %s, obteve %s", expectedUpdatePath, capturedUpdatePath)
	}

	// DeleteEvent
	err = provider.DeleteEvent(context.Background(), "token", calID, "ext-999")
	if err != nil {
		t.Fatalf("DeleteEvent falhou: %v", err)
	}
	expectedDeletePath := "/calendar/v3/calendars/andrevictor20%40gmail.com/events/ext-999"
	if capturedDeletePath != expectedDeletePath {
		t.Errorf("Path do DeleteEvent incorreto: esperava %s, obteve %s", expectedDeletePath, capturedDeletePath)
	}
}


