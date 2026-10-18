package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
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

// GetValidAccessToken recupera o token decifrado ou renova via refresh token se expirado.
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

	// Se não tiver refresh token ou ainda for válido, retorna o access token
	if tokens.AccessToken != "" && tokens.RefreshToken == "" {
		return tokens.AccessToken, nil
	}

	return tokens.AccessToken, nil
}

// ScanEmails busca e faz a triagem de mensagens não lidas de boletos, faturas e voos.
func (s *GmailService) ScanEmails(ctx context.Context, userID string) (*domain.GmailScanResult, error) {
	accessToken, err := s.GetValidAccessToken(ctx, userID)
	if err != nil {
		return nil, err
	}

	reqURL := fmt.Sprintf("%s/gmail/v1/users/me/messages?q=%s&maxResults=20",
		s.baseURL,
		url.QueryEscape("label:UNREAD"),
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

	for _, msgMeta := range listResp.Messages {
		detailURL := fmt.Sprintf("%s/gmail/v1/users/me/messages/%s?format=full", s.baseURL, msgMeta.ID)
		dReq, err := http.NewRequestWithContext(ctx, http.MethodGet, detailURL, nil)
		if err != nil {
			continue
		}
		dReq.Header.Set("Authorization", "Bearer "+accessToken)

		dResp, err := s.httpClient.Do(dReq)
		if err != nil {
			continue
		}

		var detail struct {
			ID      string `json:"id"`
			Snippet string `json:"snippet"`
			Payload struct {
				Headers []struct {
					Name  string `json:"name"`
					Value string `json:"value"`
				} `json:"headers"`
			} `json:"payload"`
		}
		_ = json.NewDecoder(dResp.Body).Decode(&detail)
		dResp.Body.Close()

		subject, from, dateStr := extractHeaders(detail.Payload.Headers)
		combinedText := subject + " " + detail.Snippet

		// 1. Parser de Boletos e Faturas
		if bill := parseBill(detail.ID, subject, from, combinedText); bill != nil {
			result.Bills = append(result.Bills, *bill)
		}

		// 2. Parser de Confirmações de Voo
		if flight := parseFlight(detail.ID, subject, from, combinedText); flight != nil {
			result.Flights = append(result.Flights, *flight)
		}

		// 3. Adiciona na lista de e-mails urgentes (até 5)
		if len(result.UrgentEmails) < 5 {
			msgDate, _ := time.Parse(time.RFC1123Z, dateStr)
			if msgDate.IsZero() {
				msgDate = time.Now().UTC()
			}
			result.UrgentEmails = append(result.UrgentEmails, domain.UrgentEmail{
				MessageID: detail.ID,
				From:      from,
				Subject:   subject,
				Snippet:   detail.Snippet,
				Date:      msgDate,
			})
		}
	}

	_ = s.repo.UpdateLastScanned(ctx, userID, "", result.ScannedAt)
	return result, nil
}

// CreateDraft cria um rascunho de e-mail na conta do Gmail do usuário.
func (s *GmailService) CreateDraft(ctx context.Context, userID, to, subject, bodyText string) (string, error) {
	accessToken, err := s.GetValidAccessToken(ctx, userID)
	if err != nil {
		return "", err
	}

	rawEmail := fmt.Sprintf("To: %s\r\nSubject: %s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		to, subject, bodyText,
	)
	encodedRaw := base64.URLEncoding.EncodeToString([]byte(rawEmail))

	payload := map[string]interface{}{
		"message": map[string]string{
			"raw": encodedRaw,
		},
	}
	reqBytes, _ := json.Marshal(payload)

	draftURL := fmt.Sprintf("%s/gmail/v1/users/me/drafts", s.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, draftURL, bytes.NewReader(reqBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("falha ao criar rascunho (status %d): %s", resp.StatusCode, string(respBody))
	}

	var draftResp struct {
		ID string `json:"id"`
	}
	_ = json.NewDecoder(resp.Body).Decode(&draftResp)
	return draftResp.ID, nil
}

func extractHeaders(headers []struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}) (subject, from, date string) {
	for _, h := range headers {
		switch strings.ToLower(h.Name) {
		case "subject":
			subject = h.Value
		case "from":
			from = h.Value
		case "date":
			date = h.Value
		}
	}
	return
}

var (
	billKeywordRegex = regexp.MustCompile(`(?i)(fatura|boleto|vencimento|mensalidade|conta|pagamento|fechamento)`)
	amountRegex      = regexp.MustCompile(`(?i)(?:R\$\s*|valor:\s*)([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2})`)
	barcodeRegex     = regexp.MustCompile(`([0-9]{5}[\.\s]?[0-9]{5}[\.\s]?[0-9]{5}[\.\s]?[0-9]{6}[\.\s]?[0-9]{5}[\.\s]?[0-9]{6}[\.\s]?[0-9][\.\s]?[0-9]{14}|[0-9]{47,48}|[0-9]{44})`)
	dueDateRegex     = regexp.MustCompile(`(?i)(?:vencimento|vence em|vencendo em|data de vencimento)[:\s]*([0-9]{1,2}[/\.-][0-9]{1,2}[/\.-][0-9]{2,4})`)

	flightKeywordRegex = regexp.MustCompile(`(?i)(voo|reserva de voo|localizador|e-ticket|confirmação de voo|embarque|latam|gol|azul|boarding pass)`)
	bookingCodeRegex   = regexp.MustCompile(`(?i)(?:localizador|código da reserva|reserva|booking code)[:\s]*([A-Z0-9]{6})`)
	airportRegex       = regexp.MustCompile(`\b(GRU|CGH|SDU|GIG|BSB|CNF|SSA|REC|POA|CWB|FOR|FLN|VCP)\b`)
)

func parseBill(msgID, subject, from, text string) *domain.ScannedBill {
	if !billKeywordRegex.MatchString(text) {
		return nil
	}

	bill := &domain.ScannedBill{
		MessageID: msgID,
		Subject:   subject,
	}

	// Beneficiário
	if from != "" {
		bill.Beneficiary = strings.Split(from, "<")[0]
		bill.Beneficiary = strings.TrimSpace(bill.Beneficiary)
	}

	// Valor R$
	if m := amountRegex.FindStringSubmatch(text); len(m) > 1 {
		rawVal := strings.ReplaceAll(m[1], ".", "")
		rawVal = strings.ReplaceAll(rawVal, ",", ".")
		if val, err := strconv.ParseFloat(rawVal, 64); err == nil {
			bill.AmountBRL = val
		}
	}

	// Linha digitável / Código de barras
	if m := barcodeRegex.FindStringSubmatch(text); len(m) > 1 {
		bill.Barcode = strings.ReplaceAll(strings.ReplaceAll(m[1], " ", ""), ".", "")
	}

	// Data de vencimento
	if m := dueDateRegex.FindStringSubmatch(text); len(m) > 1 {
		dateStr := strings.ReplaceAll(m[1], "-", "/")
		dateStr = strings.ReplaceAll(dateStr, ".", "/")
		if t, err := time.Parse("02/01/2006", dateStr); err == nil {
			bill.DueDate = &t
		}
	}

	return bill
}

func parseFlight(msgID, subject, from, text string) *domain.ScannedFlight {
	if !flightKeywordRegex.MatchString(text) {
		return nil
	}

	flight := &domain.ScannedFlight{
		MessageID: msgID,
		Subject:   subject,
	}

	// Localizador
	if m := bookingCodeRegex.FindStringSubmatch(text); len(m) > 1 {
		flight.BookingCode = strings.ToUpper(m[1])
	} else {
		// Fallback se encontrar qualquer código isolado de 6 caracteres alfanuméricos
		reExact := regexp.MustCompile(`\b([A-Z0-9]{6})\b`)
		if m := reExact.FindStringSubmatch(text); len(m) > 1 {
			flight.BookingCode = m[1]
		}
	}

	// Aeroportos de origem e destino
	airports := airportRegex.FindAllString(text, -1)
	if len(airports) >= 2 {
		flight.Origin = airports[0]
		flight.Destination = airports[1]
	} else if len(airports) == 1 {
		flight.Origin = airports[0]
	}

	// Companhia Aérea
	lower := strings.ToLower(text)
	if strings.Contains(lower, "latam") {
		flight.Airline = "LATAM Airlines"
	} else if strings.Contains(lower, "gol") {
		flight.Airline = "GOL Linhas Aéreas"
	} else if strings.Contains(lower, "azul") {
		flight.Airline = "Azul Linhas Aéreas"
	} else {
		flight.Airline = "Companhia Aérea"
	}

	return flight
}
