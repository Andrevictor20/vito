package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// GmailRepositorySQLite implementa domain.GmailRepository usando SQLite.
type GmailRepositorySQLite struct {
	db *sql.DB
}

// NewGmailRepository cria uma nova instância do repositório SQLite para Gmail.
func NewGmailRepository(db *sql.DB) *GmailRepositorySQLite {
	return &GmailRepositorySQLite{db: db}
}

// GetByUserID busca a integração ativa pelo ID do usuário.
func (r *GmailRepositorySQLite) GetByUserID(ctx context.Context, userID string) (*domain.GmailIntegration, error) {
	query := `
		SELECT id, user_id, account_email, encrypted_credentials, status, history_id, last_scanned_at, created_at, updated_at
		FROM gmail_integrations
		WHERE user_id = ?
		LIMIT 1
	`
	var g domain.GmailIntegration
	var historyID sql.NullString
	var lastScannedAt sql.NullTime

	err := r.db.QueryRowContext(ctx, query, userID).Scan(
		&g.ID,
		&g.UserID,
		&g.AccountEmail,
		&g.EncryptedCredentials,
		&g.Status,
		&historyID,
		&lastScannedAt,
		&g.CreatedAt,
		&g.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrGmailNotConnected
		}
		return nil, err
	}

	if historyID.Valid {
		g.HistoryID = historyID.String
	}
	if lastScannedAt.Valid {
		t := lastScannedAt.Time
		g.LastScannedAt = &t
	}

	return &g, nil
}

// Upsert insere ou atualiza a integração com o Gmail do usuário.
func (r *GmailRepositorySQLite) Upsert(ctx context.Context, g *domain.GmailIntegration) error {
	if g.ID == "" {
		g.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	if g.CreatedAt.IsZero() {
		g.CreatedAt = now
	}
	g.UpdatedAt = now

	query := `
		INSERT INTO gmail_integrations (
			id, user_id, account_email, encrypted_credentials, status, history_id, last_scanned_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			account_email = excluded.account_email,
			encrypted_credentials = excluded.encrypted_credentials,
			status = excluded.status,
			history_id = COALESCE(excluded.history_id, gmail_integrations.history_id),
			last_scanned_at = COALESCE(excluded.last_scanned_at, gmail_integrations.last_scanned_at),
			updated_at = excluded.updated_at
	`
	_, err := r.db.ExecContext(ctx, query,
		g.ID,
		g.UserID,
		g.AccountEmail,
		g.EncryptedCredentials,
		g.Status,
		g.HistoryID,
		g.LastScannedAt,
		g.CreatedAt,
		g.UpdatedAt,
	)
	return err
}

// UpdateStatus altera o status da integração (ex: active, reauth_required, disconnected).
func (r *GmailRepositorySQLite) UpdateStatus(ctx context.Context, userID, status string) error {
	query := `
		UPDATE gmail_integrations
		SET status = ?, updated_at = ?
		WHERE user_id = ?
	`
	res, err := r.db.ExecContext(ctx, query, status, time.Now().UTC(), userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrGmailNotConnected
	}
	return nil
}

// UpdateLastScanned atualiza o historyID e timestamp da última varredura.
func (r *GmailRepositorySQLite) UpdateLastScanned(ctx context.Context, userID, historyID string, scannedAt time.Time) error {
	query := `
		UPDATE gmail_integrations
		SET history_id = ?, last_scanned_at = ?, updated_at = ?
		WHERE user_id = ?
	`
	res, err := r.db.ExecContext(ctx, query, historyID, scannedAt, time.Now().UTC(), userID)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrGmailNotConnected
	}
	return nil
}

// DeleteByUserID remove o registro da integração do usuário.
func (r *GmailRepositorySQLite) DeleteByUserID(ctx context.Context, userID string) error {
	query := `DELETE FROM gmail_integrations WHERE user_id = ?`
	_, err := r.db.ExecContext(ctx, query, userID)
	return err
}
