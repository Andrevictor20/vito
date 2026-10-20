package service

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/crypto"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// CalendarSyncConnector abstrai a conexão e sincronização com o serviço de calendários.
type CalendarSyncConnector interface {
	ConnectIntegration(ctx context.Context, userID, provider, email, creds, calID, calName string) (*domain.CalendarIntegration, error)
	SyncIntegration(ctx context.Context, userID, provider string) error
}

// GoogleAuthConfig armazena parâmetros para o fluxo OAuth2 com o Google.
type GoogleAuthConfig struct {
	ClientID       string
	ClientSecret   string
	RedirectURL    string
	JWTSecret      string
	AuthURL        string
	TokenURL       string
	UserInfoURL    string
	TokenInfoURL   string
	AllowedOrigins []string
	HTTPClient     *http.Client
}

// OAuthState representa o payload assinado via HMAC transitado no parâmetro state.
type OAuthState struct {
	Mode           string `json:"mode"`            // "login" ou "calendar"
	UserID         string `json:"user_id"`         // ID do usuário logado (obrigatório se mode == "calendar")
	RedirectScheme string `json:"redirect_scheme"` // ex: "vito://oauth/callback"
	DeviceName     string `json:"device_name,omitempty"`
	Timestamp      int64  `json:"timestamp"`
	Nonce          string `json:"nonce"`
}

// GoogleAuthService orquestra o login e concessão de escopos Google.
type GoogleAuthService struct {
	cfg        GoogleAuthConfig
	userRepo   domain.UserRepository
	authSvc    *AuthService
	syncSvc    CalendarSyncConnector
	gmailRepo  domain.GmailRepository
	encKey     string
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

// SetGmailRepository injeta a dependência do repositório de Gmail e a chave de criptografia.
func (s *GoogleAuthService) SetGmailRepository(repo domain.GmailRepository, encKey string) {
	s.gmailRepo = repo
	s.encKey = encKey
}

func (s *GoogleAuthService) isAllowedRedirectScheme(rawScheme string) bool {
	lower := strings.ToLower(strings.TrimSpace(rawScheme))
	if lower == "" {
		return false
	}
	if strings.HasPrefix(lower, "vito://") || strings.HasPrefix(lower, "exp://") {
		return true
	}
	if strings.HasPrefix(lower, "http://localhost:") || strings.HasPrefix(lower, "https://localhost:") ||
		strings.HasPrefix(lower, "http://127.0.0.1:") || strings.HasPrefix(lower, "https://127.0.0.1:") {
		return true
	}
	parsed, err := url.Parse(lower)
	if err != nil || parsed.Host == "" {
		return false
	}
	host := parsed.Hostname()
	if host == "rasppi.cloud" || strings.HasSuffix(host, ".rasppi.cloud") {
		return true
	}
	for _, origin := range s.cfg.AllowedOrigins {
		trimmed := strings.ToLower(strings.TrimSpace(origin))
		if trimmed == "" || trimmed == "*" {
			continue
		}
		if oParsed, err := url.Parse(trimmed); err == nil && oParsed.Host != "" {
			if oParsed.Hostname() == host {
				return true
			}
		} else if trimmed == host {
			return true
		}
	}
	return false
}

// GenerateState gera um token state assinado com HMAC-SHA256 anti-CSRF.
func (s *GoogleAuthService) GenerateState(mode, userID, redirectScheme string) (string, error) {
	return s.GenerateStateWithDevice(mode, userID, redirectScheme, "")
}

// GenerateStateWithDevice gera um token state assinado com HMAC-SHA256 anti-CSRF contendo o nome do dispositivo.
func (s *GoogleAuthService) GenerateStateWithDevice(mode, userID, redirectScheme, deviceName string) (string, error) {
	if !s.isAllowedRedirectScheme(redirectScheme) {
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
		DeviceName:     strings.TrimSpace(deviceName),
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
	return s.GetAuthURLWithDevice(mode, userID, redirectScheme, "")
}

// GetAuthURLWithDevice constrói a URL oficial de consentimento do Google preservando o dispositivo do usuário.
func (s *GoogleAuthService) GetAuthURLWithDevice(mode, userID, redirectScheme, deviceName string) (string, error) {
	if strings.TrimSpace(s.cfg.ClientID) == "" {
		return "", errors.New("GOOGLE_CLIENT_ID não configurado no servidor. Configure as credenciais Google OAuth no arquivo .env")
	}

	state, err := s.GenerateStateWithDevice(mode, userID, redirectScheme, deviceName)
	if err != nil {
		return "", err
	}

	// Solicita perfil, identificação e escopos específicos por modo (Princípio do Menor Privilégio)
	scope := "openid email profile"
	if mode == "calendar" {
		scope = "openid email profile https://www.googleapis.com/auth/calendar.calendarlist.readonly https://www.googleapis.com/auth/calendar.events"
	} else if mode == "gmail" {
		scope = "openid email profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose"
	}

	params := url.Values{}
	params.Set("client_id", s.cfg.ClientID)
	params.Set("redirect_uri", s.cfg.RedirectURL)
	params.Set("response_type", "code")
	params.Set("scope", scope)
	params.Set("access_type", "offline")
	prompt := "select_account"
	if mode == "calendar" || mode == "gmail" {
		prompt = "consent"
	}
	params.Set("prompt", prompt)
	params.Set("state", state)

	return s.cfg.AuthURL + "?" + params.Encode(), nil
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

		// Sincroniza os eventos imediatamente e captura falhas reais da API do Google
		errSync := s.syncSvc.SyncIntegration(context.Background(), state.UserID, domain.ProviderGoogle)
		if errSync != nil {
			return "", fmt.Errorf("Google conectado, mas falhou ao sincronizar: %v", errSync)
		}

		sep := "?"
		if strings.Contains(redirectScheme, "?") {
			sep = "&"
		}
		deepLink := fmt.Sprintf("%s%sstatus=success&provider=google&email=%s",
			redirectScheme,
			sep,
			url.QueryEscape(userInfo.Email),
		)
		return deepLink, nil
	}

	if state.Mode == "gmail" {
		if s.gmailRepo == nil {
			return "", errors.New("repositório do Gmail não configurado")
		}
		if state.UserID == "" {
			return "", errors.New("userID obrigatório para vincular Gmail")
		}

		refreshToken := tokens.RefreshToken
		if refreshToken == "" && s.gmailRepo != nil {
			if existing, _ := s.gmailRepo.GetByUserID(ctx, state.UserID); existing != nil && existing.EncryptedCredentials != "" {
				dec := existing.EncryptedCredentials
				if s.encKey != "" {
					if plain, err := crypto.Decrypt(existing.EncryptedCredentials, s.encKey); err == nil {
						dec = plain
					}
				}
				var oldCreds map[string]interface{}
				if json.Unmarshal([]byte(dec), &oldCreds) == nil {
					if rt, ok := oldCreds["refresh_token"].(string); ok && rt != "" {
						refreshToken = rt
					}
				}
			}
		}

		credsPayload, _ := json.Marshal(map[string]interface{}{
			"access_token":  tokens.AccessToken,
			"refresh_token": refreshToken,
			"expires_in":    tokens.ExpiresIn,
			"updated_at":    time.Now().Unix(),
		})

		encryptedCreds := string(credsPayload)
		if s.encKey != "" {
			if enc, err := crypto.Encrypt(string(credsPayload), s.encKey); err == nil {
				encryptedCreds = enc
			}
		}

		integ := &domain.GmailIntegration{
			UserID:               state.UserID,
			AccountEmail:         userInfo.Email,
			EncryptedCredentials: encryptedCreds,
			Status:               domain.GmailStatusActive,
		}
		if err := s.gmailRepo.Upsert(ctx, integ); err != nil {
			return "", fmt.Errorf("falha ao salvar integração do Gmail: %w", err)
		}

		sep := "?"
		if strings.Contains(redirectScheme, "?") {
			sep = "&"
		}
		deepLink := fmt.Sprintf("%s%sstatus=success&provider=gmail&email=%s",
			redirectScheme,
			sep,
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

	// Emite sessão Dual Token (Access Token 15m + Refresh Token 30d) do Vito preservando o dispositivo de origem
	deviceName := strings.TrimSpace(state.DeviceName)
	if deviceName == "" {
		if strings.HasPrefix(redirectScheme, "vito://") {
			deviceName = "Celular (Vito Mobile)"
		} else {
			deviceName = "Navegador Web (Desktop)"
		}
	}

	var token, refreshToken, sessionID string
	pair, err := s.authSvc.IssueSessionForUser(user, deviceName, "")
	if err == nil && pair != nil {
		token = pair.AccessToken
		refreshToken = pair.RefreshToken
		sessionID = pair.SessionID
	} else {
		// Fallback caso repositório de sessão não esteja configurado
		token, err = s.authSvc.GenerateTokenForUser(user)
		if err != nil {
			return "", fmt.Errorf("falha ao emitir token JWT de sessão: %w", err)
		}
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
		// Dispara a sincronização de forma resiliente: falha de sync no login não cancela a autenticação do usuário
		_ = s.syncSvc.SyncIntegration(context.Background(), user.ID, domain.ProviderGoogle)
	}

	userJSON, _ := json.Marshal(user)

	sep := "?"
	if strings.Contains(redirectScheme, "?") {
		sep = "&"
	}
	deepLink := fmt.Sprintf("%s%sstatus=success&token=%s&access_token=%s&refresh_token=%s&session_id=%s&user=%s",
		redirectScheme,
		sep,
		url.QueryEscape(token),
		url.QueryEscape(token),
		url.QueryEscape(refreshToken),
		url.QueryEscape(sessionID),
		url.QueryEscape(string(userJSON)),
	)
	return deepLink, nil
}
