package service_test

import (
	"path/filepath"
	"testing"

	"github.com/andrevmp/kito/backend/internal/database"
	"github.com/andrevmp/kito/backend/internal/domain"
	"github.com/andrevmp/kito/backend/internal/repository"
	"github.com/andrevmp/kito/backend/internal/service"
)

func setupAuthService(t *testing.T) (*service.AuthService, domain.UserRepository) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_auth.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	authSvc := service.NewAuthService(userRepo, "test-super-secret-jwt-key")

	return authSvc, userRepo
}

func TestAuthService_RegisterAndLogin(t *testing.T) {
	authSvc, _ := setupAuthService(t)

	// 1. Registro com sucesso
	user, token, err := authSvc.Register("André", "andre@kito.local", "senha12345")
	if err != nil {
		t.Fatalf("expected nil error on register, got: %v", err)
	}
	if user.Email != "andre@kito.local" {
		t.Errorf("expected email andre@kito.local, got %s", user.Email)
	}
	if token == "" {
		t.Errorf("expected non-empty token")
	}

	// 2. Registro duplicado falha
	_, _, err = authSvc.Register("Outro André", "andre@kito.local", "outrasenha")
	if err != domain.ErrUserAlreadyExists {
		t.Errorf("expected ErrUserAlreadyExists, got: %v", err)
	}

	// 3. Login com senha correta
	loggedUser, loginToken, err := authSvc.Login("andre@kito.local", "senha12345")
	if err != nil {
		t.Fatalf("expected nil error on login, got: %v", err)
	}
	if loggedUser.ID != user.ID {
		t.Errorf("expected user id %s, got %s", user.ID, loggedUser.ID)
	}
	if loginToken == "" {
		t.Errorf("expected non-empty login token")
	}

	// 4. Login com senha errada
	_, _, err = authSvc.Login("andre@kito.local", "senha_errada")
	if err != domain.ErrInvalidPassword {
		t.Errorf("expected ErrInvalidPassword, got: %v", err)
	}

	// 5. Validação de Token
	claims, err := authSvc.ValidateToken(loginToken)
	if err != nil {
		t.Fatalf("expected valid token, got error: %v", err)
	}
	if claims.UserID != user.ID {
		t.Errorf("expected claims UserID %s, got %s", user.ID, claims.UserID)
	}
}
