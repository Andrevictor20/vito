package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func (r *sqliteFinanceRepo) UpsertByokBackup(ctx context.Context, backup *domain.FinanceByokBackup) error {
	now := time.Now().UTC()
	backup.UpdatedAt = now
	if backup.KeyVersion <= 0 {
		backup.KeyVersion = 1
	}

	query := `
		INSERT INTO finance_byok_backup (user_id, ciphertext, nonce, key_version, updated_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			ciphertext = excluded.ciphertext,
			nonce = excluded.nonce,
			key_version = excluded.key_version,
			updated_at = excluded.updated_at
	`
	_, err := r.db.ExecContext(ctx, query,
		backup.UserID, backup.Ciphertext, backup.Nonce, backup.KeyVersion, backup.UpdatedAt,
	)
	return err
}

func (r *sqliteFinanceRepo) GetByokBackup(ctx context.Context, userID string) (*domain.FinanceByokBackup, error) {
	query := `
		SELECT user_id, ciphertext, nonce, key_version, updated_at
		FROM finance_byok_backup
		WHERE user_id = ?
	`
	var b domain.FinanceByokBackup
	err := r.db.QueryRowContext(ctx, query, userID).Scan(
		&b.UserID, &b.Ciphertext, &b.Nonce, &b.KeyVersion, &b.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.ErrByokBackupNotFound
	}
	if err != nil {
		return nil, err
	}
	b.UpdatedAt = b.UpdatedAt.UTC()
	return &b, nil
}

func (r *sqliteFinanceRepo) DeleteByokBackup(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM finance_byok_backup WHERE user_id = ?`, userID)
	return err
}
