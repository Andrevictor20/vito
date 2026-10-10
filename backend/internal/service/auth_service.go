package service

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// UserClaims representa as informações contidas no payload do JWT.
type UserClaims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	Name   string `json:"name"`
	jwt.RegisteredClaims
}

// AuthService gerencia regras de negócio de autenticação e tokens.
type AuthService struct {
	userRepo  domain.UserRepository
	jwtSecret []byte
}

// NewAuthService instancia o serviço de autenticação.
func NewAuthService(userRepo domain.UserRepository, jwtSecret string) *AuthService {
	return &AuthService{
		userRepo:  userRepo,
		jwtSecret: []byte(jwtSecret),
	}
}

// Register cria um novo usuário com senha criptografada e retorna seu token de acesso.
func (s *AuthService) Register(name, email, password string) (*domain.User, string, error) {
	name = strings.TrimSpace(name)
	email = strings.ToLower(strings.TrimSpace(email))

	if email == "" {
		return nil, "", domain.ErrInvalidEmail
	}
	if len(password) < 6 {
		return nil, "", errors.New("a senha deve ter no mínimo 6 caracteres")
	}

	existing, _ := s.userRepo.GetByEmail(email)
	if existing != nil {
		return nil, "", domain.ErrUserAlreadyExists
	}

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, "", fmt.Errorf("falha ao criptografar senha: %w", err)
	}

	now := time.Now().UTC()
	user := &domain.User{
		ID:           uuid.New().String(),
		Name:         name,
		Email:        email,
		PasswordHash: string(hashed),
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, "", err
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

// Login valida as credenciais e retorna o usuário e seu token JWT.
func (s *AuthService) Login(email, password string) (*domain.User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))

	user, err := s.userRepo.GetByEmail(email)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			return nil, "", domain.ErrInvalidPassword // não vaza existência de email
		}
		return nil, "", err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return nil, "", domain.ErrInvalidPassword
	}

	token, err := s.generateToken(user)
	if err != nil {
		return nil, "", err
	}

	return user, token, nil
}

// ValidateToken decodifica e valida a assinatura e expiração de um JWT.
func (s *AuthService) ValidateToken(tokenString string) (*UserClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &UserClaims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("método de assinatura inesperado: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*UserClaims)
	if !ok || !token.Valid {
		return nil, errors.New("token inválido")
	}

	return claims, nil
}

// GenerateTokenForUser expõe a geração de token JWT para provedores de autenticação (como Google OAuth).
func (s *AuthService) GenerateTokenForUser(user *domain.User) (string, error) {
	return s.generateToken(user)
}

func (s *AuthService) generateToken(user *domain.User) (string, error) {
	claims := UserClaims{
		UserID: user.ID,
		Email:  user.Email,
		Name:   user.Name,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)), // 30 dias para uso pessoal
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Subject:   user.ID,
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(s.jwtSecret)
}

// GetUserByID recupera o usuário ativo pelo ID para garantir integridade referencial.
func (s *AuthService) GetUserByID(id string) (*domain.User, error) {
	return s.userRepo.GetByID(id)
}
