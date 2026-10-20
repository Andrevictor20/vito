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

// WhatsAppAuthService orquestra o login sem senha por código OTP via WhatsApp e Account Linking.
type WhatsAppAuthService struct {
	otpRepo      domain.WhatsAppAuthRepository
	userRepo     domain.UserRepository
	waRepo       domain.WhatsAppRepository
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

// SetWhatsAppRepo injeta o repositório de sessões do WhatsApp para resolução dinâmica de instâncias ativas.
func (s *WhatsAppAuthService) SetWhatsAppRepo(repo domain.WhatsAppRepository) {
	s.waRepo = repo
}

func (s *WhatsAppAuthService) computeHash(code string) string {
	h := hmac.New(sha256.New, []byte(s.hmacSecret))
	h.Write([]byte(code))
	return hex.EncodeToString(h.Sum(nil))
}

// resolveActiveInstance determina qual instância da Evolution API está conectada ("open") para envio de mensagens.
func (s *WhatsAppAuthService) resolveActiveInstance(ctx context.Context) string {
	target := s.instanceName
	if target != "" && s.evoClient != nil {
		state, err := s.evoClient.GetConnectionState(ctx, target)
		if err == nil && strings.EqualFold(state, "open") {
			return target
		}
	}

	if s.waRepo != nil {
		if connected, err := s.waRepo.FindConnectedInstance(ctx); err == nil && connected != nil && connected.InstanceName != "" {
			return connected.InstanceName
		}
	}

	if target == "" {
		return "vito_system"
	}
	return target
}

// isPlaceholderEmail identifica contas provisórias (@vito.local) criadas pelo login por OTP.
func isPlaceholderEmail(email string) bool {
	return strings.HasSuffix(strings.ToLower(strings.TrimSpace(email)), "@vito.local")
}

// findUserByPhone localiza a conta dona do telefone tolerando diferenças de formato
// (E.164, apenas dígitos e a variação do 9º dígito). Contas reais têm prioridade sobre
// placeholders @vito.local.
func (s *WhatsAppAuthService) findUserByPhone(ctx context.Context, phone string) *domain.User {
	var placeholder *domain.User

	for _, candidate := range domain.PhoneVariants(phone) {
		u, err := s.userRepo.GetByPhone(candidate)
		if err != nil || u == nil {
			continue
		}
		if isPlaceholderEmail(u.Email) {
			if placeholder == nil {
				placeholder = u
			}
			continue
		}
		return u
	}

	return placeholder
}

// resolveUserByPhone localiza a conta dona do telefone e garante a consistência do vínculo:
// quando o número está preso numa conta placeholder (@vito.local), ele é transferido para a
// conta real e o placeholder fica sem telefone.
func (s *WhatsAppAuthService) resolveUserByPhone(ctx context.Context, phone string) (*domain.User, error) {
	var placeholder *domain.User

	for _, candidate := range domain.PhoneVariants(phone) {
		u, err := s.userRepo.GetByPhone(candidate)
		if err != nil || u == nil {
			continue
		}
		if isPlaceholderEmail(u.Email) {
			if placeholder == nil {
				placeholder = u
			}
			continue
		}

		// Conta real encontrada: libera o telefone preso no placeholder (se houver)
		if placeholder != nil && placeholder.ID != u.ID {
			_ = s.userRepo.UpdatePhone(placeholder.ID, "")
		}
		// Garante que a conta real fique com o telefone em E.164
		if u.Phone == nil || *u.Phone != phone {
			if err := s.userRepo.UpdatePhone(u.ID, phone); err == nil {
				if refreshed, rErr := s.userRepo.GetByID(u.ID); rErr == nil {
					u = refreshed
				}
			}
		}
		return u, nil
	}

	// Nenhuma conta real: reaproveita a placeholder (se existir) para o novo número
	return placeholder, nil
}

// LinkPhone associa o número de WhatsApp informado à conta de um usuário existente.
// Se o número estiver atribuído a uma conta placeholder temporária criada pelo WhatsApp (@vito.local),
// desvincula a conta placeholder com segurança e atribui o telefone à conta principal.
func (s *WhatsAppAuthService) LinkPhone(ctx context.Context, targetUserID, rawPhone string) error {
	phone := NormalizeE164Phone(rawPhone)
	if phone == "" {
		return domain.ErrInvalidPhoneFormat
	}

	targetUser, err := s.userRepo.GetByID(targetUserID)
	if err != nil {
		return domain.ErrUserNotFound
	}

	// Verifica se este telefone já pertence a algum usuário cadastrado (tolerante a formatos)
	existingUser := s.findUserByPhone(ctx, phone)
	if existingUser != nil {
		if existingUser.ID == targetUser.ID {
			// Já está vinculado à mesma conta: apenas canonicaliza o formato gravado
			if existingUser.Phone == nil || *existingUser.Phone != phone {
				_ = s.userRepo.UpdatePhone(targetUser.ID, phone)
			}
			return nil
		}

		// Se pertencer a uma conta placeholder órfã (@vito.local), desvincula o telefone dela
		if isPlaceholderEmail(existingUser.Email) {
			_ = s.userRepo.UpdatePhone(existingUser.ID, "")
		} else {
			// Pertence a outro usuário real com e-mail legítimo: recusa por segurança
			return domain.ErrUserAlreadyExists
		}
	}

	// Atualiza o telefone na conta do usuário alvo
	if err := s.userRepo.UpdatePhone(targetUser.ID, phone); err != nil {
		return fmt.Errorf("falha ao vincular telefone ao usuário: %w", err)
	}

	return nil
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

	activeInstance := s.resolveActiveInstance(ctx)
	msg := fmt.Sprintf("Seu código de acesso ao Vito é: %s\n\nVálido por 5 minutos. Não compartilhe este código com ninguém.", code)

	if err := s.evoClient.SendText(ctx, activeInstance, phone, msg); err != nil {
		// Se falhou na instância resolvida e for diferente da default, tenta a default como fallback
		if activeInstance != s.instanceName && s.instanceName != "" {
			if fallbackErr := s.evoClient.SendText(ctx, s.instanceName, phone, msg); fallbackErr == nil {
				return nil
			}
		}
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

	// 1. Busca usuário existente por telefone (tolerante a formatos, priorizando conta real)
	user, err := s.resolveUserByPhone(ctx, phone)
	if err != nil {
		return nil, nil, err
	}

	// 2. Se não houver vínculo pelo telefone, busca se há integração do WhatsApp pareada com este telefone
	if user == nil && s.waRepo != nil {
		for _, candidate := range domain.PhoneVariants(phone) {
			it, itErr := s.waRepo.GetByPhone(ctx, candidate)
			if itErr != nil || it == nil || it.UserID == "" {
				continue
			}
			linkedUser, uErr := s.userRepo.GetByID(it.UserID)
			if uErr != nil || linkedUser == nil {
				continue
			}
			user = linkedUser
			_ = s.userRepo.UpdatePhone(user.ID, phone)
			break
		}
	}

	// 3. Se ainda não houver usuário vinculado, cria nova conta com placeholder
	if user == nil {
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

	if deviceName == "" {
		deviceName = "Dispositivo Desconhecido"
	}

	// Emite a sessão Dual Token (Access Token 15m + Refresh Token 30d)
	tokens, err := s.authSvc.IssueSessionForUser(user, deviceName, ipAddress)
	if err != nil {
		return nil, nil, fmt.Errorf("falha ao emitir sessão de login: %w", err)
	}

	return tokens, user, nil
}
