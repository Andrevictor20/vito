package repository_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupDeviceTokenTestDB(t *testing.T) (*repository.DeviceTokenRepositorySQLite, *repository.UserRepositorySQLite) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_vito_notifications.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	return repository.NewDeviceTokenRepository(db), repository.NewUserRepository(db)
}

func TestDeviceTokenRepository_SaveAndFind(t *testing.T) {
	tokenRepo, userRepo := setupDeviceTokenTestDB(t)

	user := &domain.User{
		ID:           "user-notif-1",
		Name:         "User Notif",
		Email:        "notif@example.com",
		PasswordHash: "hashed",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("failed to create user: %v", err)
	}

	dt := &domain.DeviceToken{
		ID:       "dt-1",
		UserID:   user.ID,
		Token:    "ExponentPushToken[xxxxxxxxxxxx]",
		Platform: "expo",
	}

	if err := tokenRepo.Save(dt); err != nil {
		t.Fatalf("failed to save device token: %v", err)
	}

	// Idempotência / Upsert no mesmo token
	dt.Platform = "android"
	if err := tokenRepo.Save(dt); err != nil {
		t.Fatalf("failed to update device token on conflict: %v", err)
	}

	tokens, err := tokenRepo.FindByUserID(user.ID)
	if err != nil {
		t.Fatalf("failed to find tokens: %v", err)
	}
	if len(tokens) != 1 {
		t.Fatalf("expected 1 token, got %d", len(tokens))
	}
	if tokens[0].Platform != "android" {
		t.Errorf("expected platform android after upsert, got %s", tokens[0].Platform)
	}

	// Deletar
	if err := tokenRepo.Delete(user.ID, dt.Token); err != nil {
		t.Fatalf("failed to delete token: %v", err)
	}

	tokensAfter, err := tokenRepo.FindByUserID(user.ID)
	if err != nil {
		t.Fatalf("failed to find tokens after delete: %v", err)
	}
	if len(tokensAfter) != 0 {
		t.Errorf("expected 0 tokens after delete, got %d", len(tokensAfter))
	}
}

func TestDeviceTokenRepository_CrossAccountDeviceReassignment(t *testing.T) {
	tokenRepo, userRepo := setupDeviceTokenTestDB(t)

	userA := &domain.User{
		ID:           "user-alpha",
		Name:         "User Alpha",
		Email:        "alpha@example.com",
		PasswordHash: "hashed",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	userB := &domain.User{
		ID:           "user-beta",
		Name:         "User Beta",
		Email:        "beta@example.com",
		PasswordHash: "hashed",
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(userA); err != nil {
		t.Fatalf("failed to create user A: %v", err)
	}
	if err := userRepo.Create(userB); err != nil {
		t.Fatalf("failed to create user B: %v", err)
	}

	sharedDeviceToken := "ExponentPushToken[shared-phone-hardware-xyz]"

	// 1. User A registra o token no aparelho
	dtA := &domain.DeviceToken{
		ID:       "dt-a",
		UserID:   userA.ID,
		Token:    sharedDeviceToken,
		Platform: "android",
	}
	if err := tokenRepo.Save(dtA); err != nil {
		t.Fatalf("failed to save token for user A: %v", err)
	}

	tokensA, err := tokenRepo.FindByUserID(userA.ID)
	if err != nil || len(tokensA) != 1 {
		t.Fatalf("expected user A to have 1 token, got %v", tokensA)
	}

	// 2. User B faz login no MESMO aparelho com o MESMO token físico
	dtB := &domain.DeviceToken{
		ID:       "dt-b",
		UserID:   userB.ID,
		Token:    sharedDeviceToken,
		Platform: "android",
	}
	if err := tokenRepo.Save(dtB); err != nil {
		t.Fatalf("failed to save token for user B: %v", err)
	}

	// 3. User B deve ter o token
	tokensB, err := tokenRepo.FindByUserID(userB.ID)
	if err != nil || len(tokensB) != 1 {
		t.Fatalf("expected user B to have 1 token, got %v", tokensB)
	}

	// 4. User A NÃO PODE MAIS TER ESSE TOKEN (deve ter sido desvinculado para evitar push leakage)
	tokensAAfter, err := tokenRepo.FindByUserID(userA.ID)
	if err != nil {
		t.Fatalf("failed to find tokens for user A after reassignment: %v", err)
	}
	for _, tok := range tokensAAfter {
		if tok.Token == sharedDeviceToken {
			t.Fatalf("CRITICAL SECURITY FAILURE: User A still has push token %s after User B claimed the device!", sharedDeviceToken)
		}
	}
}

