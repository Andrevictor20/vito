package service_test

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type MockWhatsAppAuthRepo struct {
	otps map[string]*domain.WhatsAppAuthOTP
}

func newMockWhatsAppAuthRepo() *MockWhatsAppAuthRepo {
	return &MockWhatsAppAuthRepo{otps: make(map[string]*domain.WhatsAppAuthOTP)}
}

func (m *MockWhatsAppAuthRepo) SaveOTP(ctx context.Context, phone, otpHash string, expiresAt time.Time) error {
	m.otps[phone] = &domain.WhatsAppAuthOTP{
		Phone:     phone,
		OTPHash:   otpHash,
		Attempts:  0,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now().UTC(),
	}
	return nil
}

func (m *MockWhatsAppAuthRepo) GetOTP(ctx context.Context, phone string) (*domain.WhatsAppAuthOTP, error) {
	otp, ok := m.otps[phone]
	if !ok {
		return nil, domain.ErrOTPNotFound
	}
	return otp, nil
}

func (m *MockWhatsAppAuthRepo) IncrementAttempts(ctx context.Context, phone string) error {
	otp, ok := m.otps[phone]
	if !ok {
		return domain.ErrOTPNotFound
	}
	otp.Attempts++
	return nil
}

func (m *MockWhatsAppAuthRepo) DeleteOTP(ctx context.Context, phone string) error {
	delete(m.otps, phone)
	return nil
}

func (m *MockWhatsAppAuthRepo) PruneExpired(ctx context.Context) error {
	now := time.Now().UTC()
	for k, v := range m.otps {
		if v.ExpiresAt.Before(now) {
			delete(m.otps, k)
		}
	}
	return nil
}

type MockEvolutionClientForAuth struct {
	sentTo   string
	sentText string
}

func (m *MockEvolutionClientForAuth) CreateInstance(ctx context.Context, instanceName, phone string) error {
	return nil
}
func (m *MockEvolutionClientForAuth) SetWebhook(ctx context.Context, instanceName, webhookURL string) error {
	return nil
}
func (m *MockEvolutionClientForAuth) GetPairingCode(ctx context.Context, instanceName, phone string) (string, error) {
	return "1234-5678", nil
}
func (m *MockEvolutionClientForAuth) GetConnectionState(ctx context.Context, instanceName string) (string, error) {
	return "open", nil
}
func (m *MockEvolutionClientForAuth) DeleteInstance(ctx context.Context, instanceName string) error {
	return nil
}
func (m *MockEvolutionClientForAuth) Logout(ctx context.Context, instanceName string) error {
	return nil
}
func (m *MockEvolutionClientForAuth) SendText(ctx context.Context, instanceName, to, text string) error {
	m.sentTo = to
	m.sentText = text
	return nil
}

func TestWhatsAppAuthService_RequestAndVerifyOTP(t *testing.T) {
	ctx := context.Background()
	otpRepo := newMockWhatsAppAuthRepo()
	userRepo := NewMockUserRepositoryInMemory()
	authSvc := service.NewAuthService(userRepo, "test-jwt-secret-session")
	evoClient := &MockEvolutionClientForAuth{}

	svc := service.NewWhatsAppAuthService(
		otpRepo,
		userRepo,
		authSvc,
		evoClient,
		"vito_system",
		"test-hmac-secret",
	)

	phone := "11987654321"

	// 1. RequestOTP com número inválido
	err := svc.RequestOTP(ctx, "abc")
	if err != domain.ErrInvalidPhoneFormat {
		t.Fatalf("esperava ErrInvalidPhoneFormat, obteve %v", err)
	}

	// 2. RequestOTP válido
	err = svc.RequestOTP(ctx, phone)
	if err != nil {
		t.Fatalf("falha ao solicitar OTP: %v", err)
	}

	normalized := "+5511987654321"
	if evoClient.sentTo != normalized {
		t.Errorf("destinatário esperado '%s', obteve '%s'", normalized, evoClient.sentTo)
	}
	if evoClient.sentText == "" {
		t.Error("mensagem enviada via WhatsApp vazia")
	}

	// 3. Rate limiting (< 30s)
	err = svc.RequestOTP(ctx, phone)
	if err != domain.ErrOTPRateLimited {
		t.Fatalf("esperava ErrOTPRateLimited, obteve %v", err)
	}

	// 4. VerifyOTP com código incorreto
	_, _, err = svc.VerifyOTP(ctx, phone, "000000", "Pixel 8", "127.0.0.1")
	if err != domain.ErrOTPInvalid {
		t.Fatalf("esperava ErrOTPInvalid, obteve %v", err)
	}

	savedOTP, _ := otpRepo.GetOTP(ctx, normalized)
	if savedOTP.Attempts != 1 {
		t.Errorf("tentativas esperadas 1, obteve %d", savedOTP.Attempts)
	}

	// 5. VerifyOTP com código correto (extraído da mensagem mock via regex)
	re := regexp.MustCompile(`\b\d{6}\b`)
	code := re.FindString(evoClient.sentText)
	if code == "" {
		t.Fatalf("código de 6 dígitos não encontrado na mensagem: %s", evoClient.sentText)
	}
	tokens, user, err := svc.VerifyOTP(ctx, phone, code, "Pixel 8", "127.0.0.1")
	if err != nil {
		t.Fatalf("falha ao verificar OTP correto: %v", err)
	}

	if tokens.AccessToken == "" || tokens.RefreshToken == "" {
		t.Error("tokens vazios retornados")
	}
	if user.Phone == nil || *user.Phone != normalized {
		t.Errorf("telefone do usuário divergente: %v", user.Phone)
	}

	// 6. OTP deve ter sido apagado após login
	_, err = otpRepo.GetOTP(ctx, normalized)
	if err != domain.ErrOTPNotFound {
		t.Fatalf("esperava ErrOTPNotFound após login, obteve %v", err)
	}
}
