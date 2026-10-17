package domain

import (
	"errors"
	"time"
)

var (
	ErrRefreshTokenNotFound = errors.New("sessão ou refresh token não encontrado")
	ErrRefreshTokenExpired  = errors.New("sessão expirada, faça login novamente")
	ErrRefreshTokenRevoked  = errors.New("sessão revogada, faça login novamente")
)

// RefreshToken representa uma sessão de dispositivo autenticada via Refresh Token rotativo (Sprint 13).
type RefreshToken struct {
	ID         string     `json:"id"`
	UserID     string     `json:"user_id"`
	TokenHash  string     `json:"-"`
	DeviceName string     `json:"device_name"`
	IPAddress  string     `json:"ip_address"`
	ExpiresAt  time.Time  `json:"expires_at"`
	RevokedAt  *time.Time `json:"revoked_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt time.Time  `json:"last_used_at"`
	IsCurrent  bool       `json:"is_current"`
}

// SessionRepository define o contrato de persistência para sessões e refresh tokens no SQLite.
type SessionRepository interface {
	Create(rt *RefreshToken) error
	GetByHash(tokenHash string) (*RefreshToken, error)
	GetByID(id, userID string) (*RefreshToken, error)
	ListActiveByUser(userID string, now time.Time) ([]RefreshToken, error)
	RotateToken(oldID, userID, newTokenHash, ipAddress string, newExpiresAt, now time.Time) error
	RevokeByID(id, userID string, revokedAt time.Time) error
	RevokeByHash(tokenHash string, revokedAt time.Time) error
	RevokeAllByUserExcept(userID, keepID string, revokedAt time.Time) error
	RevokeAllByUser(userID string, revokedAt time.Time) error
}
