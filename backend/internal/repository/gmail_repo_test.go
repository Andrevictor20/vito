package repository_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupGmailTestDB(t *testing.T) (*repository.GmailRepositorySQLite, *repository.UserRepositorySQLite) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_gmail.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir sqlite de teste: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	return repository.NewGmailRepository(db), repository.NewUserRepository(db)
}

func TestGmailRepository_CRUD(t *testing.T) {
	ctx := context.Background()
	repo, userRepo := setupGmailTestDB(t)

	// Cria usuário
	user := &domain.User{
		ID:           "user-gmail-1",
		Name:         "Usuário Gmail",
		Email:        "gmail_user@example.com",
		PasswordHash: "secret-hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	// 1. Get inexistente retorna ErrGmailNotConnected
	_, err := repo.GetByUserID(ctx, user.ID)
	if err != domain.ErrGmailNotConnected {
		t.Fatalf("esperava ErrGmailNotConnected, obteve %v", err)
	}

	// 2. Upsert novo
	integration := &domain.GmailIntegration{
		ID:                   "gmail-int-1",
		UserID:               user.ID,
		AccountEmail:         "usuario@gmail.com",
		EncryptedCredentials: "encrypted-tokens-payload",
		Status:               domain.GmailStatusActive,
	}
	if err := repo.Upsert(ctx, integration); err != nil {
		t.Fatalf("falha no Upsert inicial: %v", err)
	}

	got, err := repo.GetByUserID(ctx, user.ID)
	if err != nil {
		t.Fatalf("falha ao obter integração: %v", err)
	}
	if got.AccountEmail != "usuario@gmail.com" || got.Status != domain.GmailStatusActive {
		t.Fatalf("dados divergentes: %+v", got)
	}

	// 3. UpdateStatus
	if err := repo.UpdateStatus(ctx, user.ID, domain.GmailStatusReauthRequired); err != nil {
		t.Fatalf("falha no UpdateStatus: %v", err)
	}
	got, _ = repo.GetByUserID(ctx, user.ID)
	if got.Status != domain.GmailStatusReauthRequired {
		t.Fatalf("esperava status reauth_required, obteve %s", got.Status)
	}

	// 4. UpdateLastScanned
	now := time.Now().UTC().Truncate(time.Second)
	if err := repo.UpdateLastScanned(ctx, user.ID, "hist-999", now); err != nil {
		t.Fatalf("falha no UpdateLastScanned: %v", err)
	}
	got, _ = repo.GetByUserID(ctx, user.ID)
	if got.HistoryID != "hist-999" || got.LastScannedAt == nil || !got.LastScannedAt.Equal(now) {
		t.Fatalf("histórico ou timestamp divergente: %+v", got)
	}

	// 5. DeleteByUserID
	if err := repo.DeleteByUserID(ctx, user.ID); err != nil {
		t.Fatalf("falha no DeleteByUserID: %v", err)
	}
	_, err = repo.GetByUserID(ctx, user.ID)
	if err != domain.ErrGmailNotConnected {
		t.Fatalf("esperava ErrGmailNotConnected após delete, obteve %v", err)
	}
}
