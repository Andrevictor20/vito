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

func setupWhatsAppTestDB(t *testing.T) (*repository.WhatsAppRepositorySQLite, *repository.UserRepositorySQLite) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_whatsapp.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir sqlite de teste: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	return repository.NewWhatsAppRepository(db), repository.NewUserRepository(db)
}

func TestWhatsAppRepository_CRUD(t *testing.T) {
	ctx := context.Background()
	repo, userRepo := setupWhatsAppTestDB(t)

	// Cria usuário
	user := &domain.User{
		ID:           "user-wa-1",
		Name:         "Usuário Zap",
		Email:        "zap@example.com",
		PasswordHash: "secret-hash",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	// 1. Get inexistente retorna ErrWhatsAppIntegrationNotFound
	_, err := repo.GetByUserID(ctx, user.ID)
	if err != domain.ErrWhatsAppIntegrationNotFound {
		t.Fatalf("esperava ErrWhatsAppIntegrationNotFound, obteve %v", err)
	}

	// 2. Upsert novo
	integration := &domain.WhatsAppIntegration{
		ID:           "wa-int-1",
		UserID:       user.ID,
		InstanceName: "vito_user_wa_1",
		Phone:        "5511999998888",
		Status:       domain.WhatsAppStatusConnecting,
		PairingCode:  "1234-5678",
	}
	if err := repo.Upsert(ctx, integration); err != nil {
		t.Fatalf("falha no Upsert inicial: %v", err)
	}

	// 3. GetByUserID
	found, err := repo.GetByUserID(ctx, user.ID)
	if err != nil {
		t.Fatalf("falha ao buscar por userID: %v", err)
	}
	if found.PairingCode != "1234-5678" || found.Phone != "5511999998888" {
		t.Errorf("dados incorretos: %+v", found)
	}

	// 4. GetByInstanceName
	foundByInst, err := repo.GetByInstanceName(ctx, "vito_user_wa_1")
	if err != nil {
		t.Fatalf("falha ao buscar por instanceName: %v", err)
	}
	if foundByInst.ID != found.ID {
		t.Errorf("ID diferente ao buscar por instância: %s vs %s", foundByInst.ID, found.ID)
	}

	// 5. UpdateStatus para Connected
	now := time.Now().UTC()
	if err := repo.UpdateStatus(ctx, found.ID, domain.WhatsAppStatusConnected, &now); err != nil {
		t.Fatalf("falha ao atualizar status: %v", err)
	}

	updated, err := repo.GetByUserID(ctx, user.ID)
	if err != nil {
		t.Fatalf("falha ao buscar atualizado: %v", err)
	}
	if updated.Status != domain.WhatsAppStatusConnected || updated.LastConnectedAt == nil {
		t.Errorf("status não atualizou corretamente: %+v", updated)
	}

	// 6. Delete
	if err := repo.Delete(ctx, user.ID); err != nil {
		t.Fatalf("falha ao deletar: %v", err)
	}

	_, err = repo.GetByUserID(ctx, user.ID)
	if err != domain.ErrWhatsAppIntegrationNotFound {
		t.Fatalf("esperava ErrWhatsAppIntegrationNotFound após delete, obteve %v", err)
	}
}
