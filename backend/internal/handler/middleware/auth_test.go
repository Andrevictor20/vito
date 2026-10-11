package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupAuthMiddlewareTest(t *testing.T) (*service.AuthService, domain.UserRepository) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_mw_auth.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	authSvc := service.NewAuthService(userRepo, "test-super-secret-jwt-key-32chars!")

	return authSvc, userRepo
}

func TestAuthMiddleware_TokenVersionRevocation(t *testing.T) {
	authSvc, userRepo := setupAuthMiddlewareTest(t)

	// Cria usuário
	user := &domain.User{
		ID:           "user-revocation-test",
		Name:         "Carlos",
		Email:        "carlos@vito.local",
		PasswordHash: "hashed",
		TokenVersion: 1,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	token1, err := authSvc.GenerateTokenForUser(user)
	if err != nil {
		t.Fatalf("falha ao gerar token: %v", err)
	}

	dummyHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID, ok := middleware.UserIDFromContext(r.Context())
		if !ok || userID != user.ID {
			t.Errorf("esperava userID %s no contexto, obteve: %s", user.ID, userID)
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("autenticado"))
	})

	mw := middleware.AuthMiddleware(authSvc)(dummyHandler)

	// 1. Requisição com token1 ativo -> 200 OK
	req1 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req1.Header.Set("Authorization", "Bearer "+token1)
	rr1 := httptest.NewRecorder()
	mw.ServeHTTP(rr1, req1)

	if rr1.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK para token1 ativo, obteve: %d - %s", rr1.Code, rr1.Body.String())
	}

	// 2. Revogação de sessões do usuário (incrementa TokenVersion no banco)
	if err := authSvc.RevokeAllSessions(user.ID); err != nil {
		t.Fatalf("falha ao revogar sessões: %v", err)
	}

	// 3. Requisição subsequente com o token1 antigo DEVE ser rejeitada com 401
	req2 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req2.Header.Set("Authorization", "Bearer "+token1)
	rr2 := httptest.NewRecorder()
	mw.ServeHTTP(rr2, req2)

	if rr2.Code != http.StatusUnauthorized {
		t.Fatalf("CRITICAL SECURITY FAILURE: esperava 401 Unauthorized após revogação de sessão, obteve: %d", rr2.Code)
	}

	// 4. Novo token gerado após a revogação DEVE ser aceito com 200 OK
	dbUserUpdated, _ := userRepo.GetByID(user.ID)
	token2, err := authSvc.GenerateTokenForUser(dbUserUpdated)
	if err != nil {
		t.Fatalf("falha ao gerar token2: %v", err)
	}

	req3 := httptest.NewRequest(http.MethodGet, "/protected", nil)
	req3.Header.Set("Authorization", "Bearer "+token2)
	rr3 := httptest.NewRecorder()
	mw.ServeHTTP(rr3, req3)

	if rr3.Code != http.StatusOK {
		t.Fatalf("esperava 200 OK para novo token2 após revogação, obteve: %d - %s", rr3.Code, rr3.Body.String())
	}
}
