package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppAuthRepositorySQLite implementa domain.WhatsAppAuthRepository usando SQLite.
type WhatsAppAuthRepositorySQLite struct {
	db *sql.DB
}

// NewWhatsAppAuthRepository cria uma nova instância do repositório SQLite para OTP de WhatsApp.
func NewWhatsAppAuthRepository(db *sql.DB) *WhatsAppAuthRepositorySQLite {
	return &WhatsAppAuthRepositorySQLite{db: db}
}

// SaveOTP armazena ou substitui o código de uso único para o telefone.
func (r *WhatsAppAuthRepositorySQLite) SaveOTP(ctx context.Context, phone, otpHash string, expiresAt time.Time) error {
	query := `
		INSERT INTO whatsapp_auth_otps (phone, otp_hash, attempts, expires_at, created_at)
		VALUES (?, ?, 0, ?, ?)
		ON CONFLICT(phone) DO UPDATE SET
			otp_hash = excluded.otp_hash,
			attempts = 0,
			expires_at = excluded.expires_at,
			created_at = excluded.created_at
	`
	_, err := r.db.ExecContext(ctx, query, phone, otpHash, expiresAt.UTC(), time.Now().UTC())
	return err
}

// GetOTP busca o registro de OTP pelo telefone.
func (r *WhatsAppAuthRepositorySQLite) GetOTP(ctx context.Context, phone string) (*domain.WhatsAppAuthOTP, error) {
	query := `
		SELECT phone, otp_hash, attempts, expires_at, created_at
		FROM whatsapp_auth_otps
		WHERE phone = ?
		LIMIT 1
	`
	var o domain.WhatsAppAuthOTP
	err := r.db.QueryRowContext(ctx, query, phone).Scan(
		&o.Phone,
		&o.OTPHash,
		&o.Attempts,
		&o.ExpiresAt,
		&o.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrOTPNotFound
		}
		return nil, err
	}
	return &o, nil
}

// IncrementAttempts incrementa o contador de tentativas erradas do OTP.
func (r *WhatsAppAuthRepositorySQLite) IncrementAttempts(ctx context.Context, phone string) error {
	query := `
		UPDATE whatsapp_auth_otps
		SET attempts = attempts + 1
		WHERE phone = ?
	`
	res, err := r.db.ExecContext(ctx, query, phone)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return domain.ErrOTPNotFound
	}
	return nil
}

// DeleteOTP remove o código após uso bem-sucedido ou invalidação.
func (r *WhatsAppAuthRepositorySQLite) DeleteOTP(ctx context.Context, phone string) error {
	query := `DELETE FROM whatsapp_auth_otps WHERE phone = ?`
	_, err := r.db.ExecContext(ctx, query, phone)
	return err
}

// PruneExpired purga códigos expirados do banco de dados.
func (r *WhatsAppAuthRepositorySQLite) PruneExpired(ctx context.Context) error {
	query := `DELETE FROM whatsapp_auth_otps WHERE expires_at < ?`
	_, err := r.db.ExecContext(ctx, query, time.Now().UTC())
	return err
}
