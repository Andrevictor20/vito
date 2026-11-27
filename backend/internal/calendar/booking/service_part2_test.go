package booking_test

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/calendar/booking"
	"net/http"
	"net/http/httptest"
	"net/smtp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
	_ "modernc.org/sqlite"
)

func TestBookingService_ExpiredLinkBlocksAndSweeps(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()

	past := time.Now().UTC().Add(-48 * time.Hour).Truncate(time.Hour)
	yesterday := time.Now().UTC().Add(-24 * time.Hour)
	bt := &domain.BookingType{
		ID: "bt-exp", UserID: ctx.user.ID, Slug: "expirado", Title: "Expirado",
		DurationMinutes: 30, BufferMinutes: 0, DaysOfWeek: "[1,2,3,4,5,6,7]",
		StartHour: "09:00", EndHour: "18:00", IsActive: true,
		ValidFrom: &past, ValidUntil: &yesterday,
	}
	if err := ctx.bookingRepo.CreateType(bt); err != nil {
		t.Fatal(err)
	}

	// Reserva no passado (quando ainda válido) para provar que o passado é mantido.
	pastStart := past.Add(2 * time.Hour)
	pastEv := &domain.Event{
		ID: "ev-past", UserID: ctx.user.ID, Title: "Reunião com Paulo (Expirado)",
		StartAt: pastStart, EndAt: pastStart.Add(30 * time.Minute),
		CreatedAt: past, UpdatedAt: past,
	}
	if err := ctx.eventRepo.Create(pastEv); err != nil {
		t.Fatal(err)
	}
	pastAppt := &domain.BookingAppointment{
		ID: "appt-past", BookingTypeID: bt.ID, UserID: ctx.user.ID,
		GuestName: "Paulo", GuestEmail: "paulo@test.com",
		StartAt: pastStart, EndAt: pastStart.Add(30 * time.Minute),
		Status: "confirmed", EventID: pastEv.ID, CreatedAt: past,
	}
	if err := ctx.bookingRepo.CreateAppointment(pastAppt); err != nil {
		t.Fatal(err)
	}

	// Reserva futura no mesmo link (ainda não varrido).
	futureStart := time.Now().UTC().Add(24 * time.Hour).Truncate(time.Hour)
	futureEv := &domain.Event{
		ID: "ev-future", UserID: ctx.user.ID, Title: "Reunião com Ana (Expirado)",
		StartAt: futureStart, EndAt: futureStart.Add(30 * time.Minute),
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	if err := ctx.eventRepo.Create(futureEv); err != nil {
		t.Fatal(err)
	}
	futureAppt := &domain.BookingAppointment{
		ID: "appt-future", BookingTypeID: bt.ID, UserID: ctx.user.ID,
		GuestName: "Ana", GuestEmail: "ana@test.com",
		StartAt: futureStart, EndAt: futureStart.Add(30 * time.Minute),
		Status: "confirmed", EventID: futureEv.ID, CreatedAt: time.Now().UTC(),
	}
	if err := ctx.bookingRepo.CreateAppointment(futureAppt); err != nil {
		t.Fatal(err)
	}

	// 1. Sem slots em link vencido.
	if _, err := ctx.bookingSvc.GetAvailableSlots(context.Background(), ctx.user.ID, bt.Slug, time.Now().UTC()); !errors.Is(err, domain.ErrBookingExpired) {
		t.Errorf("slots em link vencido deveriam dar ErrBookingExpired, veio %v", err)
	}

	// 2. Sem reserva em link vencido.
	req := booking.ReserveRequest{
		GuestName: "Novo", GuestEmail: "novo@test.com",
		StartAt: futureStart, EndAt: futureStart.Add(30 * time.Minute),
	}
	if _, err := ctx.bookingSvc.ReserveAppointment(context.Background(), ctx.user.ID, bt.Slug, req, "127.0.0.1"); !errors.Is(err, domain.ErrBookingExpired) {
		t.Errorf("reserva em link vencido deveria dar ErrBookingExpired, veio %v", err)
	}

	// 3. Listagem varre: link some, futuro removido da agenda, passado mantido.
	types, err := ctx.bookingSvc.ListBookingTypes(context.Background(), ctx.user.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, tp := range types {
		if tp.ID == bt.ID {
			t.Errorf("link vencido deveria ter sido auto-apagado na listagem")
		}
	}
	if _, err := ctx.eventRepo.GetByID(futureEv.ID, ctx.user.ID); err == nil {
		t.Errorf("evento futuro do link expirado deveria ter saído da agenda")
	}
	if _, err := ctx.eventRepo.GetByID(pastEv.ID, ctx.user.ID); err != nil {
		t.Errorf("evento passado deveria ter sido mantido na agenda: %v", err)
	}
}

// Datas específicas: só os dias listados aceitam reserva.
func TestBookingService_AllowedDatesRestrictSlots(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()

	day := time.Now().UTC().Add(72 * time.Hour)
	other := time.Now().UTC().Add(96 * time.Hour)
	allowed, _ := json.Marshal([]string{day.Format("2006-01-02")})
	bt := &domain.BookingType{
		ID: "bt-dates", UserID: ctx.user.ID, Slug: "datas", Title: "Datas",
		DurationMinutes: 30, BufferMinutes: 0, DaysOfWeek: "[1,2,3,4,5,6,7]",
		StartHour: "00:00", EndHour: "23:30", IsActive: true,
		AllowedDates: string(allowed),
	}
	if err := ctx.bookingRepo.CreateType(bt); err != nil {
		t.Fatal(err)
	}

	slots, err := ctx.bookingSvc.GetAvailableSlots(context.Background(), ctx.user.ID, bt.Slug, other)
	if err != nil {
		t.Fatal(err)
	}
	for _, s := range slots {
		if s.Available {
			t.Errorf("dia fora de allowed_dates não deveria ter slot livre: %s", s.TimeLabel)
		}
	}
	slots, err = ctx.bookingSvc.GetAvailableSlots(context.Background(), ctx.user.ID, bt.Slug, day)
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, s := range slots {
		if s.Available {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("dia em allowed_dates deveria ter slots livres")
	}
}

// Reserva de booking deve disparar push com quem agendou, comentário e dia/horário.
func TestBookingService_ReserveAppointment_SendsPushWithGuestNotes(t *testing.T) {
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := calendar.NewEventRepository(db)
	bookingRepo := booking.NewBookingRepositorySQLite(db)
	tokenRepo := repository.NewDeviceTokenRepository(db)

	host := &domain.User{
		ID: "user-booking-push", Name: "André Victor", Email: "andre@push.local",
		PasswordHash: "h", CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(host); err != nil {
		t.Fatal(err)
	}

	var received []service.PushMessage
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var msgs []service.PushMessage
		if err := json.NewDecoder(r.Body).Decode(&msgs); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		received = msgs
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"data":[{"status":"ok"}]}`))
	}))
	defer ts.Close()

	notifSvc := service.NewNotificationService(tokenRepo, ts.Client())
	notifSvc.SetExpoAPIURL(ts.URL)
	if _, err := notifSvc.RegisterDeviceToken(host.ID, "ExponentPushToken[booking-test]", "android"); err != nil {
		t.Fatal(err)
	}

	bookingSvc := booking.NewBookingService(
		bookingRepo, eventRepo, userRepo, notifSvc,
		service.NewShortIoShortenerService("", "", "http://localhost:8080"),
		service.NewTurnstileValidator(""),
		"http://localhost:8080",
	)

	bt := &domain.BookingType{
		ID: "bt-push", UserID: host.ID, Slug: "alinhamento", Title: "Alinhamento",
		DurationMinutes: 30, BufferMinutes: 0, DaysOfWeek: "[1,2,3,4,5,6,7]",
		StartHour: "09:00", EndHour: "18:00", IsActive: true,
	}
	if err := bookingRepo.CreateType(bt); err != nil {
		t.Fatal(err)
	}

	startAt := time.Date(2026, 10, 21, 14, 0, 0, 0, time.UTC)
	req := booking.ReserveRequest{
		GuestName:  "Maria Silva",
		GuestEmail: "maria@test.com",
		GuestNotes: "Tragam o contrato.",
		StartAt:    startAt,
		EndAt:      startAt.Add(30 * time.Minute),
	}
	if _, err := bookingSvc.ReserveAppointment(context.Background(), host.ID, bt.Slug, req, "127.0.0.1"); err != nil {
		t.Fatalf("ReserveAppointment falhou: %v", err)
	}

	if len(received) != 1 {
		t.Fatalf("esperado 1 push de aceite, obteve %d", len(received))
	}
	msg := received[0]
	if msg.ChannelID != "vito_booking" {
		t.Errorf("esperado canal vito_booking, obteve %q", msg.ChannelID)
	}
	if msg.Data["type"] != "booking_appointment" {
		t.Errorf("push deveria carregar type=booking_appointment: %+v", msg.Data)
	}
	for _, want := range []string{"Maria Silva", "Alinhamento", "21/10/2026", "14:00", "Tragam o contrato."} {
		if !strings.Contains(msg.Title+" "+msg.Body, want) {
			t.Errorf("push deveria conter %q (título=%q corpo=%q)", want, msg.Title, msg.Body)
		}
	}
}

type mockBookingEmailSender struct {
	mu      sync.Mutex
	sentTo  []string
	sentMsg []byte
}

func (m *mockBookingEmailSender) SendMail(addr string, a smtp.Auth, from string, to []string, msg []byte) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sentTo = to
	m.sentMsg = msg
	return nil
}

func (m *mockBookingEmailSender) getSent() ([]string, []byte) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.sentTo, m.sentMsg
}

func TestBookingService_ReserveAppointment_SendsEmailNotification(t *testing.T) {
	tc := setupBookingTest(t)
	defer tc.db.Close()

	mockSender := &mockBookingEmailSender{}
	emailSvc := service.NewEmailService("smtp.gmail.com", 587, "vito@gmail.com", "pass123", "Vito <vito@gmail.com>", mockSender)
	tc.bookingSvc.SetEmailService(emailSvc)

	bt := &domain.BookingType{
		ID: "bt-email-test", UserID: tc.user.ID, Slug: "consultoria", Title: "Consultoria Técnica",
		DurationMinutes: 60, DaysOfWeek: "[1,2,3,4,5]", StartHour: "09:00", EndHour: "18:00", IsActive: true,
	}
	if err := tc.bookingRepo.CreateType(bt); err != nil {
		t.Fatal(err)
	}

	startAt := time.Date(2026, 10, 22, 10, 0, 0, 0, time.UTC)
	req := booking.ReserveRequest{
		GuestName:  "Juliana Mendes",
		GuestEmail: "juliana@cliente.com",
		StartAt:    startAt,
		EndAt:      startAt.Add(time.Hour),
	}

	_, err := tc.bookingSvc.ReserveAppointment(context.Background(), tc.user.ID, bt.Slug, req, "127.0.0.1")
	if err != nil {
		t.Fatalf("ReserveAppointment falhou: %v", err)
	}

	time.Sleep(50 * time.Millisecond)

	sentTo, sentMsg := mockSender.getSent()
	if len(sentTo) != 1 || sentTo[0] != "juliana@cliente.com" {
		t.Fatalf("esperado e-mail para juliana@cliente.com, obteve %v", sentTo)
	}
	if !strings.Contains(string(sentMsg), "text/calendar") {
		t.Errorf("e-mail deveria conter anexo de calendário .ics")
	}
}
