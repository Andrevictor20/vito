package calendar_test

import (
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/integrations/calendar"
)

func TestFormatEventToICal(t *testing.T) {
	startAt := time.Date(2026, 10, 5, 14, 0, 0, 0, time.UTC)
	endAt := time.Date(2026, 10, 5, 15, 30, 0, 0, time.UTC)

	event := &domain.Event{
		ID:          "vito-evt-123",
		Title:       "Reunião de Planejamento",
		Description: "Alinhar backlog da sprint 5",
		Location:    "Sala 402",
		StartAt:     startAt,
		EndAt:       endAt,
	}

	ical := calendar.FormatEventToICal(event, "apple-uid-999")

	if !strings.Contains(ical, "BEGIN:VCALENDAR") || !strings.Contains(ical, "END:VCALENDAR") {
		t.Fatalf("estrutura VCALENDAR inválida:\n%s", ical)
	}
	if !strings.Contains(ical, "UID:apple-uid-999") {
		t.Fatalf("esperava UID:apple-uid-999, não encontrado:\n%s", ical)
	}
	if !strings.Contains(ical, "SUMMARY:Reunião de Planejamento") {
		t.Fatalf("SUMMARY não encontrado:\n%s", ical)
	}
	if !strings.Contains(ical, "DTSTART:20261005T140000Z") {
		t.Fatalf("DTSTART formatado incorretamente:\n%s", ical)
	}
	if !strings.Contains(ical, "DTEND:20261005T153000Z") {
		t.Fatalf("DTEND formatado incorretamente:\n%s", ical)
	}
}

func TestParseICalToSyncItems_Success(t *testing.T) {
	rawICal := `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Apple Inc.//macOS 15.0//EN
BEGIN:VEVENT
UID:icloud-event-887766
DTSTAMP:20261003T100000Z
DTSTART:20261006T090000Z
DTEND:20261006T100000Z
SUMMARY:Consulta Médica
DESCRIPTION:Dra. Ana Paula - Checkup anual
LOCATION:Av. Paulista 1000
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`

	items, err := calendar.ParseICalToSyncItems(rawICal)
	if err != nil {
		t.Fatalf("falha no parse iCal: %v", err)
	}

	if len(items) != 1 {
		t.Fatalf("esperava 1 item, obteve %d", len(items))
	}

	item := items[0]
	if item.ExternalID != "icloud-event-887766" {
		t.Errorf("UID esperado 'icloud-event-887766', obteve %q", item.ExternalID)
	}
	if item.Title != "Consulta Médica" {
		t.Errorf("Título esperado 'Consulta Médica', obteve %q", item.Title)
	}
	if item.Location != "Av. Paulista 1000" {
		t.Errorf("Local esperado 'Av. Paulista 1000', obteve %q", item.Location)
	}
	if item.Status != "confirmed" {
		t.Errorf("Status esperado 'confirmed', obteve %q", item.Status)
	}

	expectedStart := time.Date(2026, 10, 6, 9, 0, 0, 0, time.UTC)
	if !item.StartAt.Equal(expectedStart) {
		t.Errorf("StartAt esperado %v, obteve %v", expectedStart, item.StartAt)
	}
}

func TestParseICalToSyncItems_CancelledEvent(t *testing.T) {
	rawICal := `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:evt-cancelled-001
SUMMARY:Almoço Cancelado
STATUS:CANCELLED
END:VEVENT
END:VCALENDAR`

	items, err := calendar.ParseICalToSyncItems(rawICal)
	if err != nil {
		t.Fatalf("falha ao parsear evento cancelado: %v", err)
	}

	if len(items) != 1 || items[0].Status != "cancelled" {
		t.Fatalf("esperava status cancelled, obteve: %+v", items)
	}
}
