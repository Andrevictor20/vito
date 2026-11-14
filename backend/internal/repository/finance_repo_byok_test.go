package repository_test

import (
	"bytes"
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupTestByokRepo(t *testing.T) (repository.FinanceRepository, string, string) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "test_byok_repo.db"))
	if err != nil {
		t.Fatalf("falha ao abrir test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	aliceID := "user-byok-alice"
	bobID := "user-byok-bob"
	for _, u := range []struct{ id, name, email string }{
		{aliceID, "Alice", "alice-byok@example.com"},
		{bobID, "Bob", "bob-byok@example.com"},
	} {
		if err := userRepo.Create(&domain.User{
			ID:           u.id,
			Name:         u.name,
			Email:        u.email,
			PasswordHash: "hash",
			CreatedAt:    time.Now().UTC(),
			UpdatedAt:    time.Now().UTC(),
		}); err != nil {
			t.Fatalf("falha ao criar usuário %s: %v", u.id, err)
		}
	}

	return repository.NewFinanceRepository(db), aliceID, bobID
}

func TestFinanceRepo_ByokBackupLifecycleAndIsolation(t *testing.T) {
	repo, aliceID, bobID := setupTestByokRepo(t)
	ctx := context.Background()

	// 1. Get quando inexistente -> ErrByokBackupNotFound
	if _, err := repo.GetByokBackup(ctx, aliceID); !errors.Is(err, domain.ErrByokBackupNotFound) {
		t.Fatalf("esperava ErrByokBackupNotFound, obteve %v", err)
	}

	// 2. Upsert inicial para Alice
	cipher1 := []byte("ciphertext-alice-v1")
	nonce1 := []byte("nonce-12byte")
	err := repo.UpsertByokBackup(ctx, &domain.FinanceByokBackup{
		UserID:     aliceID,
		Ciphertext: cipher1,
		Nonce:      nonce1,
		KeyVersion: 1,
	})
	if err != nil {
		t.Fatalf("falha ao gravar backup inicial: %v", err)
	}

	got, err := repo.GetByokBackup(ctx, aliceID)
	if err != nil {
		t.Fatalf("falha ao recuperar backup de Alice: %v", err)
	}
	if !bytes.Equal(got.Ciphertext, cipher1) || !bytes.Equal(got.Nonce, nonce1) || got.KeyVersion != 1 {
		t.Fatalf("dados do backup divergentes: got=%+v", got)
	}
	if got.UpdatedAt.IsZero() {
		t.Fatal("updated_at deveria ser preenchido")
	}

	// 3. Isolamento estrito: Bob não acessa backup de Alice
	if _, err := repo.GetByokBackup(ctx, bobID); !errors.Is(err, domain.ErrByokBackupNotFound) {
		t.Fatalf("Bob não deveria enxergar backup de Alice, obteve %v", err)
	}

	// 4. Upsert atualização (rotação de chave)
	cipher2 := []byte("ciphertext-alice-v2")
	nonce2 := []byte("nonce-v2-new")
	err = repo.UpsertByokBackup(ctx, &domain.FinanceByokBackup{
		UserID:     aliceID,
		Ciphertext: cipher2,
		Nonce:      nonce2,
		KeyVersion: 2,
	})
	if err != nil {
		t.Fatalf("falha ao atualizar backup: %v", err)
	}
	got2, err := repo.GetByokBackup(ctx, aliceID)
	if err != nil {
		t.Fatalf("falha ao recuperar backup atualizado: %v", err)
	}
	if !bytes.Equal(got2.Ciphertext, cipher2) || !bytes.Equal(got2.Nonce, nonce2) || got2.KeyVersion != 2 {
		t.Fatalf("backup atualizado não refletido: %+v", got2)
	}

	// 5. Delete para Bob não remove o de Alice
	if err := repo.DeleteByokBackup(ctx, bobID); err != nil {
		t.Fatalf("delete idempotente de Bob falhou: %v", err)
	}
	if _, err := repo.GetByokBackup(ctx, aliceID); err != nil {
		t.Fatalf("backup de Alice não deveria ser afetado pelo delete de Bob: %v", err)
	}

	// 6. Delete para Alice remove e Get retorna ErrByokBackupNotFound
	if err := repo.DeleteByokBackup(ctx, aliceID); err != nil {
		t.Fatalf("delete de Alice falhou: %v", err)
	}
	if _, err := repo.GetByokBackup(ctx, aliceID); !errors.Is(err, domain.ErrByokBackupNotFound) {
		t.Fatalf("esperava ErrByokBackupNotFound após delete, obteve %v", err)
	}
}
