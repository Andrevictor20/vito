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

func TestAC03_DedupKeyPropagatesToInboxUpsert(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "ac03.db")
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("database.Open: %v", err)
	}
	defer db.Close()

	now := time.Now().UTC()
	userID := "user-ac03"
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES (?, 'U3', 'u3@vito.app', 'h', ?, ?)`, userID, now, now)
	if err != nil {
		t.Fatalf("insert user: %v", err)
	}

	eventRepo := repository.NewEventRepository(db)
	budgetSvc := service.NewAttentionBudgetService(db, eventRepo)
	inboxRepo := repository.NewNotificationsInboxRepository(db)
	inboxSvc := service.NewNotificationsInboxService(inboxRepo)
	inboxSvc.SetAttentionBudget(budgetSvc)

	ctx := context.Background()
	cand := service.AttentionCandidate{
		UserID:       userID,
		SourceWorker: "reminder_worker",
		Category:     "agenda",
		Urgency:      "normal",
		Title:        "Reunião de Produto",
		Body:         "Começa às 14:00",
		Now:          now,
	}

	allowed1, dec1 := budgetSvc.ShouldDeliver(ctx, cand)
	if !allowed1 || dec1.Status != service.AttentionStatusDelivered {
		t.Fatalf("AC-03 first ShouldDeliver: got allowed=%v status=%s, want true/DELIVERED", allowed1, dec1.Status)
	}

	allowed2, dec2 := budgetSvc.ShouldDeliver(ctx, cand)
	if allowed2 || dec2.Status != service.AttentionStatusDeduplicated {
		t.Fatalf("AC-03 second ShouldDeliver: got allowed=%v status=%s, want false/DEDUPLICATED", allowed2, dec2.Status)
	}

	items, _, err := inboxRepo.ListByUser(ctx, userID, domain.NotificationInboxFilter{})
	if err != nil {
		t.Fatalf("ListByUser: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("AC-03: expected 1 inbox item, got %d", len(items))
	}

	var loggedDedupKey string
	if err := db.QueryRow(`SELECT dedup_key FROM attention_budget_logs WHERE user_id = ? LIMIT 1`, userID).Scan(&loggedDedupKey); err != nil {
		t.Fatalf("query attention_budget_log: %v", err)
	}
	if items[0].SourceID != loggedDedupKey {
		t.Fatalf("AC-03: expected inbox source_id=%q to match computed dedup_key=%q (not random UUID)", items[0].SourceID, loggedDedupKey)
	}
}
