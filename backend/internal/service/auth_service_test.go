package service_test

import (
	"path/filepath"
	"testing"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
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
	_, _, err = authSvc.Register("Outro André", "andre@kito.local", "outrasenha123")
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

func TestAuthService_CaseInsensitiveEmailAndTrim(t *testing.T) {
	authSvc, _ := setupAuthService(t)

	// 1. Registro com espaços e maiúsculas
	user, _, err := authSvc.Register("André", "  Andre.Silva@Kito.Local  ", "senha12345")
	if err != nil {
		t.Fatalf("expected nil error on register, got: %v", err)
	}
	if user.Email != "andre.silva@kito.local" {
		t.Errorf("expected normalized email andre.silva@kito.local, got %s", user.Email)
	}

	// 2. Login com formatação limpa
	loggedUser, _, err := authSvc.Login("andre.silva@kito.local", "senha12345")
	if err != nil {
		t.Fatalf("expected successful login with clean email, got: %v", err)
	}
	if loggedUser.ID != user.ID {
		t.Errorf("expected user id %s, got %s", user.ID, loggedUser.ID)
	}

	// 3. Login com espaços no input
	_, _, err = authSvc.Login(" andre.silva@kito.local ", "senha12345")
	if err != nil {
		t.Fatalf("expected successful login with padded email, got: %v", err)
	}
}

func TestAuthService_PasswordPolicy(t *testing.T) {
	authSvc, _ := setupAuthService(t)

	// Menos de 8 caracteres
	_, _, err := authSvc.Register("João", "joao1@kito.local", "abc1234")
	if err == nil {
		t.Error("esperava erro para senha < 8 caracteres")
	}

	// 8 caracteres apenas letras (sem números)
	_, _, err = authSvc.Register("João", "joao2@kito.local", "abcdefgh")
	if err == nil {
		t.Error("esperava erro para senha sem números")
	}

	// 8 caracteres apenas números (sem letras)
	_, _, err = authSvc.Register("João", "joao3@kito.local", "12345678")
	if err == nil {
		t.Error("esperava erro para senha sem letras")
	}

	// Senha válida com letras e números
	user, token, err := authSvc.Register("João", "joao4@kito.local", "segura123")
	if err != nil {
		t.Fatalf("esperava sucesso para senha forte, obteve: %v", err)
	}
	if user == nil || token == "" {
		t.Error("esperava usuário e token gerados")
	}
}

func TestAuthService_RevokeAllSessions(t *testing.T) {
	authSvc, userRepo := setupAuthService(t)

	user, token1, err := authSvc.Register("Maria", "maria@kito.local", "senhaForte2026")
	if err != nil {
		t.Fatalf("falha ao registrar: %v", err)
	}

	// 1. Token 1 é válido
	claims1, err := authSvc.ValidateToken(token1)
	if err != nil {
		t.Fatalf("token1 deveria ser válido: %v", err)
	}
	dbUser, _ := userRepo.GetByID(user.ID)
	if claims1.TokenVersion != dbUser.TokenVersion {
		t.Errorf("token_version deveria ser %d, claims tem %d", dbUser.TokenVersion, claims1.TokenVersion)
	}

	// 2. Revogação de todas as sessões
	if err := authSvc.RevokeAllSessions(user.ID); err != nil {
		t.Fatalf("falha ao revogar sessões: %v", err)
	}

	// 3. Usuário no banco agora tem token_version incrementado
	dbUserAfter, _ := userRepo.GetByID(user.ID)
	if dbUserAfter.TokenVersion != dbUser.TokenVersion+1 {
		t.Errorf("esperava token_version incrementado para %d, obteve %d", dbUser.TokenVersion+1, dbUserAfter.TokenVersion)
	}

	// 4. Token anterior agora tem versão defasada em relação ao banco
	if claims1.TokenVersion == dbUserAfter.TokenVersion {
		t.Error("token anterior não deveria coincidir com a nova versão no banco")
	}

	// 5. Novo login gera token com a nova versão
	_, token2, err := authSvc.Login("maria@kito.local", "senhaForte2026")
	if err != nil {
		t.Fatalf("login após reset falhou: %v", err)
	}
	claims2, err := authSvc.ValidateToken(token2)
	if err != nil {
		t.Fatalf("token2 deveria ser válido: %v", err)
	}
	if claims2.TokenVersion != dbUserAfter.TokenVersion {
		t.Errorf("token2 deveria ter token_version %d, obteve %d", dbUserAfter.TokenVersion, claims2.TokenVersion)
	}
}

