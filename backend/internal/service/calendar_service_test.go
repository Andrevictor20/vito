package service_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupCalendarService(t *testing.T) (*service.CalendarService, domain.EventRepository) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_cal_svc.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)

	_ = userRepo.Create(&domain.User{
		ID:           "user-cal-svc-1",
		Name:         "User Cal Svc",
		Email:        "calsvc@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	calSvc := service.NewCalendarService(eventRepo)
	return calSvc, eventRepo
}

func TestCalendarService_CreateEventWithConflictCheck(t *testing.T) {
	calSvc, _ := setupCalendarService(t)

	baseTime := time.Date(2026, 9, 27, 10, 0, 0, 0, time.UTC)

	// 1. Criar primeiro evento
	event1, conflict, err := calSvc.CreateEvent(
		"user-cal-svc-1",
		"Dentista",
		"Limpeza semestral",
		"Clínica Sorriso",
		baseTime,
		baseTime.Add(1*time.Hour), // 10:00 - 11:00
	)
	if err != nil {
		t.Fatalf("expected nil error on create event, got: %v", err)
	}
	if conflict.HasConflict {
		t.Errorf("expected no conflict on first event")
	}
	if event1.ID == "" {
		t.Errorf("expected generated id")
	}

	// 2. Criar segundo evento com conflito (10:30 - 11:30)
	_, conflict2, err := calSvc.CreateEvent(
		"user-cal-svc-1",
		"Reunião de Projeto",
		"Alinhamento",
		"Online",
		baseTime.Add(30*time.Minute),
		baseTime.Add(90*time.Minute),
	)
	if err != nil {
		t.Fatalf("expected nil error, got: %v", err)
	}
	if !conflict2.HasConflict {
		t.Errorf("expected conflict detection on overlapping event")
	}
	if conflict2.ConflictingTitle != "Dentista" {
		t.Errorf("expected conflict with 'Dentista', got '%s'", conflict2.ConflictingTitle)
	}

	if event1.Category != "health" {
		t.Errorf("expected category health for Dentista, got '%s'", event1.Category)
	}
	if event1.Color == "" {
		t.Errorf("expected non-empty color for health event")
	}
}

func TestClassifyEvent(t *testing.T) {
	cases := []struct {
		title    string
		desc     string
		expected string
	}{
		{"Daily Scrum", "Alinhamento com o time", "work"},
		{"Consulta com Cardiologista", "Levar exames", "health"},
		{"Pagar fatura Nubank", "Vencimento hoje", "finance"},
		{"Aula de Arquitetura de Software", "Faculdade", "study"},
		{"Churrasco de Aniversário", "Na casa do Pedro", "leisure"},
		{"Almoço com a Família", "Comprar sobremesa", "personal"},
		{"Lembrete genérico", "Sem contexto", "general"},
	}

	for _, c := range cases {
		cat, col := service.ClassifyEvent(c.title, c.desc)
		if cat != c.expected {
			t.Errorf("ClassifyEvent(%q, %q) = %q, expected %q", c.title, c.desc, cat, c.expected)
		}
		if col == "" {
			t.Errorf("ClassifyEvent(%q, %q) returned empty color", c.title, c.desc)
		}
	}
}

func TestCalendarService_UpdateAndSeries(t *testing.T) {
	calSvc, _ := setupCalendarService(t)
	now := time.Date(2026, 10, 3, 8, 0, 0, 0, time.UTC)
	events, err := calSvc.CreateRecurringEvents(
		"user-cal-svc-1",
		"Aula de Inglês",
		"Foco em conversação",
		"Online",
		now,
		now.Add(2*time.Hour),
		"WEEKLY",
		4,
	)
	if err != nil || len(events) != 4 {
		t.Fatalf("failed to create recurring events: %v", err)
	}

	// 1. Atualizar apenas 1 evento
	events[0].Title = "Aula de Inglês - Teste"
	upEvent, count, err := calSvc.UpdateEvent("user-cal-svc-1", events[0], false)
	if err != nil || count != 1 || upEvent.Title != "Aula de Inglês - Teste" {
		t.Fatalf("expected 1 event updated, got count %d, err %v", count, err)
	}

	// 2. Atualizar toda a série
	events[1].Title = "Inglês Executivo"
	newStart := time.Date(2026, 10, 10, 9, 0, 0, 0, time.UTC)
	events[1].StartAt = newStart
	events[1].EndAt = newStart.Add(2 * time.Hour)
	_, seriesCount, err := calSvc.UpdateEvent("user-cal-svc-1", events[1], true)
	if err != nil || seriesCount < 3 {
		t.Fatalf("expected at least 3 events updated in series, got %d, err %v", seriesCount, err)
	}

	// 3. Excluir série inteira
	delCount, err := calSvc.DeleteEventWithOption(events[1].ID, "user-cal-svc-1", true)
	if err != nil || delCount < 3 {
		t.Fatalf("expected at least 3 events deleted, got %d, err %v", delCount, err)
	}
}

type mockSyncPusher struct {
	pushedEvents []*domain.Event
	deletedIDs   []string
}

func (m *mockSyncPusher) PushEvent(ctx context.Context, userID string, event *domain.Event) error {
	m.pushedEvents = append(m.pushedEvents, event)
	return nil
}

func (m *mockSyncPusher) DeleteEvent(ctx context.Context, userID, eventID string) error {
	m.deletedIDs = append(m.deletedIDs, eventID)
	return nil
}

func TestCalendarService_SyncPusherIntegration(t *testing.T) {
	calSvc, _ := setupCalendarService(t)
	pusher := &mockSyncPusher{}
	calSvc.SetSyncPusher(pusher)

	start := time.Date(2026, 10, 15, 14, 0, 0, 0, time.UTC)
	evt, _, err := calSvc.CreateEvent("user-cal-svc-1", "Alinhamento Diretoria", "", "Sala 1", start, start.Add(time.Hour))
	if err != nil {
		t.Fatalf("erro ao criar evento: %v", err)
	}

	// Aguarda processamento assíncrono do pusher
	time.Sleep(50 * time.Millisecond)

	if len(pusher.pushedEvents) == 0 {
		t.Fatalf("esperava que PushEvent fosse acionado pelo CalendarService")
	}
	if pusher.pushedEvents[0].ID != evt.ID {
		t.Errorf("evento empurrado diverge do criado")
	}

	// Testa UpdateEvent propagando para syncPusher
	evt.Title = "Alinhamento Diretoria Atualizado"
	_, _, err = calSvc.UpdateEvent("user-cal-svc-1", evt, false)
	if err != nil {
		t.Fatalf("erro ao atualizar evento: %v", err)
	}

	time.Sleep(50 * time.Millisecond)
	if len(pusher.pushedEvents) < 2 {
		t.Fatalf("esperava que UpdateEvent propagasse alteração para o pusher")
	}

	// Testa DeleteEventWithOption propagando para syncPusher
	delCount, err := calSvc.DeleteEventWithOption(evt.ID, "user-cal-svc-1", false)
	if err != nil || delCount != 1 {
		t.Fatalf("erro ao deletar com opção: %v", err)
	}

	time.Sleep(50 * time.Millisecond)
	if len(pusher.deletedIDs) == 0 || pusher.deletedIDs[len(pusher.deletedIDs)-1] != evt.ID {
		t.Errorf("esperava DeleteEventWithOption propagado para o pusher")
	}
}

func TestCalendarService_ConflictAlternativeSlots(t *testing.T) {
	calSvc, _ := setupCalendarService(t)

	// Evento existente: Aula de Inglês das 08:00 às 10:00
	baseDate := time.Date(2026, 10, 10, 8, 0, 0, 0, time.UTC)
	_, _, err := calSvc.CreateEvent(
		"user-cal-svc-1",
		"Aula de Inglês",
		"Conversação",
		"Online",
		baseDate,
		baseDate.Add(2*time.Hour), // 08:00 - 10:00
	)
	if err != nil {
		t.Fatalf("falha ao criar evento inicial: %v", err)
	}

	// Tentativa conflitante: Reunião das 09:00 às 10:00
	reqStart := time.Date(2026, 10, 10, 9, 0, 0, 0, time.UTC)
	reqEnd := reqStart.Add(1 * time.Hour) // duração: 1h

	_, conflict, err := calSvc.CreateEvent(
		"user-cal-svc-1",
		"Reunião de Alinhamento",
		"Briefing",
		"Google Meet",
		reqStart,
		reqEnd,
	)
	if err != nil {
		t.Fatalf("falha ao criar evento conflitante: %v", err)
	}
	if !conflict.HasConflict {
		t.Fatalf("esperava detecção de conflito")
	}

	// Verifica se gerou slots sugeridos
	if len(conflict.SuggestedSlots) == 0 {
		t.Fatalf("esperava pelo menos 1 sugestão de horário livre alternativo")
	}

	// O primeiro slot deve ser adjacente logo após o término do conflito (ex: 10:00 ou 10:30)
	slot1 := conflict.SuggestedSlots[0]
	if slot1.StartAt.Before(baseDate.Add(2 * time.Hour)) {
		t.Errorf("slot sugerido %v deve ser após o término do evento conflitante (10:00)", slot1.StartAt)
	}
	if slot1.EndAt.Sub(slot1.StartAt) != (1 * time.Hour) {
		t.Errorf("duração do slot sugerido deve preservar a duração requerida (1h), obteve %v", slot1.EndAt.Sub(slot1.StartAt))
	}
	if slot1.Label == "" {
		t.Errorf("label descritivo do slot não deve ser vazio")
	}
}

func TestCalendarService_UpdateEventTimesByTitle_PropagatesToSyncPusher(t *testing.T) {
	calSvc, _ := setupCalendarService(t)
	pusher := &mockSyncPusher{}
	calSvc.SetSyncPusher(pusher)

	start := time.Date(2026, 10, 7, 9, 0, 0, 0, time.UTC)
	evt, _, err := calSvc.CreateEvent("user-cal-svc-1", "Reunião de Equipe", "", "Meet", start, start.Add(time.Hour))
	if err != nil {
		t.Fatalf("erro ao criar evento: %v", err)
	}

	time.Sleep(50 * time.Millisecond)
	pusher.pushedEvents = nil // limpa o evento da criação

	// Reagenda evento para as 17:00
	newStart := time.Date(2026, 10, 7, 17, 0, 0, 0, time.UTC)
	newEnd := newStart.Add(time.Hour)
	count, err := calSvc.UpdateEventTimesByTitle("user-cal-svc-1", "Reunião de Equipe", newStart, newEnd)
	if err != nil {
		t.Fatalf("erro ao atualizar evento por título: %v", err)
	}
	if count != 1 {
		t.Fatalf("esperava 1 evento atualizado, obteve %d", count)
	}

	time.Sleep(100 * time.Millisecond)

	if len(pusher.pushedEvents) == 0 {
		t.Fatalf("esperava que PushEvent fosse acionado após UpdateEventTimesByTitle")
	}
	if pusher.pushedEvents[0].ID != evt.ID {
		t.Errorf("ID do evento atualizado no pusher (%s) diverge do esperado (%s)", pusher.pushedEvents[0].ID, evt.ID)
	}
	if !pusher.pushedEvents[0].StartAt.Equal(newStart) {
		t.Errorf("novo horário no pusher (%v) diverge do horário atualizado (%v)", pusher.pushedEvents[0].StartAt, newStart)
	}
}

func TestCalendarService_CreateEvent_AutoEndTimeWhenZeroOrBefore(t *testing.T) {
	calSvc, _ := setupCalendarService(t)
	start := time.Date(2026, 10, 15, 19, 0, 0, 0, time.UTC)

	// Caso 1: EndAt zero (comum em convites e mensagens de voz)
	evt1, _, err := calSvc.CreateEvent("user-cal-svc-1", "Festa Zero End", "Desc", "Local", start, time.Time{})
	if err != nil {
		t.Fatalf("esperava sucesso com EndAt zero, obteve erro: %v", err)
	}
	expectedEnd := start.Add(1 * time.Hour)
	if !evt1.EndAt.Equal(expectedEnd) {
		t.Errorf("esperava EndAt %v, obteve %v", expectedEnd, evt1.EndAt)
	}

	// Caso 2: EndAt anterior ou igual ao início
	evt2, _, err := calSvc.CreateEvent("user-cal-svc-1", "Festa Equal End", "Desc", "Local", start, start)
	if err != nil {
		t.Fatalf("esperava sucesso com EndAt igual a StartAt, obteve erro: %v", err)
	}
	if !evt2.EndAt.Equal(expectedEnd) {
		t.Errorf("esperava EndAt %v, obteve %v", expectedEnd, evt2.EndAt)
	}
}


