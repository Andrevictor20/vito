package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// WhatsAppAuthService orquestra o login sem senha por código OTP via WhatsApp.
type WhatsAppAuthService struct {
	otpRepo      domain.WhatsAppAuthRepository
	userRepo     domain.UserRepository
	authSvc      *AuthService
	evoClient    EvolutionAPIClient
	instanceName string
	hmacSecret   string
}

// NewWhatsAppAuthService cria uma nova instância do serviço de autenticação por WhatsApp.
func NewWhatsAppAuthService(
	otpRepo domain.WhatsAppAuthRepository,
	userRepo domain.UserRepository,
	authSvc *AuthService,
	evoClient EvolutionAPIClient,
	instanceName string,
	hmacSecret string,
) *WhatsAppAuthService {
	if instanceName == "" {
		instanceName = "vito_system"
	}
	if hmacSecret == "" {
		hmacSecret = "vito-whatsapp-auth-secret-key"
	}
	return &WhatsAppAuthService{
		otpRepo:      otpRepo,
		userRepo:     userRepo,
		authSvc:      authSvc,
		evoClient:    evoClient,
		instanceName: instanceName,
		hmacSecret:   hmacSecret,
	}
}

func (s *WhatsAppAuthService) computeHash(code string) string {
	h := hmac.New(sha256.New, []byte(s.hmacSecret))
	h.Write([]byte(code))
	return hex.EncodeToString(h.Sum(nil))
}

// RequestOTP gera e envia um código de 6 dígitos para o WhatsApp do usuário.
func (s *WhatsAppAuthService) RequestOTP(ctx context.Context, rawPhone string) error {
	phone := NormalizeE164Phone(rawPhone)
	if phone == "" {
		return domain.ErrInvalidPhoneFormat
	}

	// Rate limiting: se já solicitou código há menos de 30 segundos, recusa
	existing, err := s.otpRepo.GetOTP(ctx, phone)
	if err == nil && existing != nil {
		if time.Since(existing.CreatedAt) < 30*time.Second {
			return domain.ErrOTPRateLimited
		}
	}

	// Gera código criptográfico de 6 dígitos no intervalo 100000..999999
	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return fmt.Errorf("falha ao gerar código OTP: %w", err)
	}
	code := fmt.Sprintf("%06d", n.Int64()+100000)

	otpHash := s.computeHash(code)
	expiresAt := time.Now().UTC().Add(5 * time.Minute)

	if err := s.otpRepo.SaveOTP(ctx, phone, otpHash, expiresAt); err != nil {
		return fmt.Errorf("falha ao persistir código OTP: %w", err)
	}

	msg := fmt.Sprintf("Seu código de acesso ao Vito é: %s\n\nVálido por 5 minutos. Não compartilhe este código com ninguém.", code)
	if err := s.evoClient.SendText(ctx, s.instanceName, phone, msg); err != nil {
		return fmt.Errorf("falha ao despachar mensagem pelo WhatsApp: %w", err)
	}

	return nil
}

// VerifyOTP confere o código, autentica ou cadastra o usuário e retorna o par de tokens.
func (s *WhatsAppAuthService) VerifyOTP(ctx context.Context, rawPhone, code, deviceName, ipAddress string) (*TokenPair, *domain.User, error) {
	phone := NormalizeE164Phone(rawPhone)
	if phone == "" {
		return nil, nil, domain.ErrInvalidPhoneFormat
	}

	cleanCode := strings.TrimSpace(code)
	if len(cleanCode) != 6 {
		return nil, nil, domain.ErrOTPInvalid
	}

	otp, err := s.otpRepo.GetOTP(ctx, phone)
	if err != nil {
		return nil, nil, err
	}

	if time.Now().UTC().After(otp.ExpiresAt) {
		_ = s.otpRepo.DeleteOTP(ctx, phone)
		return nil, nil, domain.ErrOTPExpired
	}

	if otp.Attempts >= 3 {
		_ = s.otpRepo.DeleteOTP(ctx, phone)
		return nil, nil, domain.ErrOTPMaxAttempts
	}

	expectedHash := s.computeHash(cleanCode)
	if !hmac.Equal([]byte(otp.OTPHash), []byte(expectedHash)) {
		_ = s.otpRepo.IncrementAttempts(ctx, phone)
		return nil, nil, domain.ErrOTPInvalid
	}

	// Código correto: consome o OTP imediatamente (One-Time)
	_ = s.otpRepo.DeleteOTP(ctx, phone)

	// Busca usuário por telefone ou cria nova conta vinculada
	user, err := s.userRepo.GetByPhone(phone)
	if err != nil {
		newID := uuid.NewString()
		placeholderEmail := fmt.Sprintf("%s@vito.local", strings.TrimPrefix(phone, "+"))
		user = &domain.User{
			ID:           newID,
			Name:         "Usuário Vito",
			Email:        placeholderEmail,
			Phone:        &phone,
			PasswordHash: "", // Sem senha (login exclusivo via WhatsApp/OAuth)
			CreatedAt:    time.Now().UTC(),
			UpdatedAt:    time.Now().UTC(),
		}
		if err := s.userRepo.Create(user); err != nil {
			return nil, nil, fmt.Errorf("falha ao criar usuário via WhatsApp: %w", err)
		}
	}

	// Emite a sessão Dual Token (Access Token 15m + Refresh Token 30d)
	tokens, err := s.authSvc.IssueSessionForUser(user, deviceName, ipAddress)
	if err != nil {
		return nil, nil, fmt.Errorf("falha ao emitir sessão de login: %w", err)
	}

	return tokens, user, nil
}
