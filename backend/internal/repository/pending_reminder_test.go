package repository_test

import (
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

// W2: lembretes personalizáveis — round-trip dos campos e query do digest
// (agendadas para hoje/atrasadas entram no nudge das 17:30).
func TestPendingRepository_ReminderRoundTrip(t *testing.T) {
	db := setupPendingTestDB(t)
	defer db.Close()

	repo := repository.NewPendingRepository(db)
	now := time.Now().UTC()
	remindAt := now.Add(2 * time.Hour).Truncate(time.Second)

	item := &domain.PendingItem{
		ID:            "pend-rem",
		UserID:        "user-test-1",
		Title:         "Pagar boleto",
		Category:      "financas",
		Status:        domain.PendingStatusInbox,
		RemindAt:      &remindAt,
		RemindRepeat:  "daily",
		RemindAdvance: 30,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	if err := repo.Create(item); err != nil {
		t.Fatalf("falha ao criar com lembrete: %v", err)
	}

	fetched, err := repo.GetByID("pend-rem", "user-test-1")
	if err != nil {
		t.Fatalf("falha ao buscar: %v", err)
	}
	if fetched.RemindAt == nil || !fetched.RemindAt.Equal(remindAt) {
		t.Fatalf("remind_at divergente: %+v", fetched.RemindAt)
	}
	if fetched.RemindRepeat != "daily" || fetched.RemindAdvance != 30 {
		t.Fatalf("repeat/advance divergentes: %+v", fetched)
	}

	fetched.RemindRepeat = "weekly"
	if err := repo.Update(fetched); err != nil {
		t.Fatalf("falha ao atualizar lembrete: %v", err)
	}
	updated, err := repo.GetByID("pend-rem", "user-test-1")
	if err != nil {
		t.Fatalf("falha ao rebuscar: %v", err)
	}
	if updated.RemindRepeat != "weekly" {
		t.Fatalf("repeat não persistiu: %+v", updated)
	}
}

func TestPendingRepository_ScheduledDueForNudge(t *testing.T) {
	db := setupPendingTestDB(t)
	defer db.Close()

	repo := repository.NewPendingRepository(db)
	now := time.Now().UTC()
	today := now.Format("2006-01-02")

	mk := func(id, status, date string) *domain.PendingItem {
		return &domain.PendingItem{
			ID: id, UserID: "user-test-1", Title: id, Category: "geral",
			Status: domain.PendingStatus(status), ScheduledDate: date,
			CreatedAt: now, UpdatedAt: now,
		}
	}
	for _, it := range []*domain.PendingItem{
		mk("sched-today", "scheduled", today),
		mk("sched-past", "scheduled", now.AddDate(0, 0, -2).Format("2006-01-02")),
		mk("sched-future", "scheduled", now.AddDate(0, 0, 3).Format("2006-01-02")),
		mk("done-today", "done", today),
	} {
		if err := repo.Create(it); err != nil {
			t.Fatalf("falha ao criar %s: %v", it.ID, err)
		}
	}

	got, err := repo.ListScheduledDueForNudge(today, now)
	if err != nil {
		t.Fatalf("falha na query: %v", err)
	}
	ids := map[string]bool{}
	for _, it := range got {
		ids[it.ID] = true
	}
	if !ids["sched-today"] || !ids["sched-past"] || len(got) != 2 {
		t.Fatalf("esperava sched-today+sched-past, obteve %+v", got)
	}
}
