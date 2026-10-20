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

func setupCleanupService(t *testing.T) (
	*service.AccountCleanupService,
	domain.UserRepository,
	domain.SessionRepository,
	domain.EventRepository,
	domain.TodoRepository,
) {
	t.Helper()

	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_account_cleanup.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)

	return service.NewAccountCleanupService(userRepo, sessionRepo, eventRepo, todoRepo, nil), userRepo, sessionRepo, eventRepo, todoRepo
}

func cleanupPhonePtr(v string) *string { return &v }

func TestAccountCleanup_PurgesOnlyOrphanPlaceholders(t *testing.T) {
	ctx := context.Background()
	cleanupSvc, userRepo, sessionRepo, eventRepo, _ := setupCleanupService(t)

	now := time.Now().UTC()

	orphan := &domain.User{
		ID: "user-orphan", Name: "Usuário Vito", Email: "5511999998888@vito.local",
		Phone: cleanupPhonePtr("+5511999998888"), CreatedAt: now, UpdatedAt: now,
	}
	withSession := &domain.User{
		ID: "user-with-session", Name: "Usuário Vito", Email: "5511999997777@vito.local",
		Phone: cleanupPhonePtr("+5511999997777"), CreatedAt: now, UpdatedAt: now,
	}
	withData := &domain.User{
		ID: "user-with-data", Name: "Usuário Vito", Email: "5511999996666@vito.local",
		Phone: cleanupPhonePtr("+5511999996666"), CreatedAt: now, UpdatedAt: now,
	}
	real := &domain.User{
		ID: "user-real", Name: "André", Email: "andre@gmail.com",
		Phone: cleanupPhonePtr("+5598984417165"), CreatedAt: now, UpdatedAt: now,
	}
	for _, u := range []*domain.User{orphan, withSession, withData, real} {
		if err := userRepo.Create(u); err != nil {
			t.Fatalf("falha ao criar usuário %s: %v", u.ID, err)
		}
	}

	// Sessão ativa: a conta não pode ser removida
	if err := sessionRepo.Create(&domain.RefreshToken{
		ID:        "rt-session",
		UserID:    withSession.ID,
		TokenHash: "hash-session",
		ExpiresAt: now.Add(24 * time.Hour),
		CreatedAt: now,
	}); err != nil {
		t.Fatalf("falha ao criar sessão: %v", err)
	}

	// Evento na agenda: a conta tem dados e deve ser preservada
	if err := eventRepo.Create(&domain.Event{
		ID: "ev-1", UserID: withData.ID, Title: "Reunião",
		StartAt: now, EndAt: now.Add(time.Hour), CreatedAt: now, UpdatedAt: now,
	}); err != nil {
		t.Fatalf("falha ao criar evento: %v", err)
	}

	purged, err := cleanupSvc.PurgeOrphanPlaceholderAccounts(ctx)
	if err != nil {
		t.Fatalf("falha na limpeza: %v", err)
	}
	if purged != 1 {
		t.Fatalf("esperava 1 conta removida, obteve %d", purged)
	}

	if _, err := userRepo.GetByID(orphan.ID); err == nil {
		t.Error("conta placeholder órfã deveria ter sido removida")
	}
	for _, id := range []string{withSession.ID, withData.ID, real.ID} {
		if _, err := userRepo.GetByID(id); err != nil {
			t.Errorf("conta %s deveria ter sido preservada: %v", id, err)
		}
	}
}

func TestAccountCleanup_ReleasesPhoneOfPurgedAccount(t *testing.T) {
	ctx := context.Background()
	cleanupSvc, userRepo, _, _, _ := setupCleanupService(t)

	now := time.Now().UTC()
	orphan := &domain.User{
		ID: "user-orphan-phone", Name: "Usuário Vito", Email: "5598984417165@vito.local",
		Phone: cleanupPhonePtr("+5598984417165"), CreatedAt: now, UpdatedAt: now,
	}
	if err := userRepo.Create(orphan); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	if _, err := cleanupSvc.PurgeOrphanPlaceholderAccounts(ctx); err != nil {
		t.Fatalf("falha na limpeza: %v", err)
	}

	// O número deve ficar livre para o dono real
	found, err := userRepo.GetByPhone("+5598984417165")
	if err == nil {
		t.Fatalf("telefone ainda ocupado por %s", found.ID)
	}
}
