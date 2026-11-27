package booking_test

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/calendar/booking"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// Mock sync pusher para booking (P1).
type mockBookingPusher struct {
	mu      sync.Mutex
	pushed  []*domain.Event
	deleted []string
}

func (m *mockBookingPusher) PushEvent(ctx context.Context, userID string, event *domain.Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pushed = append(m.pushed, event)
	return nil
}
func (m *mockBookingPusher) DeleteEvent(ctx context.Context, userID, eventID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.deleted = append(m.deleted, eventID)
	return nil
}
func (m *mockBookingPusher) countPushed() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return len(m.pushed)
}
func (m *mockBookingPusher) getDeleted() []string {
	m.mu.Lock()
	defer m.mu.Unlock()
	cp := make([]string, len(m.deleted))
	copy(cp, m.deleted)
	return cp
}

// P1: reserva de booking deve propagar PushEvent para sync total.
func TestBugfix_BookingReserve_PushesToRemote(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()
	pusher := &mockBookingPusher{}
	ctx.bookingSvc.SetSyncPusher(pusher)

	bt := &domain.BookingType{
		ID: "bt-push", UserID: ctx.user.ID, Slug: "push-test",
		Title: "Sync Total", DurationMinutes: 30, BufferMinutes: 0,
		DaysOfWeek: "[1,2,3,4,5,6,7]", StartHour: "09:00", EndHour: "18:00", IsActive: true,
	}
	if err := ctx.bookingRepo.CreateType(bt); err != nil {
		t.Fatalf("create type: %v", err)
	}
	startAt := time.Date(2026, 10, 21, 14, 0, 0, 0, time.UTC)
	req := booking.ReserveRequest{GuestName: "Maria", GuestEmail: "maria@test.com", StartAt: startAt, EndAt: startAt.Add(30 * time.Minute)}
	appt, err := ctx.bookingSvc.ReserveAppointment(context.Background(), ctx.user.ID, bt.Slug, req, "127.0.0.1")
	if err != nil {
		t.Fatalf("reserve: %v", err)
	}
	// Push é async fire-and-forget: aguarda até 2s.
	deadline := time.Now().Add(2 * time.Second)
	for time.Now().Before(deadline) && pusher.countPushed() == 0 {
		time.Sleep(20 * time.Millisecond)
	}
	if pusher.countPushed() != 1 {
		t.Fatalf("esperava 1 PushEvent após reserva, obteve %d", pusher.countPushed())
	}
	pusher.mu.Lock()
	pushedID := pusher.pushed[0].ID
	pusher.mu.Unlock()
	if pushedID != appt.EventID {
		t.Fatalf("push com eventID errado")
	}
	// Cancel deve propagar DeleteEvent.
	if err := ctx.bookingSvc.CancelAppointment(context.Background(), ctx.user.ID, appt.ID); err != nil {
		t.Fatalf("cancel: %v", err)
	}
	del := pusher.getDeleted()
	if len(del) != 1 || del[0] != appt.EventID {
		t.Fatalf("esperava DeleteEvent propagado, obteve %v", del)
	}
}

// P2: feriado/all-day nunca bloqueiam slot de booking.
func TestBugfix_BookingSlot_IgnoresHolidays(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()
	bt := &domain.BookingType{
		ID: "bt-hol", UserID: ctx.user.ID, Slug: "hol-test",
		Title: "Aberta", DurationMinutes: 30, BufferMinutes: 0,
		DaysOfWeek: "[1,2,3,4,5,6,7]", StartHour: "09:00", EndHour: "11:00", IsActive: true,
	}
	if err := ctx.bookingRepo.CreateType(bt); err != nil {
		t.Fatalf("create: %v", err)
	}
	targetDate := time.Date(2026, 12, 25, 0, 0, 0, 0, time.UTC) // Natal (sexta), feriado
	hol := &domain.Event{
		ID: "ev-hol", UserID: ctx.user.ID, Title: "Natal", Category: "holiday",
		StartAt:   time.Date(2026, 12, 25, 0, 0, 0, 0, time.UTC),
		EndAt:     time.Date(2026, 12, 26, 0, 0, 0, 0, time.UTC),
		CreatedAt: time.Now().UTC(), UpdatedAt: time.Now().UTC(),
	}
	if err := ctx.eventRepo.Create(hol); err != nil {
		t.Fatalf("seed holiday: %v", err)
	}
	slots, err := ctx.bookingSvc.GetAvailableSlots(context.Background(), ctx.user.ID, bt.Slug, targetDate)
	if err != nil {
		t.Fatalf("slots: %v", err)
	}
	avail := 0
	for _, s := range slots {
		if s.Available {
			avail++
		}
	}
	if avail == 0 {
		t.Fatalf("feriado bloqueou todos os slots; esperado slots livres em 25/12")
	}
}

// P2: default de DaysOfWeek deve ser 7 dias.
func TestBugfix_BookingDefault_SevenDays(t *testing.T) {
	ctx := setupBookingTest(t)
	defer ctx.db.Close()
	out, err := ctx.bookingSvc.CreateBookingType(context.Background(), ctx.user.ID, &domain.BookingType{
		Slug: "sete-dias", Title: "Sete Dias",
	})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if out.DaysOfWeek != "[1,2,3,4,5,6,7]" {
		t.Fatalf("esperado default 7 dias, obteve %q", out.DaysOfWeek)
	}
}
