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

func setupTestContactRepo(t *testing.T) (*repository.ContactRepositorySQLite, *repository.UserRepositorySQLite) {
	t.Helper()
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_contacts.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	contactRepo := repository.NewContactRepository(db)
	return contactRepo, userRepo
}

func TestContactRepository_UpsertAndList(t *testing.T) {
	ctx := context.Background()
	repo, userRepo := setupTestContactRepo(t)

	// Cria usuário
	user := &domain.User{
		ID:           "user-c1",
		Name:         "Usuário Teste",
		Email:        "c1@test.com",
		PasswordHash: "hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	contacts := []domain.SyncedContact{
		{
			ID:          "cnt-1",
			UserID:      "user-c1",
			Phone:       "+55 (98) 98881-9646",
			PhoneDigits: "5598988819646",
			JID:         "5598988819646@s.whatsapp.net",
			LID:         "25419827364@lid",
			SavedName:   "Isa",
			ProfileName: "Bella",
			Source:      "phonebook",
		},
		{
			ID:          "cnt-2",
			UserID:      "user-c1",
			Phone:       "+55 11 97722-4455",
			PhoneDigits: "5511977224455",
			JID:         "5511977224455@s.whatsapp.net",
			SavedName:   "Roberto Jr",
			Source:      "phonebook",
		},
	}

	n, err := repo.UpsertBatch(ctx, contacts)
	if err != nil {
		t.Fatalf("UpsertBatch falhou: %v", err)
	}
	if n != 2 {
		t.Fatalf("esperava 2 contatos inseridos, vieram %d", n)
	}

	// Listar contatos do usuário
	list, err := repo.ListByUserID(ctx, "user-c1")
	if err != nil {
		t.Fatalf("ListByUserID falhou: %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("esperava 2 contatos na lista, vieram %d", len(list))
	}

	// Atualização (Upsert): mesmo telefone com nome atualizado
	updatedContacts := []domain.SyncedContact{
		{
			ID:          "cnt-1-up",
			UserID:      "user-c1",
			Phone:       "+55 98 98881-9646",
			PhoneDigits: "5598988819646",
			SavedName:   "Isa Alvimar",
			Source:      "phonebook",
		},
	}
	n2, err := repo.UpsertBatch(ctx, updatedContacts)
	if err != nil {
		t.Fatalf("UpsertBatch update falhou: %v", err)
	}
	if n2 != 1 {
		t.Fatalf("esperava 1 contato atualizado, vieram %d", n2)
	}

	// Verifica se atualizou o nome sem perder JID/LID/ProfileName
	found, err := repo.GetByJIDOrLID(ctx, "user-c1", "25419827364@lid")
	if err != nil || found == nil {
		t.Fatalf("GetByJIDOrLID falhou: %v", err)
	}
	if found.SavedName != "Isa Alvimar" {
		t.Errorf("esperava 'Isa Alvimar', veio %q", found.SavedName)
	}
	if found.ProfileName != "Bella" {
		t.Errorf("ProfileName deveria ser preservado, veio %q", found.ProfileName)
	}

	// Busca por nome (case insensitive)
	matches, err := repo.FindByNameOrPhone(ctx, "user-c1", "roberto")
	if err != nil {
		t.Fatalf("FindByNameOrPhone falhou: %v", err)
	}
	if len(matches) != 1 || matches[0].SavedName != "Roberto Jr" {
		t.Fatalf("esperava 1 match para 'roberto', vieram %d", len(matches))
	}

	// Isolamento multi-tenant
	otherList, err := repo.ListByUserID(ctx, "user-other")
	if err != nil {
		t.Fatalf("ListByUserID para outro usuário falhou: %v", err)
	}
	if len(otherList) != 0 {
		t.Fatalf("esperava 0 contatos para outro usuário, vieram %d", len(otherList))
	}
}
