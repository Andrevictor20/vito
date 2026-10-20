package repository_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupTestDB(t *testing.T) *repository.UserRepositorySQLite {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_vito.db")

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

// TestUserRepository_UpdatePhone_NormalizesToE164 garante que o telefone seja sempre
// gravado em E.164, evitando o mesmo número existir em formatos diferentes.
func TestUserRepository_UpdatePhone_NormalizesToE164(t *testing.T) {
	repo := setupTestDB(t)

	user := &domain.User{
		ID:        "user-phone-norm",
		Name:      "André Teste",
		Email:     "phone.norm@test.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := repo.Create(user); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	// Grava no formato legado (sem '+') e espera normalização em E.164
	if err := repo.UpdatePhone(user.ID, "5598984417165"); err != nil {
		t.Fatalf("falha ao atualizar telefone: %v", err)
	}

	found, err := repo.GetByID(user.ID)
	if err != nil {
		t.Fatalf("falha ao reler usuário: %v", err)
	}
	if found.Phone == nil {
		t.Fatal("telefone não foi persistido")
	}
	if *found.Phone != "+5598984417165" {
		t.Errorf("esperava telefone '+5598984417165', obteve %q", *found.Phone)
	}

	// Limpar o telefone continua funcionando
	if err := repo.UpdatePhone(user.ID, ""); err != nil {
		t.Fatalf("falha ao limpar telefone: %v", err)
	}
	found, err = repo.GetByID(user.ID)
	if err != nil {
		t.Fatalf("falha ao reler usuário: %v", err)
	}
	if found.Phone != nil {
		t.Errorf("esperava telefone vazio, obteve %q", *found.Phone)
	}
}

// TestUserRepository_GetByPhone_MatchesEquivalentFormats garante que a busca por telefone
// encontre a conta mesmo quando o número foi gravado em outro formato equivalente.
func TestUserRepository_GetByPhone_MatchesEquivalentFormats(t *testing.T) {
	repo := setupTestDB(t)

	// Simula o estado legado de produção: telefone gravado sem '+'
	legacyPhone := "5598984417165"
	user := &domain.User{
		ID:        "user-phone-legacy",
		Name:      "André Teste",
		Email:     "phone.legacy@test.com",
		Phone:     &legacyPhone,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := repo.Create(user); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	for _, query := range []string{
		"5598984417165",
		"+5598984417165",
		"+55 (98) 98441-7165",
		"559884417165",  // variante de 8 dígitos
		"+559884417165", // variante de 8 dígitos
	} {
		found, err := repo.GetByPhone(query)
		if err != nil {
			t.Fatalf("busca por %q falhou: %v", query, err)
		}
		if found.ID != user.ID {
			t.Errorf("busca por %q retornou %s, esperava %s", query, found.ID, user.ID)
		}
	}

	// Telefone realmente diferente não deve encontrar
	if _, err := repo.GetByPhone("+5511888887777"); err != domain.ErrUserNotFound {
		t.Errorf("esperava ErrUserNotFound para telefone alheio, obteve %v", err)
	}
}
