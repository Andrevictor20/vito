package repository_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupMemoryTestDB(t *testing.T) (*repository.MemoryRepositorySQLite, *repository.UserRepositorySQLite) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_vito_memory.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)

	_ = userRepo.Create(&domain.User{
		ID:           "user-mem-1",
		Name:         "User Memory",
		Email:        "mem@example.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	})

	return memoryRepo, userRepo
}

func TestMemoryRepository_Lifecycle(t *testing.T) {
	memoryRepo, _ := setupMemoryTestDB(t)

	now := time.Now().UTC().Truncate(time.Second)

	mem := &domain.Memory{
		ID:        "mem-1",
		UserID:    "user-mem-1",
		Category:  "family",
		Content:   "Alice tem natação às terças e quintas às 16h",
		CreatedAt: now,
		UpdatedAt: now,
	}

	if err := memoryRepo.Create(mem); err != nil {
		t.Fatalf("failed to create memory: %v", err)
	}

	// Buscar por ID
	found, err := memoryRepo.GetByID("mem-1", "user-mem-1")
	if err != nil {
		t.Fatalf("failed to get memory by id: %v", err)
	}
	if found.Content != mem.Content {
		t.Errorf("expected content %q, got %q", mem.Content, found.Content)
	}

	// Listar por usuário
	list, err := memoryRepo.ListByUser("user-mem-1", 10)
	if err != nil {
		t.Fatalf("failed to list memories: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 memory, got %d", len(list))
	}

	// Deletar
	if err := memoryRepo.Delete("mem-1", "user-mem-1"); err != nil {
		t.Fatalf("failed to delete memory: %v", err)
	}

	// Verificar deleção
	_, err = memoryRepo.GetByID("mem-1", "user-mem-1")
	if err != domain.ErrMemoryNotFound {
		t.Errorf("expected ErrMemoryNotFound, got %v", err)
	}
}
