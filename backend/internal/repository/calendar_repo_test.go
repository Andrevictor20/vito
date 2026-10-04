package repository_test

import (
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupCalendarTestDB(t *testing.T) (*repository.EventRepositorySQLite, *repository.UserRepositorySQLite, *sql.DB) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_kito_cal.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)

	// Cria usuário base para respeitar chave estrangeira
	_ = userRepo.Create(&domain.User{
		ID:           "user-cal-1",
		Name:         "User Cal",
		Email:        "cal@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	return eventRepo, userRepo, db
}

func TestEventRepository_CreateAndCheckConflict(t *testing.T) {
	eventRepo, _, _ := setupCalendarTestDB(t)

	now := time.Date(2026, 9, 26, 14, 0, 0, 0, time.UTC)

	existingEvent := &domain.Event{
		ID:          "event-1",
		UserID:      "user-cal-1",
		Title:       "Reunião de Alinhamento",
		Description: "Discussão do roadmap",
		Location:    "Google Meet",
		StartAt:     now,
		EndAt:       now.Add(1 * time.Hour), // 14:00 - 15:00
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := eventRepo.Create(existingEvent); err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	// 1. Conflito: Tentativa de agendamento com sobreposição parcial (14:30 - 15:30)
	conflict, err := eventRepo.CheckConflict("user-cal-1", now.Add(30*time.Minute), now.Add(90*time.Minute), "")
	if err != nil {
		t.Fatalf("failed to check conflict: %v", err)
	}
	if !conflict.HasConflict {
		t.Errorf("expected conflict, got none")
	}
	if conflict.ConflictingID != "event-1" {
		t.Errorf("expected conflicting id 'event-1', got '%s'", conflict.ConflictingID)
	}

	// 2. Sem conflito: Agendamento em horário livre (15:00 - 16:00)
	noConflict, err := eventRepo.CheckConflict("user-cal-1", now.Add(1*time.Hour), now.Add(2*time.Hour), "")
	if err != nil {
		t.Fatalf("failed to check conflict: %v", err)
	}
	if noConflict.HasConflict {
		t.Errorf("expected no conflict, but got conflict with %s", noConflict.ConflictingTitle)
	}
}

func TestEventRepository_ListByUser(t *testing.T) {
	eventRepo, _, _ := setupCalendarTestDB(t)

	pastDate := time.Date(2026, 9, 1, 10, 0, 0, 0, time.UTC)
	event := &domain.Event{
		ID:          "event-list-1",
		UserID:      "user-cal-1",
		Title:       "Evento de Teste",
		Description: "Descrição",
		Location:    "Local",
		StartAt:     pastDate,
		EndAt:       pastDate.Add(1 * time.Hour),
		Source:      "google",
		Category:    "work",
		Color:       "#60A5FA",
		CreatedAt:   pastDate,
		UpdatedAt:   pastDate,
	}

	if err := eventRepo.Create(event); err != nil {
		t.Fatalf("failed to create event: %v", err)
	}

	from := pastDate.Add(-24 * time.Hour)
	to := pastDate.Add(24 * time.Hour)
	events, err := eventRepo.ListByUser("user-cal-1", from, to)
	if err != nil {
		t.Fatalf("ListByUser failed: %v", err)
	}

	if len(events) != 1 {
		t.Fatalf("expected 1 event, got %d", len(events))
	}

	// Teste com fuso horário diferente (ex: Brasil UTC-3)
	brtZone := time.FixedZone("BRT", -3*3600)
	localEvent := &domain.Event{
		ID:        "event-brt-1",
		UserID:    "user-cal-1",
		Title:     "Evento Local BRT",
		StartAt:   time.Date(2026, 10, 4, 15, 0, 0, 0, brtZone), // 15:00 BRT = 18:00 UTC
		EndAt:     time.Date(2026, 10, 4, 16, 0, 0, 0, brtZone),
		Source:    "vito",
		CreatedAt: pastDate,
		UpdatedAt: pastDate,
	}
	if err := eventRepo.Create(localEvent); err != nil {
		t.Fatalf("failed to create local event: %v", err)
	}

	// Busca usando intervalo UTC que engloba o evento (18:00 UTC)
	queryFrom := time.Date(2026, 10, 4, 17, 0, 0, 0, time.UTC)
	queryTo := time.Date(2026, 10, 4, 19, 0, 0, 0, time.UTC)
	brtResults, err := eventRepo.ListByUser("user-cal-1", queryFrom, queryTo)
	if err != nil {
		t.Fatalf("ListByUser for BRT failed: %v", err)
	}
	if len(brtResults) != 1 {
		t.Fatalf("expected 1 event for BRT query, got %d", len(brtResults))
	}
	if brtResults[0].Title != "Evento Local BRT" {
		t.Errorf("expected 'Evento Local BRT', got '%s'", brtResults[0].Title)
	}
}

func TestEventRepository_ListByUser_LegacyDateFormat(t *testing.T) {
	eventRepo, _, db := setupCalendarTestDB(t)

	// Simula evento salvo com formato legado '2026-10-03 11:00:00 +0000 UTC'
	rawQuery := `
		INSERT INTO events (id, user_id, title, description, location, start_at, end_at, source, category, color, created_at, updated_at)
		VALUES ('legacy-1', 'user-cal-1', 'Aula de Inglês', '', '', '2026-10-03 11:00:00 +0000 UTC', '2026-10-03 14:15:00 +0000 UTC', 'vito', 'general', '', '2026-10-03 11:00:00 +0000 UTC', '2026-10-03 11:00:00 +0000 UTC')
	`
	if _, err := db.Exec(rawQuery); err != nil {
		t.Fatalf("failed to insert legacy event: %v", err)
	}

	from := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 10, 31, 23, 59, 59, 0, time.UTC)

	events, err := eventRepo.ListByUser("user-cal-1", from, to)
	if err != nil {
		t.Fatalf("ListByUser falhou ao ler evento com formato legado: %v", err)
	}

	if len(events) != 1 {
		t.Fatalf("esperava 1 evento, obteve %d", len(events))
	}
}

func TestEventRepository_ListByUser_NullDatesAndFormats(t *testing.T) {
	eventRepo, _, db := setupCalendarTestDB(t)

	// Simula eventos com múltiplos formatos reais de datas encontrados em SQLite
	rawQuery := `
		INSERT INTO events (id, user_id, title, description, location, start_at, end_at, source, category, color, created_at, updated_at)
		VALUES 
		('edge-1', 'user-cal-1', 'Evento SQLite Standard', '', '', '2026-10-05 10:00:00', '2026-10-05 11:00:00', 'vito', 'general', '', '2026-10-05 10:00:00', '2026-10-05 10:00:00'),
		('edge-2', 'user-cal-1', 'Evento ISO T', 'Desc', 'Loc', '2026-10-06T14:00:00Z', '2026-10-06T15:00:00Z', 'google', 'work', '#1a73e8', '2026-10-06T14:00:00Z', '2026-10-06T14:00:00Z'),
		('edge-3', 'user-cal-1', 'Evento Offset BRT', 'Desc', 'Loc', '2026-10-07T10:00:00-03:00', '2026-10-07T11:00:00-03:00', 'google', 'work', '#1a73e8', '2026-10-07T10:00:00-03:00', '2026-10-07T10:00:00-03:00'),
		('edge-4', 'user-cal-1', 'Evento Date Only', '', '', '2026-10-08', '2026-10-08', 'vito', 'general', '', '2026-10-08', '2026-10-08')
	`
	if _, err := db.Exec(rawQuery); err != nil {
		t.Fatalf("failed to insert edge events: %v", err)
	}

	from := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)
	to := time.Date(2026, 10, 31, 23, 59, 59, 0, time.UTC)

	events, err := eventRepo.ListByUser("user-cal-1", from, to)
	if err != nil {
		t.Fatalf("ListByUser falhou com datas edge-case: %v", err)
	}

	if len(events) != 4 {
		t.Fatalf("esperava 4 eventos, obteve %d", len(events))
	}

	for _, ev := range events {
		if ev.StartAt.Year() != 2026 || ev.StartAt.Month() != 10 {
			t.Errorf("evento %s tem data incorreta: %v", ev.ID, ev.StartAt)
		}
	}
}

func TestRawScanType(t *testing.T) {
	_, _, db := setupCalendarTestDB(t)

	now := time.Date(2026, 10, 3, 11, 0, 0, 0, time.UTC)
	_, err := db.Exec("INSERT INTO events (id, user_id, title, start_at, end_at, created_at, updated_at) VALUES ('test-raw', 'user-cal-1', 'Raw Test', ?, ?, ?, ?)", now, now, now, now)
	if err != nil {
		t.Fatalf("failed to insert: %v", err)
	}

	var rawStart any
	err = db.QueryRow("SELECT start_at FROM events WHERE id = 'test-raw'").Scan(&rawStart)
	if err != nil {
		t.Fatalf("failed to scan rawStart: %v", err)
	}

	t.Logf("TIPO de rawStart: %T | VALOR: %#v", rawStart, rawStart)
}


