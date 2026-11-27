package repository_test

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupV5RepoTest(t *testing.T) (*repository.NotificationsInboxRepositorySQLite, *repository.StoreComplianceRepositorySQLite, *database.SingleWriterQueue) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "v5_repo.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	q := database.NewSingleWriterQueue(64)
	database.SetDefaultWriterQueue(q)
	t.Cleanup(func() {
		q.Close()
		database.SetDefaultWriterQueue(nil)
	})

	now := time.Now().UTC()
	userRepo := repository.NewUserRepository(db)
	for _, u := range []*domain.User{
		{ID: "alice", Name: "Alice", Email: "alice@vito.test", PasswordHash: "secret-hash", CreatedAt: now, UpdatedAt: now},
		{ID: "bob", Name: "Bob", Email: "bob@vito.test", PasswordHash: "secret-hash-2", CreatedAt: now, UpdatedAt: now},
	} {
		if err := userRepo.Create(u); err != nil {
			t.Fatal(err)
		}
	}
	return repository.NewNotificationsInboxRepository(db), repository.NewStoreComplianceRepository(db), q
}

func TestV5Repositories_UseDefaultWriterQueue(t *testing.T) {
	inboxRepo, storeRepo, q := setupV5RepoTest(t)
	ctx := context.Background()

	if err := inboxRepo.Create(ctx, &domain.UserNotification{
		ID: "n-wq-1", UserID: "alice", Type: domain.NotificationTypeInfo, Title: "Olá", IsUnread: true,
	}); err != nil {
		t.Fatalf("Create notification: %v", err)
	}
	if err := storeRepo.UpsertSubscription(ctx, &domain.UserSubscription{
		UserID: "alice", Plan: domain.PlanPro, BillingCycle: domain.BillingCycleMonth, Status: "trialing",
	}); err != nil {
		t.Fatalf("UpsertSubscription: %v", err)
	}

	// Ao fechar a DefaultWriterQueue, toda escrita SQLite deve falhar com ErrQueueClosed.
	q.Close()

	checks := []struct {
		name string
		err  error
	}{
		{"inbox.Create", inboxRepo.Create(ctx, &domain.UserNotification{ID: "n-wq-2", UserID: "alice", Type: domain.NotificationTypeInfo, Title: "X"})},
		{"inbox.MarkRead", inboxRepo.MarkRead(ctx, "n-wq-1", "alice")},
		{"inbox.Dismiss", inboxRepo.Dismiss(ctx, "n-wq-1", "alice")},
		{"inbox.UpsertPreferences", inboxRepo.UpsertPreferences(ctx, domain.DefaultNotificationPreferences("alice"))},
		{"store.UpsertSubscription", storeRepo.UpsertSubscription(ctx, domain.DefaultUserSubscription("alice"))},
		{"store.UpsertPrivacySettings", storeRepo.UpsertPrivacySettings(ctx, domain.DefaultPrivacySettings("alice"))},
		{"store.CreateComplianceRequest", storeRepo.CreateComplianceRequest(ctx, &domain.AccountComplianceRequest{ID: "c-1", UserID: "alice", Kind: domain.ComplianceKindExportJSON, Status: "completed"})},
		{"store.CreateAIReport", storeRepo.CreateAIReport(ctx, &domain.AIContentReport{ID: "r-1", UserID: "alice", Reason: "errado"})},
		{"store.CreateSupportRequest", storeRepo.CreateSupportRequest(ctx, &domain.SupportRequest{ID: "s-1", UserID: "alice", Subject: "S", Message: "M"})},
	}
	for _, tc := range checks {
		if !errors.Is(tc.err, database.ErrQueueClosed) {
			t.Errorf("%s não passou pela DefaultWriterQueue (esperava ErrQueueClosed, obteve %v)", tc.name, tc.err)
		}
	}
}

func TestV5Repositories_MultiTenantIsolation(t *testing.T) {
	inboxRepo, storeRepo, _ := setupV5RepoTest(t)
	ctx := context.Background()

	if err := inboxRepo.Create(ctx, &domain.UserNotification{
		ID: "n-alice-1", UserID: "alice", Type: domain.NotificationTypeApprove,
		SourceDomain: "bots", SourceID: "conf-1", Title: "Bot Alice", IsUnread: true,
	}); err != nil {
		t.Fatal(err)
	}

	if _, err := inboxRepo.GetByID(ctx, "n-alice-1", "bob"); !errors.Is(err, domain.ErrNotificationNotFound) {
		t.Fatalf("Bob não pode ler notificação de Alice, obteve %v", err)
	}
	if err := inboxRepo.MarkRead(ctx, "n-alice-1", "bob"); !errors.Is(err, domain.ErrNotificationNotFound) {
		t.Fatalf("Bob não pode marcar notificação de Alice como lida, obteve %v", err)
	}
	if err := inboxRepo.Dismiss(ctx, "n-alice-1", "bob"); !errors.Is(err, domain.ErrNotificationNotFound) {
		t.Fatalf("Bob não pode descartar notificação de Alice, obteve %v", err)
	}
	bobList, bobCounts, err := inboxRepo.ListByUser(ctx, "bob", domain.NotificationInboxFilter{})
	if err != nil {
		t.Fatal(err)
	}
	if len(bobList) != 0 || bobCounts.All != 0 {
		t.Fatalf("Bob deveria ter caixa vazia, obteve %d itens", len(bobList))
	}

	// LGPD Export de Bob não deve conter dados de Alice nem password_hash.
	exportData, err := storeRepo.CollectLGPDExportData(ctx, "bob")
	if err != nil {
		t.Fatal(err)
	}
	if exportData.User == nil || exportData.User.ID != "bob" || exportData.User.PasswordHash != "" {
		t.Fatalf("exportação de usuário inválida: %+v", exportData.User)
	}
	if len(exportData.Notifications) != 0 {
		t.Fatalf("exportação de Bob não deveria incluir notificações de Alice, obteve %d", len(exportData.Notifications))
	}
}
