package service_test

import (
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

func setupAuthServiceWithSessions(t *testing.T) (*service.AuthService, domain.UserRepository, domain.SessionRepository) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_auth_sessions.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	userRepo := repository.NewUserRepository(db)
	sessionRepo := repository.NewSessionRepository(db)
	authSvc := service.NewAuthService(userRepo, "test-super-secret-jwt-key")
	authSvc.SetSessionRepository(sessionRepo)

	return authSvc, userRepo, sessionRepo
}

func TestAuthService_DualTokenRotationAndSessionGovernance(t *testing.T) {
	authSvc, _, _ := setupAuthServiceWithSessions(t)

	// 1. RegisterWithSession deve emitir Access Token (15 min) + Refresh Token (30 dias)
	user, pair1, err := authSvc.RegisterWithSession("André", "andre@vito.local", "senhaForte123", "Samsung Galaxy S24", "192.168.1.10")
	if err != nil {
		t.Fatalf("esperava sucesso no RegisterWithSession, obteve: %v", err)
	}
	if pair1 == nil || pair1.AccessToken == "" || pair1.RefreshToken == "" || pair1.SessionID == "" {
		t.Fatalf("esperava par de tokens completo e session_id, obteve: %+v", pair1)
	}
	if pair1.ExpiresIn != 900 {
		t.Errorf("esperava ExpiresIn = 900s (15 min), obteve %d", pair1.ExpiresIn)
	}

	claims1, err := authSvc.ValidateToken(pair1.AccessToken)
	if err != nil {
		t.Fatalf("access token deveria ser válido: %v", err)
	}
	if claims1.SessionID != pair1.SessionID {
		t.Errorf("esperava SessionID %s nas claims, obteve %s", pair1.SessionID, claims1.SessionID)
	}
	ttl := time.Until(claims1.ExpiresAt.Time)
	if ttl > 16*time.Minute || ttl < 14*time.Minute {
		t.Errorf("esperava expiração do Access Token em ~15m, obteve %v", ttl)
	}

	// 2. Segundo login em outro aparelho (Web)
	_, pair2, err := authSvc.LoginWithSession("andre@vito.local", "senhaForte123", "Chrome Web (Linux)", "192.168.1.25")
	if err != nil {
		t.Fatalf("esperava sucesso no segundo login, obteve: %v", err)
	}

	// 3. Listagem de sessões ativas deve retornar os 2 aparelhos e marcar IsCurrent
	sessions, err := authSvc.ListSessions(user.ID, pair1.SessionID)
	if err != nil {
		t.Fatalf("erro ao listar sessões: %v", err)
	}
	if len(sessions) != 2 {
		t.Fatalf("esperava 2 sessões ativas, obteve %d", len(sessions))
	}
	var foundCurrent bool
	for _, s := range sessions {
		if s.ID == pair1.SessionID && s.IsCurrent {
			foundCurrent = true
		}
	}
	if !foundCurrent {
		t.Error("esperava que a sessão pair1.SessionID estivesse marcada com IsCurrent=true")
	}

	// 4. Refresh Token Rotation: renova pair1 e invalida o refresh token anterior
	oldRefresh := pair1.RefreshToken
	_, rotatedPair, err := authSvc.RefreshSession(oldRefresh, "Samsung Galaxy S24", "192.168.1.11")
	if err != nil {
		t.Fatalf("esperava sucesso ao rotacionar refresh token, obteve: %v", err)
	}
	if rotatedPair.RefreshToken == oldRefresh {
		t.Error("novo refresh token não pode ser igual ao anterior após rotação")
	}
	if rotatedPair.SessionID != pair1.SessionID {
		t.Errorf("rotação deve preservar o ID da sessão do dispositivo (%s), obteve %s", pair1.SessionID, rotatedPair.SessionID)
	}

	// Tentativa de reutilizar o refresh token antigo deve falhar!
	if _, _, err := authSvc.RefreshSession(oldRefresh, "Atacante", "10.0.0.1"); err == nil {
		t.Error("esperava erro ao tentar reutilizar refresh token já rotacionado")
	}

	// 5. Revogação granular: revogar pair2 (Chrome Web) mantém pair1 ativo
	if err := authSvc.RevokeSession(user.ID, pair2.SessionID); err != nil {
		t.Fatalf("falha ao revogar sessão específica: %v", err)
	}
	if !authSvc.IsSessionRevoked(user.ID, pair2.SessionID) {
		t.Error("esperava que pair2 estivesse revogada")
	}
	if authSvc.IsSessionRevoked(user.ID, pair1.SessionID) {
		t.Error("pair1 NÃO deveria estar revogada")
	}
	if _, _, err := authSvc.RefreshSession(pair2.RefreshToken, "Chrome Web", "192.168.1.25"); err == nil {
		t.Error("refresh token de sessão revogada deveria ser rejeitado")
	}

	// 6. Criar mais 2 sessões e testar "Desconectar de todos os outros dispositivos"
	_, pair3, _ := authSvc.LoginWithSession("andre@vito.local", "senhaForte123", "iPad Pro", "192.168.1.30")
	_, pair4, _ := authSvc.LoginWithSession("andre@vito.local", "senhaForte123", "MacBook Air", "192.168.1.31")

	if err := authSvc.RevokeOtherSessions(user.ID, pair1.SessionID); err != nil {
		t.Fatalf("falha em RevokeOtherSessions: %v", err)
	}
	if !authSvc.IsSessionRevoked(user.ID, pair3.SessionID) || !authSvc.IsSessionRevoked(user.ID, pair4.SessionID) {
		t.Error("todas as outras sessões (pair3, pair4) deveriam ter sido revogadas")
	}
	if authSvc.IsSessionRevoked(user.ID, pair1.SessionID) {
		t.Error("sessão atual (pair1) deveria continuar ativa após RevokeOtherSessions")
	}
}

func TestAuthService_PrunesDuplicateSessions(t *testing.T) {
	authSvc, _, sessionRepo := setupAuthServiceWithSessions(t)

	user, pair1, err := authSvc.RegisterWithSession("André", "andre_dup@vito.local", "senhaForte123", "Android (Vito App)", "192.168.1.50")
	if err != nil {
		t.Fatalf("erro no registro: %v", err)
	}

	// Simula segundo login/issue no mesmo aparelho Android
	_, pair2, err := authSvc.LoginWithSession("andre_dup@vito.local", "senhaForte123", "Android (Vito App)", "192.168.1.50")
	if err != nil {
		t.Fatalf("erro no segundo login: %v", err)
	}

	// Sessão antiga (pair1) deve ter sido revogada automaticamente pelo pruning
	if !authSvc.IsSessionRevoked(user.ID, pair1.SessionID) {
		t.Error("esperava que a sessão anterior do mesmo aparelho (pair1) fosse revogada")
	}
	if authSvc.IsSessionRevoked(user.ID, pair2.SessionID) {
		t.Error("sessão nova (pair2) deveria estar ativa")
	}

	// Simula inserção manual de duplicatas legadas (zumbis) para testar o auto-cleanup do ListSessions
	now := time.Now().UTC()
	_ = sessionRepo.Create(&domain.RefreshToken{
		ID:         "legacy-zombie-1",
		UserID:     user.ID,
		TokenHash:  "hash-zombie-1",
		DeviceName: "Android (Vito App)",
		ExpiresAt:  now.Add(24 * time.Hour),
		CreatedAt:  now.Add(-10 * time.Minute),
		LastUsedAt: now.Add(-10 * time.Minute),
	})
	_ = sessionRepo.Create(&domain.RefreshToken{
		ID:         "legacy-zombie-2",
		UserID:     user.ID,
		TokenHash:  "hash-zombie-2",
		DeviceName: "Android (Vito App)",
		ExpiresAt:  now.Add(24 * time.Hour),
		CreatedAt:  now.Add(-20 * time.Minute),
		LastUsedAt: now.Add(-20 * time.Minute),
	})

	// ListSessions deve filtrar e revogar os zumbis, retornando apenas 1 sessão ativa para o Android
	sessions, err := authSvc.ListSessions(user.ID, pair2.SessionID)
	if err != nil {
		t.Fatalf("erro ao listar sessões: %v", err)
	}
	if len(sessions) != 1 {
		t.Fatalf("esperava apenas 1 sessão ativa após auto-cleanup de duplicatas, obteve %d", len(sessions))
	}
	if sessions[0].ID != pair2.SessionID || !sessions[0].IsCurrent {
		t.Errorf("sessão retornada deve ser pair2 marcada como atual, obteve %+v", sessions[0])
	}
}
