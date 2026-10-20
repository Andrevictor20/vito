package service

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

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

// ValidateGoogleIDToken valida o id_token recebido do Google Play Services via endpoint tokeninfo da Google.
func (s *GoogleAuthService) ValidateGoogleIDToken(ctx context.Context, idToken string) (*GoogleUserInfo, error) {
	cleanToken := strings.TrimSpace(idToken)
	if cleanToken == "" {
		return nil, fmt.Errorf("id_token não pode ser vazio")
	}

	tokenInfoBase := s.cfg.TokenInfoURL
	if tokenInfoBase == "" {
		tokenInfoBase = "https://oauth2.googleapis.com/tokeninfo"
	}

	sep := "?"
	if strings.Contains(tokenInfoBase, "?") {
		sep = "&"
	}
	urlStr := fmt.Sprintf("%s%sid_token=%s", tokenInfoBase, sep, url.QueryEscape(cleanToken))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, urlStr, nil)
	if err != nil {
		return nil, err
	}

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("falha ao validar id_token com o Google: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("Google tokeninfo retornou status %d: %s", resp.StatusCode, strings.TrimSpace(string(bodyBytes)))
	}

	var parsed struct {
		Sub           string         `json:"sub"`
		Email         string         `json:"email"`
		EmailVerified flexibleString `json:"email_verified"`
		Name          string         `json:"name"`
		Picture       string         `json:"picture"`
		Aud           flexibleString `json:"aud"`
		Iss           flexibleString `json:"iss"`
		Exp           flexibleString `json:"exp"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("falha ao decodificar resposta do Google tokeninfo: %w", err)
	}

	if strings.TrimSpace(parsed.Sub) == "" {
		return nil, fmt.Errorf("token do Google sem identificador de usuário (sub)")
	}
	if strings.TrimSpace(parsed.Email) == "" {
		return nil, fmt.Errorf("token do Google não retornou e-mail válido")
	}
	if !strings.EqualFold(strings.TrimSpace(string(parsed.EmailVerified)), "true") {
		return nil, fmt.Errorf("e-mail do Google não está verificado")
	}

	issuer := strings.TrimSpace(string(parsed.Iss))
	if issuer != "https://accounts.google.com" && issuer != "accounts.google.com" {
		return nil, fmt.Errorf("emissor do token Google inválido")
	}

	if strings.TrimSpace(s.cfg.ClientID) == "" {
		return nil, fmt.Errorf("client ID do Google não configurado para validar a audiência do token")
	}
	if strings.TrimSpace(string(parsed.Aud)) != s.cfg.ClientID {
		return nil, fmt.Errorf("audiência do token Google não corresponde ao cliente configurado")
	}

	expRaw := strings.TrimSpace(string(parsed.Exp))
	if expRaw == "" {
		return nil, fmt.Errorf("token do Google sem data de expiração")
	}
	expUnix, err := strconv.ParseInt(expRaw, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("data de expiração do token Google inválida")
	}
	if expUnix <= time.Now().Unix() {
		return nil, fmt.Errorf("token do Google expirado")
	}

	return &GoogleUserInfo{
		Sub:     parsed.Sub,
		Email:   parsed.Email,
		Name:    parsed.Name,
		Picture: parsed.Picture,
	}, nil
}

// flexibleString aceita claims que a Google serializa como string ("true", "175...")
// ou como literais nativos (true, 175...), evitando rejeições indevidas do tokeninfo.
type flexibleString string

func (f *flexibleString) UnmarshalJSON(data []byte) error {
	trimmed := strings.TrimSpace(string(data))
	if trimmed == "" || trimmed == "null" {
		*f = ""
		return nil
	}

	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		*f = flexibleString(s)
		return nil
	}

	var b bool
	if err := json.Unmarshal(data, &b); err == nil {
		*f = flexibleString(strconv.FormatBool(b))
		return nil
	}

	var n json.Number
	if err := json.Unmarshal(data, &n); err == nil {
		*f = flexibleString(n.String())
		return nil
	}

	return fmt.Errorf("claim JSON em formato não suportado: %s", trimmed)
}

func (s *GoogleAuthService) signHMAC(payload string) string {
	mac := hmac.New(sha256.New, []byte(s.cfg.JWTSecret))
	mac.Write([]byte(payload))
	return hex.EncodeToString(mac.Sum(nil))
}

// AuthenticateNativeIDToken valida o id_token recebido do Google Play Services no Android
// e emite uma sessão Dual Token com o dispositivo identificado.
func (s *GoogleAuthService) AuthenticateNativeIDToken(ctx context.Context, idToken, deviceName, ipAddress string) (*TokenPair, *domain.User, error) {
	if s.userRepo == nil || s.authSvc == nil {
		return nil, nil, errors.New("repositório de usuários ou serviço de auth não configurado")
	}

	userInfo, err := s.ValidateGoogleIDToken(ctx, idToken)
	if err != nil {
		return nil, nil, fmt.Errorf("id_token inválido: %w", err)
	}

	user, err := s.userRepo.GetByEmail(userInfo.Email)
	if err != nil {
		if errors.Is(err, domain.ErrUserNotFound) {
			now := time.Now().UTC()
			user = &domain.User{
				ID:           uuid.New().String(),
				Name:         userInfo.Name,
				Email:        userInfo.Email,
				PasswordHash: "oauth:google_native",
				CreatedAt:    now,
				UpdatedAt:    now,
			}
			if err := s.userRepo.Create(user); err != nil {
				return nil, nil, fmt.Errorf("falha ao criar novo usuário via Google Nativo: %w", err)
			}
		} else {
			return nil, nil, fmt.Errorf("erro ao consultar usuário por email: %w", err)
		}
	}

	cleanDevice := strings.TrimSpace(deviceName)
	if cleanDevice == "" {
		cleanDevice = "Vito Mobile (Android)"
	}

	pair, err := s.authSvc.IssueSessionForUser(user, cleanDevice, ipAddress)
	if err != nil {
		return nil, nil, fmt.Errorf("falha ao emitir sessão de login: %w", err)
	}

	return pair, user, nil
}
