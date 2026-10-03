package calendar_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/integrations/calendar"
)

func TestAppleCalDAVProvider_FetchEvents(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		user, pass, ok := r.BasicAuth()
		if !ok || user != "user@icloud.com" || pass != "app-specific-pass" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}

		if r.Method != "REPORT" {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("Content-Type", "application/xml; charset=utf-8")
		w.WriteHeader(207) // Multi-Status
		_, _ = w.Write([]byte(`<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
    <D:response>
        <D:href>/12345/calendars/work/event-apple-1.ics</D:href>
        <D:propstat>
            <D:prop>
                <D:getetag>"apple-etag-1"</D:getetag>
                <C:calendar-data>BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:event-apple-1
SUMMARY:Reunião de Diretoria Apple
DTSTART:20261010T120000Z
DTEND:20261010T130000Z
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR</C:calendar-data>
            </D:prop>
            <D:status>HTTP/1.1 200 OK</D:status>
        </D:propstat>
    </D:response>
</D:multistatus>`))
	}))
	defer ts.Close()

	provider := calendar.NewAppleCalDAVProvider(calendar.AppleCalDAVConfig{
		BaseURL:    ts.URL,
		HTTPClient: ts.Client(),
	})

	creds := `{"username":"user@icloud.com","password":"app-specific-pass"}`
	from := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 10, 30, 0, 0, 0, 0, time.UTC)

	res, err := provider.FetchEvents(context.Background(), creds, "work", "", from, to)
	if err != nil {
		t.Fatalf("falha ao buscar eventos CalDAV: %v", err)
	}

	if len(res.Items) != 1 {
		t.Fatalf("esperava 1 item, obteve %d", len(res.Items))
	}

	item := res.Items[0]
	if item.ExternalID != "event-apple-1" || item.Title != "Reunião de Diretoria Apple" {
		t.Errorf("evento Apple divergente: %+v", item)
	}
	if item.ETag != `"apple-etag-1"` {
		t.Errorf("ETag esperado 'apple-etag-1', obteve %q", item.ETag)
	}
}

func TestAppleCalDAVProvider_CreateEvent(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPut {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		if !strings.HasSuffix(r.URL.Path, ".ics") {
			t.Errorf("esperava caminho terminando em .ics, obteve %s", r.URL.Path)
		}

		w.Header().Set("ETag", `"etag-put-apple-99"`)
		w.WriteHeader(http.StatusCreated)
	}))
	defer ts.Close()

	provider := calendar.NewAppleCalDAVProvider(calendar.AppleCalDAVConfig{
		BaseURL:    ts.URL,
		HTTPClient: ts.Client(),
	})

	creds := `{"username":"user@icloud.com","password":"app-specific-pass"}`
	event := &domain.Event{
		Title:   "Jantar Executivo",
		StartAt: time.Date(2026, 10, 15, 20, 0, 0, 0, time.UTC),
		EndAt:   time.Date(2026, 10, 15, 22, 0, 0, 0, time.UTC),
	}

	created, err := provider.CreateEvent(context.Background(), creds, "work", event)
	if err != nil {
		t.Fatalf("falha ao criar evento no CalDAV: %v", err)
	}

	if created.ExternalID == "" {
		t.Errorf("esperava UID gerado para evento Apple")
	}
	if created.ETag != `"etag-put-apple-99"` {
		t.Errorf("ETag retornado incorreto: %q", created.ETag)
	}
}

func TestAppleCalDAVProvider_DeleteEvent(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer ts.Close()

	provider := calendar.NewAppleCalDAVProvider(calendar.AppleCalDAVConfig{
		BaseURL:    ts.URL,
		HTTPClient: ts.Client(),
	})

	creds := `{"username":"user@icloud.com","password":"app-specific-pass"}`
	err := provider.DeleteEvent(context.Background(), creds, "work", "apple-uid-123")
	if err != nil {
		t.Fatalf("falha ao deletar evento CalDAV: %v", err)
	}
}
