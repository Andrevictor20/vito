package repository_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/kito/backend/internal/database"
	"github.com/andrevmp/kito/backend/internal/domain"
	"github.com/andrevmp/kito/backend/internal/repository"
)

func setupTestDB(t *testing.T) *repository.UserRepositorySQLite {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_kito.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	return repository.NewUserRepository(db)
}

func TestUserRepository_CreateAndGet(t *testing.T) {
	repo := setupTestDB(t)

	user := &domain.User{
		ID:           "user-1",
		Name:         "André Teste",
		Email:        "andre@example.com",
		PasswordHash: "hashed_secret",
		CreatedAt:    time.Now().UTC().Truncate(time.Second),
		UpdatedAt:    time.Now().UTC().Truncate(time.Second),
	}

	err := repo.Create(user)
	if err != nil {
		t.Fatalf("expected nil error on create, got: %v", err)
	}

	// Busca por ID
	found, err := repo.GetByID("user-1")
	if err != nil {
		t.Fatalf("expected nil error on get by id, got: %v", err)
	}
	if found.Email != user.Email {
		t.Errorf("expected email %s, got %s", user.Email, found.Email)
	}

	// Busca por Email
	byEmail, err := repo.GetByEmail("andre@example.com")
	if err != nil {
		t.Fatalf("expected nil error on get by email, got: %v", err)
	}
	if byEmail.ID != user.ID {
		t.Errorf("expected id %s, got %s", user.ID, byEmail.ID)
	}

	// Não encontrado
	_, err = repo.GetByID("nao-existe")
	if err != domain.ErrUserNotFound {
		t.Errorf("expected ErrUserNotFound, got: %v", err)
	}
}
