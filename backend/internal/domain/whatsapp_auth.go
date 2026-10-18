package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrOTPNotFound        = errors.New("código OTP não encontrado ou expirado")
	ErrOTPExpired         = errors.New("código OTP expirado")
	ErrOTPInvalid         = errors.New("código OTP incorreto")
	ErrOTPMaxAttempts     = errors.New("limite de tentativas excedido para este código")
	ErrOTPRateLimited     = errors.New("aguarde alguns segundos antes de solicitar um novo código")
	ErrInvalidPhoneFormat = errors.New("formato de telefone inválido")
)

// WhatsAppAuthOTP representa o registro de código de uso único para login.
type WhatsAppAuthOTP struct {
	Phone     string    `json:"phone"` // E.164
	OTPHash   string    `json:"-"`
	Attempts  int       `json:"attempts"`
	ExpiresAt time.Time `json:"expires_at"`
	CreatedAt time.Time `json:"created_at"`
}

// WhatsAppAuthRepository abstrai a persistência do OTP para login no SQLite.
type WhatsAppAuthRepository interface {
	SaveOTP(ctx context.Context, phone, otpHash string, expiresAt time.Time) error
	GetOTP(ctx context.Context, phone string) (*WhatsAppAuthOTP, error)
	IncrementAttempts(ctx context.Context, phone string) error
	DeleteOTP(ctx context.Context, phone string) error
	PruneExpired(ctx context.Context) error
}
