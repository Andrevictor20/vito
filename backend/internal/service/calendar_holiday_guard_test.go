package service_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupHolidayGuardTest(t *testing.T) (*service.CalendarService, string) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "test_holiday.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	userID := "user-hol-1"
	now := time.Now().UTC()
	_ = repository.NewUserRepository(db).Create(&domain.User{
		ID: userID, Name: "André", Email: "hol@t.local",
		PasswordHash: "h", CreatedAt: now, UpdatedAt: now,
	})
	eventRepo := repository.NewEventRepository(db)
	seed := func(id, title, category string, start time.Time) {
		t.Helper()
		if err := eventRepo.Create(&domain.Event{
			ID: id, UserID: userID, Title: title, Category: category,
			StartAt: start, EndAt: start.Add(time.Hour),
			CreatedAt: now, UpdatedAt: now,
		}); err != nil {
			t.Fatal(err)
		}
	}
	seed("ev-hol", "Finados", "holiday", time.Date(2026, 11, 2, 3, 0, 0, 0, time.UTC))
	seed("ev-normal", "Dentista", "health", now.Add(2*time.Hour))

	return service.NewCalendarService(eventRepo), userID
}

func TestHolidayGuard_UpdateRefused(t *testing.T) {
	calSvc, userID := setupHolidayGuardTest(t)
	upd := &domain.Event{
		ID: "ev-hol", UserID: userID, Title: "Finados alterado",
		StartAt: time.Date(2026, 11, 2, 3, 0, 0, 0, time.UTC),
		EndAt:   time.Date(2026, 11, 2, 4, 0, 0, 0, time.UTC),
	}
	if _, _, err := calSvc.UpdateEvent(userID, upd, false); err != domain.ErrHolidayReadOnly {
		t.Errorf("update de feriado deveria recusar com ErrHolidayReadOnly, veio %v", err)
	}

	okUpd := &domain.Event{
		ID: "ev-normal", UserID: userID, Title: "Dentista",
		StartAt: time.Now().UTC().Add(2 * time.Hour), EndAt: time.Now().UTC().Add(3 * time.Hour),
	}
	if _, _, err := calSvc.UpdateEvent(userID, okUpd, false); err != nil {
		t.Errorf("update normal não deveria falhar: %v", err)
	}
}

func TestHolidayGuard_DeleteRefused(t *testing.T) {
	calSvc, userID := setupHolidayGuardTest(t)
	if err := calSvc.DeleteEvent("ev-hol", userID); err != domain.ErrHolidayReadOnly {
		t.Errorf("delete de feriado deveria recusar com ErrHolidayReadOnly, veio %v", err)
	}
	if _, err := calSvc.DeleteEventWithOption("ev-hol", userID, false); err != domain.ErrHolidayReadOnly {
		t.Errorf("delete with option de feriado deveria recusar, veio %v", err)
	}
	if err := calSvc.DeleteEvent("ev-normal", userID); err != nil {
		t.Errorf("delete normal não deveria falhar: %v", err)
	}
}

func TestHolidayGuard_ByTitleSkipsHolidays(t *testing.T) {
	calSvc, userID := setupHolidayGuardTest(t)
	if _, err := calSvc.DeleteEventsByTitle(userID, "finados"); err != domain.ErrHolidayReadOnly {
		t.Errorf("delete por título de feriado deveria recusar, veio %v", err)
	}
	now := time.Now().UTC()
	if _, err := calSvc.UpdateEventTimesByTitle(userID, "finados", now, now.Add(time.Hour)); err != domain.ErrHolidayReadOnly {
		t.Errorf("update por título de feriado deveria recusar, veio %v", err)
	}
	if n, err := calSvc.DeleteEventsByTitle(userID, "dentista"); err != nil || n != 1 {
		t.Errorf("delete por título normal deveria remover 1, veio n=%d err=%v", n, err)
	}
}
