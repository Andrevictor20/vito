package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// CalendarSyncConnector abstrai a conexão e sincronização com o serviço de calendários.
type CalendarSyncConnector interface {
	ConnectIntegration(ctx context.Context, userID, provider, email, creds, calID, calName string) (*domain.CalendarIntegration, error)
	SyncIntegration(ctx context.Context, userID, provider string) error
}

// GoogleAuthConfig armazena parâmetros para o fluxo OAuth2 com o Google.
type GoogleAuthConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
	JWTSecret    string
	AuthURL      string
	TokenURL     string
	UserInfoURL  string
	HTTPClient   *http.Client
}

// OAuthState representa o payload assinado via HMAC transitado no parâmetro state.
type OAuthState struct {
	Mode           string `json:"mode"`            // "login" ou "calendar"
	UserID         string `json:"user_id"`         // ID do usuário logado (obrigatório se mode == "calendar")
	RedirectScheme string `json:"redirect_scheme"` // ex: "vito://oauth/callback"
	Timestamp      int64  `json:"timestamp"`
	Nonce          string `json:"nonce"`
}

// GoogleAuthService orquestra o login e concessão de escopos Google.
type GoogleAuthService struct {
	cfg        GoogleAuthConfig
	userRepo   domain.UserRepository
	authSvc    *AuthService
	syncSvc    CalendarSyncConnector
	httpClient *http.Client
}

// NewGoogleAuthService instancia o serviço com defaults seguros.
func NewGoogleAuthService(
	cfg GoogleAuthConfig,
	userRepo domain.UserRepository,
	authSvc *AuthService,
	syncSvc CalendarSyncConnector,
) *GoogleAuthService {
	if cfg.AuthURL == "" {
		cfg.AuthURL = "https://accounts.google.com/o/oauth2/v2/auth"
	}
	if cfg.TokenURL == "" {
		cfg.TokenURL = "https://oauth2.googleapis.com/token"
	}
	if cfg.UserInfoURL == "" {
		cfg.UserInfoURL = "https://www.googleapis.com/oauth2/v3/userinfo"
	}
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 15 * time.Second}
	}

	return &GoogleAuthService{
		cfg:        cfg,
		userRepo:   userRepo,
		authSvc:    authSvc,
		syncSvc:    syncSvc,
		httpClient: client,
	}
}

// GenerateState gera um token state assinado com HMAC-SHA256 anti-CSRF.
func (s *GoogleAuthService) GenerateState(mode, userID, redirectScheme string) (string, error) {
	if redirectScheme == "" {
		redirectScheme = "vito://oauth/callback"
	}

	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", fmt.Errorf("falha ao gerar nonce seguro: %w", err)
	}

	state := OAuthState{
		Mode:           mode,
		UserID:         userID,
		RedirectScheme: redirectScheme,
		Timestamp:      time.Now().Unix(),
		Nonce:          hex.EncodeToString(nonceBytes),
	}

	payloadBytes, err := json.Marshal(state)
	if err != nil {
		return "", err
	}

	payloadB64 := base64.RawURLEncoding.EncodeToString(payloadBytes)
	sig := s.signHMAC(payloadB64)

	return payloadB64 + "." + sig, nil
}

// ValidateState valida a assinatura e expiração do state OAuth2.
func (s *GoogleAuthService) ValidateState(stateStr string) (*OAuthState, error) {
	parts := strings.Split(stateStr, ".")
	if len(parts) != 2 {
		return nil, errors.New("formato de state inválido")
	}

	payloadB64, sig := parts[0], parts[1]
	expectedSig := s.signHMAC(payloadB64)

	if !hmac.Equal([]byte(sig), []byte(expectedSig)) {
		return nil, errors.New("assinatura do state adulterada ou inválida")
	}

	payloadBytes, err := base64.RawURLEncoding.DecodeString(payloadB64)
	if err != nil {
		return nil, errors.New("falha ao decodificar payload do state")
	}

	var state OAuthState
	if err := json.Unmarshal(payloadBytes, &state); err != nil {
		return nil, errors.New("falha ao parsear JSON do state")
	}

	// Valida expiração de 10 minutos
	if time.Now().Unix()-state.Timestamp > 600 {
		return nil, errors.New("state expirado")
	}

	return &state, nil
}

// GetAuthURL constrói a URL oficial de consentimento do Google.
func (s *GoogleAuthService) GetAuthURL(mode, userID, redirectScheme string) (string, error) {
	if strings.TrimSpace(s.cfg.ClientID) == "" {
		return "", errors.New("GOOGLE_CLIENT_ID não configurado no servidor. Configure as credenciais Google OAuth no arquivo .env")
	}

	state, err := s.GenerateState(mode, userID, redirectScheme)
	if err != nil {
		return "", err
	}

	scope := "openid email profile"
	if mode == "calendar" {
		scope = "openid email profile https://www.googleapis.com/auth/calendar.events"
	}

	params := url.Values{}
	params.Set("client_id", s.cfg.ClientID)
	params.Set("redirect_uri", s.cfg.RedirectURL)
	params.Set("response_type", "code")
	params.Set("scope", scope)
	params.Set("access_type", "offline")
	params.Set("prompt", "consent")
	params.Set("state", state)

	return s.cfg.AuthURL + "?" + params.Encode(), nil
}

// GoogleTokenResponse modela a resposta do endpoint de token do Google.
type GoogleTokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	IDToken      string `json:"id_token"`
}

// GoogleUserInfo modela o perfil do usuário retornado pelo Google.
type GoogleUserInfo struct {
	Sub     string `json:"sub"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

// HandleCallback processa o código de autorização, troca por tokens e conclui o fluxo.
func (s *GoogleAuthService) HandleCallback(ctx context.Context, code, stateStr string) (string, error) {
	state, err := s.ValidateState(stateStr)
	if err != nil {
		return "", fmt.Errorf("state inválido: %w", err)
	}

	// 1. Troca o code por tokens OAuth2
	tokens, err := s.exchangeCode(ctx, code)
	if err != nil {
		return "", fmt.Errorf("falha ao obter tokens com o Google: %w", err)
	}

	// 2. Consulta informações de perfil do usuário
	userInfo, err := s.fetchUserInfo(ctx, tokens.AccessToken)
	if err != nil {
		return "", fmt.Errorf("falha ao obter dados cadastrais do Google: %w", err)
	}

	redirectScheme := state.RedirectScheme
	if redirectScheme == "" {
		redirectScheme = "vito://oauth/callback"
	}

	// 3. Processamento conforme o modo
	if state.Mode == "calendar" {
		if s.syncSvc == nil {
			return "", errors.New("serviço de sincronização de calendário não configurado")
		}
		if state.UserID == "" {
			return "", errors.New("userID obrigatório para vincular calendário")
		}

		credsPayload, _ := json.Marshal(map[string]interface{}{
			"access_token":  tokens.AccessToken,
			"refresh_token": tokens.RefreshToken,
			"expires_in":    tokens.ExpiresIn,
		})

		_, err = s.syncSvc.ConnectIntegration(
			ctx,
			state.UserID,
			domain.ProviderGoogle,
			userInfo.Email,
			string(credsPayload),
			"primary",
			"Google Calendar",
		)
		if err != nil {
			return "", fmt.Errorf("falha ao salvar integração do Google Calendar: %w", err)
		}

		// Dispara sincronização inicial em background
		go func() {
			_ = s.syncSvc.SyncIntegration(context.Background(), state.UserID, domain.ProviderGoogle)
		}()

		deepLink := fmt.Sprintf("%s?status=success&provider=google&email=%s",
			redirectScheme,
			url.QueryEscape(userInfo.Email),
		)
		return deepLink, nil
	}

	// Modo Login / Cadastro Automático
	if s.userRepo == nil || s.authSvc == nil {
		return "", errors.New("repositório de usuários ou serviço de auth não configurado")
	}

	user, err := s.userRepo.GetByEmail(userInfo.Email)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			now := time.Now().UTC()
			user = &domain.User{
				ID:           uuid.New().String(),
				Name:         userInfo.Name,
				Email:        userInfo.Email,
				PasswordHash: "oauth:google",
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			if err := s.userRepo.Create(user); err != nil {
				return "", fmt.Errorf("falha ao criar novo usuário via Google: %w", err)
			}
		} else {
			return "", fmt.Errorf("erro ao consultar usuário por email: %w", err)
		}
	}

	// Gera token JWT de sessão do Vito
	token, err := s.authSvc.GenerateTokenForUser(user)
	if err != nil {
		return "", fmt.Errorf("falha ao emitir token JWT de sessão: %w", err)
	}

	// Auto-vincula e sincroniza o calendário se o serviço de sincronização estiver disponível
	if s.syncSvc != nil && tokens.AccessToken != "" {
		credsPayload, _ := json.Marshal(map[string]interface{}{
			"access_token":  tokens.AccessToken,
			"refresh_token": tokens.RefreshToken,
			"expires_in":    tokens.ExpiresIn,
		})
		_, _ = s.syncSvc.ConnectIntegration(
			ctx,
			user.ID,
			domain.ProviderGoogle,
			userInfo.Email,
			string(credsPayload),
			"primary",
			"Google Calendar",
		)
		go func() {
			_ = s.syncSvc.SyncIntegration(context.Background(), user.ID, domain.ProviderGoogle)
		}()
	}

	userJSON, _ := json.Marshal(user)

	deepLink := fmt.Sprintf("%s?status=success&token=%s&user=%s",
		redirectScheme,
		url.QueryEscape(token),
		url.QueryEscape(string(userJSON)),
	)
	return deepLink, nil
}

func (s *GoogleAuthService) exchangeCode(ctx context.Context, code string) (*GoogleTokenResponse, error) {
	data := url.Values{}
	data.Set("code", code)
	data.Set("client_id", s.cfg.ClientID)
	data.Set("client_secret", s.cfg.ClientSecret)
	data.Set("redirect_uri", s.cfg.RedirectURL)
	data.Set("grant_type", "authorization_code")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.TokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google token endpoint retornou status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	var tokenResp GoogleTokenResponse
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	return &tokenResp, nil
}

func (s *GoogleAuthService) fetchUserInfo(ctx context.Context, accessToken string) (*GoogleUserInfo, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.cfg.UserInfoURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google userinfo retornou status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	var userInfo GoogleUserInfo
	if err := json.NewDecoder(resp.Body).Decode(&userInfo); err != nil {
		return nil, err
	}

	return &userInfo, nil
}

func (s *GoogleAuthService) signHMAC(payload string) string {
	mac := hmac.New(sha256.New, []byte(s.cfg.JWTSecret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}
