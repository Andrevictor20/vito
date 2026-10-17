package service

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// TokenPair agrupa o Access Token (15m) e o Refresh Token opaco (30d) de uma sessão autenticada.
type TokenPair struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	SessionID    string `json:"session_id"`
	ExpiresIn    int    `json:"expires_in"`
}

// SetSessionRepository injeta o repositório de sessões para rotação de Refresh Tokens.
func (s *AuthService) SetSessionRepository(sessionRepo domain.SessionRepository) {
	s.sessionRepo = sessionRepo
}

// RegisterWithSession cria um novo usuário e inicia uma sessão Dual Token rastreada por dispositivo.
func (s *AuthService) RegisterWithSession(name, email, password, deviceName, ipAddress string) (*domain.User, *TokenPair, error) {
	user, _, err := s.Register(name, email, password)
	if err != nil {
		return nil, nil, err
	}
	pair, err := s.IssueSessionForUser(user, deviceName, ipAddress)
	if err != nil {
		return nil, nil, err
	}
	return user, pair, nil
}

// LoginWithSession valida credenciais e emite o par Access Token (15m) + Refresh Token (30d).
func (s *AuthService) LoginWithSession(email, password, deviceName, ipAddress string) (*domain.User, *TokenPair, error) {
	user, _, err := s.Login(email, password)
	if err != nil {
		return nil, nil, err
	}
	pair, err := s.IssueSessionForUser(user, deviceName, ipAddress)
	if err != nil {
		return nil, nil, err
	}
	return user, pair, nil
}

// IssueSessionForUser gera uma nova sessão (Access + Refresh Token) para o usuário autenticado.
func (s *AuthService) IssueSessionForUser(user *domain.User, deviceName, ipAddress string) (*TokenPair, error) {
	sessionID := uuid.New().String()
	rawRefresh, tokenHash, err := generateOpaqueRefreshToken()
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(deviceName) == "" {
		deviceName = "Dispositivo Vito"
	}

	now := time.Now().UTC()
	if s.sessionRepo != nil {
		rt := &domain.RefreshToken{
			ID:         sessionID,
			UserID:     user.ID,
			TokenHash:  tokenHash,
			DeviceName: strings.TrimSpace(deviceName),
			IPAddress:  strings.TrimSpace(ipAddress),
			ExpiresAt:  now.Add(RefreshTokenTTL),
			CreatedAt:  now,
			LastUsedAt: now,
		}
		if err := s.sessionRepo.Create(rt); err != nil {
			return nil, err
		}
	}

	accessToken, err := s.generateTokenWithSession(user, sessionID)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: rawRefresh,
		SessionID:    sessionID,
		ExpiresIn:    int(AccessTokenTTL.Seconds()),
	}, nil
}

// RefreshSession valida o Refresh Token opaco, executa a rotação atômica (Refresh Token Rotation)
// e emite um novo par de tokens para a mesma sessão.
func (s *AuthService) RefreshSession(rawRefreshToken, deviceName, ipAddress string) (*domain.User, *TokenPair, error) {
	if s.sessionRepo == nil {
		return nil, nil, errors.New("repositório de sessões não configurado")
	}
	rawRefreshToken = strings.TrimSpace(rawRefreshToken)
	if rawRefreshToken == "" {
		return nil, nil, domain.ErrRefreshTokenNotFound
	}

	hash := hashRefreshToken(rawRefreshToken)
	stored, err := s.sessionRepo.GetByHash(hash)
	if err != nil {
		return nil, nil, err
	}

	now := time.Now().UTC()
	if stored.RevokedAt != nil {
		return nil, nil, domain.ErrRefreshTokenRevoked
	}
	if now.After(stored.ExpiresAt) {
		_ = s.sessionRepo.RevokeByID(stored.ID, stored.UserID, now)
		return nil, nil, domain.ErrRefreshTokenExpired
	}

	user, err := s.userRepo.GetByID(stored.UserID)
	if err != nil {
		return nil, nil, err
	}

	newRawRefresh, newHash, err := generateOpaqueRefreshToken()
	if err != nil {
		return nil, nil, err
	}

	if err := s.sessionRepo.RotateToken(stored.ID, stored.UserID, newHash, strings.TrimSpace(ipAddress), now.Add(RefreshTokenTTL), now); err != nil {
		return nil, nil, err
	}

	accessToken, err := s.generateTokenWithSession(user, stored.ID)
	if err != nil {
		return nil, nil, err
	}

	return user, &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: newRawRefresh,
		SessionID:    stored.ID,
		ExpiresIn:    int(AccessTokenTTL.Seconds()),
	}, nil
}

// ListSessions retorna todas as sessões ativas do usuário, destacando a sessão atual (IsCurrent).
func (s *AuthService) ListSessions(userID, currentSessionID string) ([]domain.RefreshToken, error) {
	if s.sessionRepo == nil {
		return []domain.RefreshToken{}, nil
	}
	sessions, err := s.sessionRepo.ListActiveByUser(userID, time.Now().UTC())
	if err != nil {
		return nil, err
	}
	for i := range sessions {
		if currentSessionID != "" && sessions[i].ID == currentSessionID {
			sessions[i].IsCurrent = true
		}
	}
	return sessions, nil
}

// RevokeSession revoga imediatamente um dispositivo específico do usuário.
func (s *AuthService) RevokeSession(userID, sessionID string) error {
	if s.sessionRepo == nil {
		return nil
	}
	return s.sessionRepo.RevokeByID(sessionID, userID, time.Now().UTC())
}

// RevokeOtherSessions desconecta todos os outros aparelhos do usuário, preservando a sessão atual.
func (s *AuthService) RevokeOtherSessions(userID, currentSessionID string) error {
	if s.sessionRepo == nil {
		return nil
	}
	if strings.TrimSpace(currentSessionID) == "" {
		return s.sessionRepo.RevokeAllByUser(userID, time.Now().UTC())
	}
	return s.sessionRepo.RevokeAllByUserExcept(userID, currentSessionID, time.Now().UTC())
}

// LogoutSession encerra a sessão atual (por sessionID e/ou refresh token bruto).
func (s *AuthService) LogoutSession(userID, sessionID, rawRefreshToken string) error {
	if s.sessionRepo == nil {
		return nil
	}
	now := time.Now().UTC()
	if strings.TrimSpace(rawRefreshToken) != "" {
		_ = s.sessionRepo.RevokeByHash(hashRefreshToken(strings.TrimSpace(rawRefreshToken)), now)
	}
	if strings.TrimSpace(sessionID) != "" && strings.TrimSpace(userID) != "" {
		_ = s.sessionRepo.RevokeByID(strings.TrimSpace(sessionID), userID, now)
	}
	return nil
}

// IsSessionRevoked verifica se uma sessão específica foi revogada ou expirou no banco.
func (s *AuthService) IsSessionRevoked(userID, sessionID string) bool {
	if s.sessionRepo == nil || strings.TrimSpace(sessionID) == "" {
		return false
	}
	rt, err := s.sessionRepo.GetByID(sessionID, userID)
	if err != nil {
		return true
	}
	if rt.RevokedAt != nil {
		return true
	}
	if time.Now().UTC().After(rt.ExpiresAt) {
		return true
	}
	return false
}

func generateOpaqueRefreshToken() (raw string, hash string, err error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", "", fmt.Errorf("falha ao gerar refresh token seguro: %w", err)
	}
	raw = "vrt_" + hex.EncodeToString(buf)
	return raw, hashRefreshToken(raw), nil
}

func hashRefreshToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
