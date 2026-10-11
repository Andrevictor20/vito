package repository_test

import (
	"database/sql"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	_ "modernc.org/sqlite"
)

func setupTestBookingDB(t *testing.T) (*sql.DB, *repository.BookingRepositorySQLite, *domain.User) {
	t.Helper()
	db, err := database.Open(":memory:")
	if err != nil {
		t.Fatalf("erro ao abrir sqlite em memória: %v", err)
	}

	userRepo := repository.NewUserRepository(db)
	user := &domain.User{
		ID:           "user-booking-1",
		Name:         "André Victor",
		Email:        "andre@vito.app",
		PasswordHash: "hash123",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("erro ao criar usuário de teste: %v", err)
	}

	repo := repository.NewBookingRepositorySQLite(db)
	return db, repo, user
}

func TestBookingRepository_CreateAndGet(t *testing.T) {
	db, repo, user := setupTestBookingDB(t)
	defer db.Close()

	bt := &domain.BookingType{
		ID:              "type-1",
		UserID:          user.ID,
		Slug:            "reuniao-30m",
		Title:           "Reunião de 30 min",
		Description:     "Alinhamento rápido de projetos",
		DurationMinutes: 30,
		BufferMinutes:   10,
		DaysOfWeek:      "[1,2,3,4,5]",
		StartHour:       "09:00",
		EndHour:         "18:00",
		IsActive:        true,
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
	}

	err := repo.CreateType(bt)
	if err != nil {
		t.Fatalf("CreateType falhou: %v", err)
	}

	got, err := repo.GetTypeByID(bt.ID, user.ID)
	if err != nil {
		t.Fatalf("GetTypeByID falhou: %v", err)
	}
	if got.Title != bt.Title {
		t.Errorf("esperado title %q, obteve %q", bt.Title, got.Title)
	}
	if got.Slug != bt.Slug {
		t.Errorf("esperado slug %q, obteve %q", bt.Slug, got.Slug)
	}

	// Busca por slug
	bySlug, err := repo.GetTypeBySlug(user.ID, "reuniao-30m")
	if err != nil {
		t.Fatalf("GetTypeBySlug falhou: %v", err)
	}
	if bySlug.ID != bt.ID {
		t.Errorf("esperado ID %q, obteve %q", bt.ID, bySlug.ID)
	}
}

func TestBookingRepository_ListAndUpdate(t *testing.T) {
	db, repo, user := setupTestBookingDB(t)
	defer db.Close()

	bt1 := &domain.BookingType{
		ID:              "type-1",
		UserID:          user.ID,
		Slug:            "30m",
		Title:           "30 min",
		DurationMinutes: 30,
		DaysOfWeek:      "[1,2,3]",
		StartHour:       "10:00",
		EndHour:         "17:00",
		IsActive:        true,
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
	}
	bt2 := &domain.BookingType{
		ID:              "type-2",
		UserID:          user.ID,
		Slug:            "60m",
		Title:           "1 hora",
		DurationMinutes: 60,
		DaysOfWeek:      "[1,2,3,4,5]",
		StartHour:       "09:00",
		EndHour:         "18:00",
		IsActive:        false,
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
	}
	_ = repo.CreateType(bt1)
	_ = repo.CreateType(bt2)

	types, err := repo.ListTypesByUser(user.ID)
	if err != nil {
		t.Fatalf("ListTypesByUser falhou: %v", err)
	}
	if len(types) != 2 {
		t.Errorf("esperado 2 types, obteve %d", len(types))
	}

	bt1.Title = "30 min atualizado"
	bt1.IsActive = false
	if err := repo.UpdateType(bt1); err != nil {
		t.Fatalf("UpdateType falhou: %v", err)
	}

	updated, err := repo.GetTypeByID(bt1.ID, user.ID)
	if err != nil {
		t.Fatalf("GetTypeByID falhou: %v", err)
	}
	if updated.Title != "30 min atualizado" || updated.IsActive != false {
		t.Errorf("dados não atualizados corretamente: %+v", updated)
	}

	if err := repo.DeleteType(bt1.ID, user.ID); err != nil {
		t.Fatalf("DeleteType falhou: %v", err)
	}
	_, err = repo.GetTypeByID(bt1.ID, user.ID)
	if err != domain.ErrBookingTypeNotFound {
		t.Errorf("esperado ErrBookingTypeNotFound, obteve %v", err)
	}
}

func TestBookingRepository_AppointmentsAndConflicts(t *testing.T) {
	db, repo, user := setupTestBookingDB(t)
	defer db.Close()

	bt := &domain.BookingType{
		ID:              "type-appt",
		UserID:          user.ID,
		Slug:            "call",
		Title:           "Call",
		DurationMinutes: 30,
		BufferMinutes:   10,
		DaysOfWeek:      "[1,2,3,4,5]",
		StartHour:       "09:00",
		EndHour:         "18:00",
		IsActive:        true,
		CreatedAt:       time.Now().UTC(),
		UpdatedAt:       time.Now().UTC(),
	}
	_ = repo.CreateType(bt)

	startAt := time.Date(2026, 10, 15, 10, 0, 0, 0, time.UTC)
	endAt := startAt.Add(30 * time.Minute)

	appt := &domain.BookingAppointment{
		ID:            "appt-1",
		BookingTypeID: bt.ID,
		UserID:        user.ID,
		GuestName:     "Carlos Teste",
		GuestEmail:    "carlos@email.com",
		GuestNotes:    "Alinhamento",
		StartAt:       startAt,
		EndAt:         endAt,
		Status:        "confirmed",
		CreatedAt:     time.Now().UTC(),
	}

	if err := repo.CreateAppointment(appt); err != nil {
		t.Fatalf("CreateAppointment falhou: %v", err)
	}

	gotAppt, err := repo.GetAppointmentByID(appt.ID, user.ID)
	if err != nil {
		t.Fatalf("GetAppointmentByID falhou: %v", err)
	}
	if gotAppt.GuestName != "Carlos Teste" {
		t.Errorf("esperado Carlos Teste, obteve %q", gotAppt.GuestName)
	}

	// Conflito exato
	hasConflict, err := repo.CheckSlotConflict(user.ID, startAt, endAt, 10)
	if err != nil {
		t.Fatalf("CheckSlotConflict falhou: %v", err)
	}
	if !hasConflict {
		t.Errorf("esperado hasConflict = true para horário ocupado")
	}

	// Conflito por buffer: 10:35 está a 5 min do término de 10:30 (buffer é 10)
	hasConflictBuffer, err := repo.CheckSlotConflict(user.ID, startAt.Add(35*time.Minute), startAt.Add(65*time.Minute), 10)
	if err != nil {
		t.Fatalf("CheckSlotConflict buffer falhou: %v", err)
	}
	if !hasConflictBuffer {
		t.Errorf("esperado hasConflictBuffer = true devido a invasão do buffer")
	}

	// Fora de conflito: 11:00 (30 min após término, buffer de 10 respeitado)
	noConflict, err := repo.CheckSlotConflict(user.ID, startAt.Add(40*time.Minute), startAt.Add(70*time.Minute), 10)
	if err != nil {
		t.Fatalf("CheckSlotConflict livre falhou: %v", err)
	}
	if noConflict {
		t.Errorf("esperado noConflict = false para horário livre com buffer respeitado")
	}
}
