package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/crypto"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// GmailStatusResponse representa o status da conexão do Gmail.
type GmailStatusResponse struct {
	Connected     bool       `json:"connected"`
	Email         string     `json:"email,omitempty"`
	AccountEmail  string     `json:"account_email,omitempty"`
	Status        string     `json:"status,omitempty"`
	LastScannedAt *time.Time `json:"last_scanned_at,omitempty"`
}

// GmailService orquestra a comunicação segura e triagem com a Gmail API.
type GmailService struct {
	repo         domain.GmailRepository
	encKey       string
	clientID     string
	clientSecret string
	baseURL      string
	tokenURL     string
	httpClient   *http.Client
}

// NewGmailService instancia o serviço com defaults seguros.
func NewGmailService(repo domain.GmailRepository, encKey, clientID, clientSecret string) *GmailService {
	return &GmailService{
		repo:         repo,
		encKey:       encKey,
		clientID:     clientID,
		clientSecret: clientSecret,
		baseURL:      "https://gmail.googleapis.com",
		tokenURL:     "https://oauth2.googleapis.com/token",
		httpClient:   &http.Client{Timeout: 15 * time.Second},
	}
}

// SetBaseURL permite apontar para servidores de teste mock.
func (s *GmailService) SetBaseURL(url string) {
	s.baseURL = strings.TrimRight(url, "/")
}

// SetTokenURL permite apontar o endpoint de renovação de token para servidores de teste.
func (s *GmailService) SetTokenURL(url string) {
	s.tokenURL = url
}

// GetStatus verifica se o usuário possui integração conectada e ativa.
func (s *GmailService) GetStatus(ctx context.Context, userID string) (*GmailStatusResponse, error) {
	integ, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		if errors.Is(err, domain.ErrGmailNotConnected) {
			return &GmailStatusResponse{Connected: false}, nil
		}
		return nil, err
	}

	return &GmailStatusResponse{
		Connected:     integ.Status == domain.GmailStatusActive,
		Email:         integ.AccountEmail,
		AccountEmail:  integ.AccountEmail,
		Status:        integ.Status,
		LastScannedAt: integ.LastScannedAt,
	}, nil
}

// Disconnect remove a integração do usuário.
func (s *GmailService) Disconnect(ctx context.Context, userID string) error {
	return s.repo.DeleteByUserID(ctx, userID)
}

type gmailStoredTokens struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	UpdatedAt    int64  `json:"updated_at,omitempty"`
}

func (s *GmailService) refreshToken(ctx context.Context, userID string, integ *domain.GmailIntegration, tokens *gmailStoredTokens) (string, error) {
	if tokens.RefreshToken == "" {
		return "", domain.ErrGmailAuthFailed
	}

	data := url.Values{}
	data.Set("client_id", s.clientID)
	data.Set("client_secret", s.clientSecret)
	data.Set("refresh_token", tokens.RefreshToken)
	data.Set("grant_type", "refresh_token")

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("falha ao comunicar com endpoint de token do Google: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		_ = s.repo.UpdateStatus(ctx, userID, domain.GmailStatusReauthRequired)
		return "", fmt.Errorf("falha ao renovar token do Gmail (status %d): %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	if tokenResp.AccessToken == "" {
		return "", errors.New("Google não retornou novo access token")
	}

	tokens.AccessToken = tokenResp.AccessToken
	if tokenResp.RefreshToken != "" {
		tokens.RefreshToken = tokenResp.RefreshToken
	}
	if tokenResp.ExpiresIn > 0 {
		tokens.ExpiresIn = tokenResp.ExpiresIn
	} else {
		tokens.ExpiresIn = 3600
	}
	tokens.UpdatedAt = time.Now().Unix()

	newPayload, err := json.Marshal(tokens)
	if err != nil {
		return "", err
	}

	encryptedPayload := string(newPayload)
	if s.encKey != "" {
		if enc, err := crypto.Encrypt(string(newPayload), s.encKey); err == nil {
			encryptedPayload = enc
		}
	}

	integ.EncryptedCredentials = encryptedPayload
	integ.Status = domain.GmailStatusActive
	if err := s.repo.Upsert(ctx, integ); err != nil {
		return "", fmt.Errorf("falha ao persistir credenciais renovadas do Gmail: %w", err)
	}

	return tokens.AccessToken, nil
}

func (s *GmailService) forceRefreshToken(ctx context.Context, userID string) (string, error) {
	integ, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return "", err
	}
	rawPayload := integ.EncryptedCredentials
	if s.encKey != "" {
		if decrypted, err := crypto.Decrypt(rawPayload, s.encKey); err == nil {
			rawPayload = decrypted
		}
	}
	var tokens gmailStoredTokens
	if err := json.Unmarshal([]byte(rawPayload), &tokens); err != nil {
		return "", domain.ErrGmailInvalidCredentials
	}
	if tokens.RefreshToken == "" {
		return "", domain.ErrGmailAuthFailed
	}
	return s.refreshToken(ctx, userID, integ, &tokens)
}

// GetValidAccessToken recupera o token decifrado ou renova proativamente se expirado.
func (s *GmailService) GetValidAccessToken(ctx context.Context, userID string) (string, error) {
	integ, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return "", err
	}

	rawPayload := integ.EncryptedCredentials
	if s.encKey != "" {
		decrypted, err := crypto.Decrypt(rawPayload, s.encKey)
		if err == nil {
			rawPayload = decrypted
		}
	}

	var tokens gmailStoredTokens
	if err := json.Unmarshal([]byte(rawPayload), &tokens); err != nil {
		return "", domain.ErrGmailInvalidCredentials
	}

	isExpired := tokens.AccessToken == "" || (tokens.UpdatedAt > 0 && time.Now().Unix() >= tokens.UpdatedAt+int64(tokens.ExpiresIn)-60)
	if isExpired && tokens.RefreshToken != "" {
		newTok, err := s.refreshToken(ctx, userID, integ, &tokens)
		if err == nil {
			return newTok, nil
		}
		return "", err
	}

	if tokens.AccessToken != "" {
		return tokens.AccessToken, nil
	}

	if tokens.RefreshToken != "" {
		return s.refreshToken(ctx, userID, integ, &tokens)
	}

	return "", domain.ErrGmailInvalidCredentials
}

type messageDetailResult struct {
	index    int
	id       string
	snippet  string
	labelIDs []string
	headers  []struct {
		Name  string `json:"name"`
		Value string `json:"value"`
	}
}

// ScanEmailsWithOptions consulta e tria e-mails respeitando a pasta (default Caixa Principal) e concorrência otimizada.
func (s *GmailService) ScanEmailsWithOptions(ctx context.Context, userID string, opts ScanOptions) (*domain.GmailScanResult, error) {
	accessToken, err := s.GetValidAccessToken(ctx, userID)
	if err != nil {
		return nil, err
	}

	maxResults := opts.Limit
	if maxResults <= 0 {
		maxResults = 10
	} else if maxResults > 20 {
		maxResults = 20
	}

	queryString := BuildGmailQuery(opts)
	reqURL := fmt.Sprintf("%s/gmail/v1/users/me/messages?q=%s&maxResults=%d",
		s.baseURL,
		url.QueryEscape(queryString),
		maxResults,
	)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("falha ao consultar lista de mensagens do Gmail: %w", err)
	}

	// Recuperação reativa caso 401
	if resp.StatusCode == http.StatusUnauthorized {
		resp.Body.Close()
		refreshedToken, refErr := s.forceRefreshToken(ctx, userID)
		if refErr != nil {
			_ = s.repo.UpdateStatus(ctx, userID, domain.GmailStatusReauthRequired)
			return nil, domain.ErrGmailAuthFailed
		}
		accessToken = refreshedToken

		req, err = http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+accessToken)
		resp, err = s.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("falha ao consultar lista de mensagens do Gmail após renovação: %w", err)
		}
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized {
		_ = s.repo.UpdateStatus(ctx, userID, domain.GmailStatusReauthRequired)
		return nil, domain.ErrGmailAuthFailed
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("erro da Gmail API (status %d): %s", resp.StatusCode, string(body))
	}

	var listResp struct {
		Messages []struct {
			ID string `json:"id"`
		} `json:"messages"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&listResp); err != nil {
		return nil, err
	}

	result := &domain.GmailScanResult{
		ScannedAt:    time.Now().UTC(),
		MessagesRead: len(listResp.Messages),
	}

	if len(listResp.Messages) == 0 {
		_ = s.repo.UpdateLastScanned(ctx, userID, "", result.ScannedAt)
		return result, nil
	}

	// Concorrência limitada (máx 5 requisições paralelas) com payload leve de metadados
	details := make([]*messageDetailResult, len(listResp.Messages))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 5)

	for i, msgMeta := range listResp.Messages {
		wg.Add(1)
		go func(idx int, msgID string) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			detailURL := fmt.Sprintf("%s/gmail/v1/users/me/messages/%s?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date", s.baseURL, msgID)
			dReq, err := http.NewRequestWithContext(ctx, http.MethodGet, detailURL, nil)
			if err != nil {
				return
			}
			dReq.Header.Set("Authorization", "Bearer "+accessToken)

			dResp, err := s.httpClient.Do(dReq)
			if err != nil {
				return
			}
			defer dResp.Body.Close()

			if dResp.StatusCode != http.StatusOK {
				return
			}

			var d struct {
				ID       string   `json:"id"`
				Snippet  string   `json:"snippet"`
				LabelIDs []string `json:"labelIds"`
				Payload  struct {
					Headers []struct {
						Name  string `json:"name"`
						Value string `json:"value"`
					} `json:"headers"`
				} `json:"payload"`
			}
			if err := json.NewDecoder(dResp.Body).Decode(&d); err == nil {
				details[idx] = &messageDetailResult{
					index:    idx,
					id:       d.ID,
					snippet:  d.Snippet,
					labelIDs: d.LabelIDs,
					headers:  d.Payload.Headers,
				}
			}
		}(i, msgMeta.ID)
	}
	wg.Wait()

	maxUrgent := maxResults
	if maxUrgent > 10 {
		maxUrgent = 10
	}

	for _, d := range details {
		if d == nil {
			continue
		}

		subject, from, dateStr := extractHeaders(d.headers)
		combinedText := subject + " " + d.snippet

		// 1. Parser de Boletos e Faturas
		if bill := parseBill(d.id, subject, from, combinedText); bill != nil {
			result.Bills = append(result.Bills, *bill)
		}

		// 2. Parser de Confirmações de Voo
		if flight := parseFlight(d.id, subject, from, combinedText); flight != nil {
			result.Flights = append(result.Flights, *flight)
		}

		// 3. Adiciona na lista de e-mails urgentes/recentes
		if len(result.UrgentEmails) < maxUrgent {
			msgDate, _ := time.Parse(time.RFC1123Z, dateStr)
			if msgDate.IsZero() {
				msgDate = time.Now().UTC()
			}
			isUnread := false
			for _, lbl := range d.labelIDs {
				if lbl == "UNREAD" {
					isUnread = true
					break
				}
			}
			result.UrgentEmails = append(result.UrgentEmails, domain.UrgentEmail{
				MessageID: d.id,
				From:      from,
				Subject:   subject,
				Snippet:   d.snippet,
				Date:      msgDate,
				IsUnread:  isUnread,
			})
		}
	}

	_ = s.repo.UpdateLastScanned(ctx, userID, "", result.ScannedAt)
	return result, nil
}

// ScanEmails busca e faz a triagem padrão da Caixa Principal.
func (s *GmailService) ScanEmails(ctx context.Context, userID string) (*domain.GmailScanResult, error) {
	return s.ScanEmailsWithOptions(ctx, userID, ScanOptions{Folder: "primary"})
}
