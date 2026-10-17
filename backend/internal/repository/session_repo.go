package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// SessionRepositorySQLite implementa domain.SessionRepository usando SQLite.
type SessionRepositorySQLite struct {
	db *sql.DB
}

// NewSessionRepository instancia um repositório de sessões/refresh tokens SQLite.
func NewSessionRepository(db *sql.DB) *SessionRepositorySQLite {
	return &SessionRepositorySQLite{db: db}
}

func (r *SessionRepositorySQLite) Create(rt *domain.RefreshToken) error {
	now := time.Now().UTC()
	if rt.CreatedAt.IsZero() {
		rt.CreatedAt = now
	}
	if rt.LastUsedAt.IsZero() {
		rt.LastUsedAt = now
	}
	if rt.DeviceName == "" {
		rt.DeviceName = "Dispositivo Vito"
	}

	_, err := r.db.Exec(`
		INSERT INTO refresh_tokens (id, user_id, token_hash, device_name, ip_address, expires_at, revoked_at, created_at, last_used_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, rt.ID, rt.UserID, rt.TokenHash, rt.DeviceName, rt.IPAddress, rt.ExpiresAt.UTC(), rt.RevokedAt, rt.CreatedAt.UTC(), rt.LastUsedAt.UTC())
	return err
}

func (r *SessionRepositorySQLite) scanSession(row interface{ Scan(dest ...any) error }) (*domain.RefreshToken, error) {
	var rt domain.RefreshToken
	var revokedAt sql.NullTime
	err := row.Scan(
		&rt.ID,
		&rt.UserID,
		&rt.TokenHash,
		&rt.DeviceName,
		&rt.IPAddress,
		&rt.ExpiresAt,
		&revokedAt,
		&rt.CreatedAt,
		&rt.LastUsedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrRefreshTokenNotFound
		}
		return nil, err
	}
	if revokedAt.Valid {
		t := revokedAt.Time.UTC()
		rt.RevokedAt = &t
	}
	return &rt, nil
}

func (r *SessionRepositorySQLite) GetByHash(tokenHash string) (*domain.RefreshToken, error) {
	row := r.db.QueryRow(`
		SELECT id, user_id, token_hash, device_name, ip_address, expires_at, revoked_at, created_at, last_used_at
		FROM refresh_tokens
		WHERE token_hash = ?
	`, tokenHash)
	return r.scanSession(row)
}

func (r *SessionRepositorySQLite) GetByID(id, userID string) (*domain.RefreshToken, error) {
	row := r.db.QueryRow(`
		SELECT id, user_id, token_hash, device_name, ip_address, expires_at, revoked_at, created_at, last_used_at
		FROM refresh_tokens
		WHERE id = ? AND user_id = ?
	`, id, userID)
	return r.scanSession(row)
}

func (r *SessionRepositorySQLite) ListActiveByUser(userID string, now time.Time) ([]domain.RefreshToken, error) {
	rows, err := r.db.Query(`
		SELECT id, user_id, token_hash, device_name, ip_address, expires_at, revoked_at, created_at, last_used_at
		FROM refresh_tokens
		WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ?
		ORDER BY last_used_at DESC, created_at DESC
	`, userID, now.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.RefreshToken
	for rows.Next() {
		rt, err := r.scanSession(rows)
		if err != nil {
			return nil, err
		}
		list = append(list, *rt)
	}
	return list, rows.Err()
}

// RotateToken substitui atomicamente o hash de um refresh token ativo (Refresh Token Rotation).
func (r *SessionRepositorySQLite) RotateToken(id, userID, newTokenHash, ipAddress string, newExpiresAt, now time.Time) error {
	var query string
	var args []any
	if ipAddress != "" {
		query = `
			UPDATE refresh_tokens
			SET token_hash = ?, ip_address = ?, expires_at = ?, last_used_at = ?
			WHERE id = ? AND user_id = ? AND revoked_at IS NULL
		`
		args = []any{newTokenHash, ipAddress, newExpiresAt.UTC(), now.UTC(), id, userID}
	} else {
		query = `
			UPDATE refresh_tokens
			SET token_hash = ?, expires_at = ?, last_used_at = ?
			WHERE id = ? AND user_id = ? AND revoked_at IS NULL
		`
		args = []any{newTokenHash, newExpiresAt.UTC(), now.UTC(), id, userID}
	}

	res, err := r.db.Exec(query, args...)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return domain.ErrRefreshTokenRevoked
	}
	return nil
}

func (r *SessionRepositorySQLite) RevokeByID(id, userID string, revokedAt time.Time) error {
	res, err := r.db.Exec(`
		UPDATE refresh_tokens
		SET revoked_at = ?
		WHERE id = ? AND user_id = ? AND revoked_at IS NULL
	`, revokedAt.UTC(), id, userID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return domain.ErrRefreshTokenNotFound
	}
	return nil
}

func (r *SessionRepositorySQLite) RevokeByHash(tokenHash string, revokedAt time.Time) error {
	_, err := r.db.Exec(`
		UPDATE refresh_tokens
		SET revoked_at = ?
		WHERE token_hash = ? AND revoked_at IS NULL
	`, revokedAt.UTC(), tokenHash)
	return err
}

func (r *SessionRepositorySQLite) RevokeAllByUserExcept(userID, keepID string, revokedAt time.Time) error {
	_, err := r.db.Exec(`
		UPDATE refresh_tokens
		SET revoked_at = ?
		WHERE user_id = ? AND id != ? AND revoked_at IS NULL
	`, revokedAt.UTC(), userID, keepID)
	return err
}

func (r *SessionRepositorySQLite) RevokeAllByUser(userID string, revokedAt time.Time) error {
	_, err := r.db.Exec(`
		UPDATE refresh_tokens
		SET revoked_at = ?
		WHERE user_id = ? AND revoked_at IS NULL
	`, revokedAt.UTC(), userID)
	return err
}
