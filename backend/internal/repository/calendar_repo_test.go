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

func TestEventRepository_UpdateAndSeries(t *testing.T) {
	eventRepo, _, _ := setupCalendarTestDB(t)

	now := time.Date(2026, 10, 3, 8, 0, 0, 0, time.UTC)
	// Insere 3 ocorrências de uma série "Aula de inglês"
	ev1 := &domain.Event{
		ID:         "series-1",
		UserID:     "user-cal-1",
		Title:      "Aula de inglês",
		StartAt:    now,
		EndAt:      now.Add(2 * time.Hour),
		Recurrence: "WEEKLY",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	ev2 := &domain.Event{
		ID:         "series-2",
		UserID:     "user-cal-1",
		Title:      "Aula de inglês",
		StartAt:    now.AddDate(0, 0, 7),
		EndAt:      now.AddDate(0, 0, 7).Add(2 * time.Hour),
		Recurrence: "WEEKLY",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	ev3 := &domain.Event{
		ID:         "series-3",
		UserID:     "user-cal-1",
		Title:      "Aula de inglês",
		StartAt:    now.AddDate(0, 0, 14),
		EndAt:      now.AddDate(0, 0, 14).Add(2 * time.Hour),
		Recurrence: "WEEKLY",
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	_ = eventRepo.Create(ev1)
	_ = eventRepo.Create(ev2)
	_ = eventRepo.Create(ev3)

	// 1. Atualiza apenas 1 ocorrência
	ev1.Title = "Aula de inglês - Prova Oral"
	if err := eventRepo.Update(ev1); err != nil {
		t.Fatalf("Update failed: %v", err)
	}
	saved1, err := eventRepo.GetByID("series-1", "user-cal-1")
	if err != nil || saved1.Title != "Aula de inglês - Prova Oral" {
		t.Fatalf("expected title updated on series-1")
	}

	// 2. Atualiza toda a série restante (série 2 e 3 mudando horário de 8h para 10h)
	newStart := time.Date(2026, 10, 10, 10, 0, 0, 0, time.UTC)
	newEnd := newStart.Add(2 * time.Hour)
	ev2.Title = "Curso Avançado de Inglês"
	ev2.StartAt = newStart
	ev2.EndAt = newEnd
	count, err := eventRepo.UpdateSeries(ev2)
	if err != nil {
		t.Fatalf("UpdateSeries failed: %v", err)
	}
	if count < 2 {
		t.Errorf("expected at least 2 series events updated, got %d", count)
	}

	// 3. DeleteSeries
	deleted, err := eventRepo.DeleteSeries("series-2", "user-cal-1")
	if err != nil {
		t.Fatalf("DeleteSeries failed: %v", err)
	}
	if deleted < 2 {
		t.Errorf("expected at least 2 events deleted by series, got %d", deleted)
	}
}

func TestEventRepository_UpdateTimesByTitle_PreservesUserTimezone(t *testing.T) {
	eventRepo, _, _ := setupCalendarTestDB(t)

	loc, err := time.LoadLocation("America/Sao_Paulo")
	if err != nil {
		loc = time.FixedZone("BRT", -3*3600)
	}

	// Evento original criado no dia 07/10/2026 às 09:00 BRT (12:00 UTC)
	startLocal := time.Date(2026, 10, 7, 9, 0, 0, 0, loc)
	originalEvent := &domain.Event{
		ID:          "event-tz-1",
		UserID:      "user-cal-1",
		Title:       "Reunião com equipe de desenvolvimento do app",
		Description: "Daily",
		StartAt:     startLocal,
		EndAt:       startLocal.Add(1 * time.Hour),
		CreatedAt:   time.Now().UTC(),
		UpdatedAt:   time.Now().UTC(),
	}

	if err := eventRepo.Create(originalEvent); err != nil {
		t.Fatalf("falha ao criar evento inicial: %v", err)
	}

	// Usuário pede alteração para as 17:00 (17:00 às 18:00 no fuso local de Brasília)
	newStartLocal := time.Date(2026, 10, 7, 17, 0, 0, 0, loc)
	newEndLocal := newStartLocal.Add(1 * time.Hour)

	count, err := eventRepo.UpdateTimesByTitle("user-cal-1", "equipe de desenvolvimento", newStartLocal, newEndLocal)
	if err != nil {
		t.Fatalf("UpdateTimesByTitle falhou: %v", err)
	}
	if count != 1 {
		t.Fatalf("esperava 1 evento atualizado, obteve %d", count)
	}

	updated, err := eventRepo.GetByID("event-tz-1", "user-cal-1")
	if err != nil {
		t.Fatalf("falha ao buscar evento atualizado: %v", err)
	}

	// 17:00 BRT (-03:00) corresponde rigorosamente a 20:00 UTC
	expectedUTC := time.Date(2026, 10, 7, 20, 0, 0, 0, time.UTC)
	if !updated.StartAt.Equal(expectedUTC) {
		t.Fatalf("FALHA DE FUSO: horário no banco salvo como %v (esperava %v UTC para equivaler a 17:00 no fuso do usuário)", updated.StartAt, expectedUTC)
	}

	// No fuso local do usuário, a hora deve ser exatamente 17
	if updated.StartAt.In(loc).Hour() != 17 {
		t.Errorf("hora local no fuso do usuário deve ser 17, mas foi %d", updated.StartAt.In(loc).Hour())
	}
}



