package repository

import (
	"database/sql"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// DeviceTokenRepositorySQLite implementa domain.DeviceTokenRepository usando SQLite.
type DeviceTokenRepositorySQLite struct {
	db *sql.DB
}

// NewDeviceTokenRepository instancia um repositório SQLite para tokens de push.
func NewDeviceTokenRepository(db *sql.DB) *DeviceTokenRepositorySQLite {
	return &DeviceTokenRepositorySQLite{db: db}
}

// Save insere ou atualiza um token de dispositivo garantindo isolamento por user_id e exclusividade de hardware.
func (r *DeviceTokenRepositorySQLite) Save(dt *domain.DeviceToken) error {
	tx, err := r.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// 1. Desassocia o token físico de qualquer conta anterior no mesmo aparelho para prevenir push leakage
	cleanupQuery := `DELETE FROM device_tokens WHERE token = ? AND user_id != ?`
	if _, err := tx.Exec(cleanupQuery, dt.Token, dt.UserID); err != nil {
		return err
	}

	// 2. Insere ou atualiza para o usuário atual
	query := `
		INSERT INTO device_tokens (id, user_id, token, platform, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id, token) DO UPDATE SET
			platform = excluded.platform,
			updated_at = excluded.updated_at
	`
	now := time.Now().UTC()
	if dt.CreatedAt.IsZero() {
		dt.CreatedAt = now
	}
	dt.UpdatedAt = now

	if _, err := tx.Exec(query, dt.ID, dt.UserID, dt.Token, dt.Platform, dt.CreatedAt, dt.UpdatedAt); err != nil {
		return err
	}

	return tx.Commit()
}


// FindByUserID recupera todos os tokens de dispositivo associados a um usuário.
func (r *DeviceTokenRepositorySQLite) FindByUserID(userID string) ([]domain.DeviceToken, error) {
	query := `
		SELECT id, user_id, token, platform, created_at, updated_at
		FROM device_tokens
		WHERE user_id = ?
		ORDER BY updated_at DESC
	`
	rows, err := r.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []domain.DeviceToken
	for rows.Next() {
		var dt domain.DeviceToken
		if err := rows.Scan(&dt.ID, &dt.UserID, &dt.Token, &dt.Platform, &dt.CreatedAt, &dt.UpdatedAt); err != nil {
			return nil, err
		}
		tokens = append(tokens, dt)
	}

	return tokens, rows.Err()
}

// Delete remove um token de dispositivo específico de um usuário.
func (r *DeviceTokenRepositorySQLite) Delete(userID, token string) error {
	query := `DELETE FROM device_tokens WHERE user_id = ? AND token = ?`
	_, err := r.db.Exec(query, userID, token)
	return err
}
