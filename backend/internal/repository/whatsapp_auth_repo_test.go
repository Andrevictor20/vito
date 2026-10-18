package repository_test

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

func setupWhatsAppAuthTestDB(t *testing.T) *repository.WhatsAppAuthRepositorySQLite {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "test_wa_auth.db")

	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir sqlite de teste: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	return repository.NewWhatsAppAuthRepository(db)
}

func TestWhatsAppAuthRepository_SaveAndVerify(t *testing.T) {
	ctx := context.Background()
	repo := setupWhatsAppAuthTestDB(t)

	phone := "+5511999998888"
	otpHash := "hash123"
	expiresAt := time.Now().UTC().Add(5 * time.Minute).Truncate(time.Second)

	// 1. Get inexistente retorna ErrOTPNotFound
	_, err := repo.GetOTP(ctx, phone)
	if err != domain.ErrOTPNotFound {
		t.Fatalf("esperava ErrOTPNotFound, obteve %v", err)
	}

	// 2. Salva OTP
	if err := repo.SaveOTP(ctx, phone, otpHash, expiresAt); err != nil {
		t.Fatalf("falha ao salvar OTP: %v", err)
	}

	got, err := repo.GetOTP(ctx, phone)
	if err != nil {
		t.Fatalf("falha ao obter OTP: %v", err)
	}
	if got.Phone != phone || got.OTPHash != otpHash || got.Attempts != 0 {
		t.Fatalf("dados do OTP divergentes: %+v", got)
	}

	// 3. IncrementAttempts
	if err := repo.IncrementAttempts(ctx, phone); err != nil {
		t.Fatalf("falha ao incrementar tentativas: %v", err)
	}
	got, _ = repo.GetOTP(ctx, phone)
	if got.Attempts != 1 {
		t.Fatalf("esperava 1 tentativa, obteve %d", got.Attempts)
	}

	// 4. DeleteOTP
	if err := repo.DeleteOTP(ctx, phone); err != nil {
		t.Fatalf("falha ao deletar OTP: %v", err)
	}
	_, err = repo.GetOTP(ctx, phone)
	if err != domain.ErrOTPNotFound {
		t.Fatalf("esperava ErrOTPNotFound após delete, obteve %v", err)
	}

	// 5. PruneExpired
	expiredPhone := "+5511977776666"
	past := time.Now().UTC().Add(-10 * time.Minute)
	_ = repo.SaveOTP(ctx, expiredPhone, "oldhash", past)

	validPhone := "+5511988885555"
	future := time.Now().UTC().Add(10 * time.Minute)
	_ = repo.SaveOTP(ctx, validPhone, "newhash", future)

	if err := repo.PruneExpired(ctx); err != nil {
		t.Fatalf("falha no PruneExpired: %v", err)
	}

	if _, err := repo.GetOTP(ctx, expiredPhone); err != domain.ErrOTPNotFound {
		t.Fatalf("expirado ainda existe: %v", err)
	}
	if _, err := repo.GetOTP(ctx, validPhone); err != nil {
		t.Fatalf("válido foi apagado indevidamente: %v", err)
	}
}
