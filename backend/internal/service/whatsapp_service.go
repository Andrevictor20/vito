package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppServiceConfig armazena parâmetros do serviço de integração com WhatsApp.
type WhatsAppServiceConfig struct {
	WebhookBaseURL  string
	EvolutionAPIURL string
	EvolutionAPIKey string
	HTTPClient      *http.Client
}

// EvolutionAPIClient abstrai as chamadas HTTP para o container da Evolution API v2.
type EvolutionAPIClient interface {
	CreateInstance(ctx context.Context, instanceName, phone string) error
	SetWebhook(ctx context.Context, instanceName, webhookURL string) error
	GetPairingCode(ctx context.Context, instanceName, phone string) (string, error)
	GetConnectionState(ctx context.Context, instanceName string) (string, error)
	Logout(ctx context.Context, instanceName string) error
	SendText(ctx context.Context, instanceName, to, text string) error
}

// DefaultEvolutionClient implementa EvolutionAPIClient via chamadas REST para a Evolution API.
type DefaultEvolutionClient struct {
	baseURL    string
	apiKey     string
	httpClient *http.Client
}

// NewDefaultEvolutionClient instancia o cliente padrão da Evolution API v2.
func NewDefaultEvolutionClient(baseURL, apiKey string, client *http.Client) *DefaultEvolutionClient {
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	baseURL = strings.TrimRight(baseURL, "/")
	return &DefaultEvolutionClient{
		baseURL:    baseURL,
		apiKey:     apiKey,
		httpClient: client,
	}
}

func (c *DefaultEvolutionClient) doRequest(ctx context.Context, method, path string, body interface{}) (*http.Response, error) {
	var bodyReader io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return nil, err
		}
		bodyReader = bytes.NewReader(data)
	}

	url := fmt.Sprintf("%s%s", c.baseURL, path)
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return nil, err
	}

	req.Header.Set("apikey", c.apiKey)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	return c.httpClient.Do(req)
}

func (c *DefaultEvolutionClient) CreateInstance(ctx context.Context, instanceName, phone string) error {
	payload := map[string]interface{}{
		"instanceName": instanceName,
		"token":        "",
		"qrcode":       false,
		"number":       phone,
		"integration":  "WHATSAPP-BAILEYS",
	}

	resp, err := c.doRequest(ctx, http.MethodPost, "/instance/create", payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	// Se a instância já existir (403 ou 400 com "already in use"), prossegue normalmente
	if resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusForbidden {
		return nil
	}

	bodyBytes, _ := io.ReadAll(resp.Body)
	if strings.Contains(string(bodyBytes), "already in use") {
		return nil
	}
	return fmt.Errorf("evolution api create instance falhou (status %d): %s", resp.StatusCode, string(bodyBytes))
}

func (c *DefaultEvolutionClient) SetWebhook(ctx context.Context, instanceName, webhookURL string) error {
	payload := map[string]interface{}{
		"webhook": map[string]interface{}{
			"enabled":  true,
			"url":      webhookURL,
			"byEvents": false,
			"events": []string{
				"MESSAGES_UPSERT",
				"CONNECTION_UPDATE",
			},
		},
	}

	path := fmt.Sprintf("/webhook/set/%s", instanceName)
	resp, err := c.doRequest(ctx, http.MethodPost, path, payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	bodyBytes, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("evolution api set webhook falhou (status %d): %s", resp.StatusCode, string(bodyBytes))
}

func (c *DefaultEvolutionClient) GetPairingCode(ctx context.Context, instanceName, phone string) (string, error) {
	path := fmt.Sprintf("/instance/connect/%s?number=%s", instanceName, phone)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("evolution api get pairing code falhou (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var parsed struct {
		PairingCode string `json:"pairingCode"`
		Code        string `json:"code"`
	}
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		return "", err
	}

	resCode := parsed.PairingCode
	if resCode == "" {
		resCode = parsed.Code
	}
	if resCode == "" {
		return "", fmt.Errorf("código de pareamento vazio na resposta da Evolution API: %s", string(bodyBytes))
	}
	return resCode, nil
}

func (c *DefaultEvolutionClient) GetConnectionState(ctx context.Context, instanceName string) (string, error) {
	path := fmt.Sprintf("/instance/connectionState/%s", instanceName)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	var parsed struct {
		Instance struct {
			State string `json:"state"`
		} `json:"instance"`
		State string `json:"state"`
	}
	_ = json.Unmarshal(bodyBytes, &parsed)

	if parsed.Instance.State != "" {
		return parsed.Instance.State, nil
	}
	return parsed.State, nil
}

func (c *DefaultEvolutionClient) Logout(ctx context.Context, instanceName string) error {
	path := fmt.Sprintf("/instance/logout/%s", instanceName)
	resp, err := c.doRequest(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func (c *DefaultEvolutionClient) SendText(ctx context.Context, instanceName, to, text string) error {
	payload := map[string]interface{}{
		"number": to,
		"text":   text,
	}
	path := fmt.Sprintf("/message/sendText/%s", instanceName)
	resp, err := c.doRequest(ctx, http.MethodPost, path, payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	bodyBytes, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("evolution api sendText falhou (status %d): %s", resp.StatusCode, string(bodyBytes))
}

// WhatsAppService gerencia o pareamento, sincronização de estado e webhook do WhatsApp.
type WhatsAppService struct {
	cfg          WhatsAppServiceConfig
	repo         domain.WhatsAppRepository
	client       EvolutionAPIClient
	assistantSvc *AssistantService
}

// NewWhatsAppService instancia o serviço do WhatsApp.
func NewWhatsAppService(
	cfg WhatsAppServiceConfig,
	repo domain.WhatsAppRepository,
	client EvolutionAPIClient,
	assistantSvc *AssistantService,
) *WhatsAppService {
	return &WhatsAppService{
		cfg:          cfg,
		repo:         repo,
		client:       client,
		assistantSvc: assistantSvc,
	}
}

// SanitizePhoneNumber limpa e normaliza o número para o padrão internacional E.164 sem o '+'.
func SanitizePhoneNumber(raw string) (string, error) {
	re := regexp.MustCompile(`\D+`)
	digits := re.ReplaceAllString(raw, "")

	if len(digits) < 10 {
		return "", domain.ErrWhatsAppInvalidPhone
	}

	// Brasil: 10 ou 11 dígitos sem DDI (ex: 11988887777 ou 1188887777)
	if len(digits) == 10 || len(digits) == 11 {
		digits = "55" + digits
	}

	return digits, nil
}

// MakeInstanceName gera o identificador único da instância para a Evolution API.
func MakeInstanceName(userID string) string {
	clean := strings.ReplaceAll(userID, "-", "_")
	return fmt.Sprintf("vito_user_%s", clean)
}

// RequestPairingCode inicia a criação da instância e obtém o código de pareamento de 8 dígitos.
func (s *WhatsAppService) RequestPairingCode(ctx context.Context, userID, rawPhone string) (string, error) {
	phone, err := SanitizePhoneNumber(rawPhone)
	if err != nil {
		return "", err
	}

	instanceName := MakeInstanceName(userID)

	if err := s.client.CreateInstance(ctx, instanceName, phone); err != nil {
		log.Printf("⚠️ [WhatsAppService] Erro ao criar instância %s: %v", instanceName, err)
	}

	webhookURL := fmt.Sprintf("%s/api/v1/integrations/whatsapp/webhook", strings.TrimRight(s.cfg.WebhookBaseURL, "/"))
	if err := s.client.SetWebhook(ctx, instanceName, webhookURL); err != nil {
		log.Printf("⚠️ [WhatsAppService] Aviso ao configurar webhook para %s: %v", instanceName, err)
	}

	code, err := s.client.GetPairingCode(ctx, instanceName, phone)
	if err != nil {
		return "", fmt.Errorf("falha ao gerar código de pareamento: %w", err)
	}

	existing, err := s.repo.GetByUserID(ctx, userID)
	integrationID := uuid.New().String()
	if err == nil && existing != nil {
		integrationID = existing.ID
	}

	integration := &domain.WhatsAppIntegration{
		ID:           integrationID,
		UserID:       userID,
		InstanceName: instanceName,
		Phone:        phone,
		Status:       domain.WhatsAppStatusConnecting,
		PairingCode:  code,
		CreatedAt:    time.Now().UTC(),
		UpdatedAt:    time.Now().UTC(),
	}

	if err := s.repo.Upsert(ctx, integration); err != nil {
		return "", fmt.Errorf("falha ao persistir sessão whatsapp: %w", err)
	}

	return code, nil
}

// GetStatus retorna a sessão atual do WhatsApp sincronizando com a Evolution API se necessário.
func (s *WhatsAppService) GetStatus(ctx context.Context, userID string) (*domain.WhatsAppIntegration, error) {
	integration, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	state, err := s.client.GetConnectionState(ctx, integration.InstanceName)
	if err == nil && state != "" {
		if strings.EqualFold(state, "open") && integration.Status != domain.WhatsAppStatusConnected {
			now := time.Now().UTC()
			integration.Status = domain.WhatsAppStatusConnected
			integration.LastConnectedAt = &now
			_ = s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusConnected, &now)
		} else if (strings.EqualFold(state, "close") || strings.EqualFold(state, "refused")) && integration.Status == domain.WhatsAppStatusConnected {
			integration.Status = domain.WhatsAppStatusDisconnected
			_ = s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusDisconnected, nil)
		}
	}

	return integration, nil
}

// Disconnect desvincula a conta do WhatsApp deslogando da Evolution API.
func (s *WhatsAppService) Disconnect(ctx context.Context, userID string) error {
	integration, err := s.repo.GetByUserID(ctx, userID)
	if err != nil {
		return err
	}

	_ = s.client.Logout(ctx, integration.InstanceName)
	return s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusDisconnected, nil)
}

// HandleWebhook processa eventos de atualização de conexão e mensagens recebidas.
func (s *WhatsAppService) HandleWebhook(ctx context.Context, eventType string, payload []byte) error {
	var base struct {
		Event    string          `json:"event"`
		Instance string          `json:"instance"`
		Data     json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(payload, &base); err != nil {
		return err
	}

	event := strings.ToLower(base.Event)
	if event == "" {
		event = strings.ToLower(eventType)
	}

	if strings.Contains(event, "connection") {
		var connData struct {
			State string `json:"state"`
		}
		_ = json.Unmarshal(base.Data, &connData)

		integration, err := s.repo.GetByInstanceName(ctx, base.Instance)
		if err == nil && integration != nil {
			if strings.EqualFold(connData.State, "open") {
				now := time.Now().UTC()
				_ = s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusConnected, &now)
			} else if strings.EqualFold(connData.State, "close") || strings.EqualFold(connData.State, "refused") {
				_ = s.repo.UpdateStatus(ctx, integration.ID, domain.WhatsAppStatusDisconnected, nil)
			}
		}
		return nil
	}

	if strings.Contains(event, "messages") {
		var msgData struct {
			Key struct {
				RemoteJid string `json:"remoteJid"`
				FromMe    bool   `json:"fromMe"`
			} `json:"key"`
			Message struct {
				Conversation        string `json:"conversation"`
				ExtendedTextMessage struct {
					Text string `json:"text"`
				} `json:"extendedTextMessage"`
			} `json:"message"`
		}
		if err := json.Unmarshal(base.Data, &msgData); err != nil {
			return err
		}

		if msgData.Key.FromMe {
			return nil
		}

		rawText := msgData.Message.Conversation
		if rawText == "" {
			rawText = msgData.Message.ExtendedTextMessage.Text
		}
		rawText = strings.TrimSpace(rawText)
		if rawText == "" {
			return nil
		}

		isGroup := strings.HasSuffix(msgData.Key.RemoteJid, "@g.us")
		if isGroup {
			lower := strings.ToLower(rawText)
			if !strings.Contains(lower, "@vito") && !strings.HasPrefix(lower, "vito:") {
				// Privacidade em grupos: ignora conversas onde o Vito não foi mencionado
				return nil
			}
			reVito := regexp.MustCompile(`(?i)@vito\s*|vito:\s*`)
			rawText = strings.TrimSpace(reVito.ReplaceAllString(rawText, ""))
			if rawText == "" {
				return nil
			}
		}

		integration, err := s.repo.GetByInstanceName(ctx, base.Instance)
		if err != nil || integration == nil {
			return nil
		}

		if s.assistantSvc == nil {
			return nil
		}

		resp, err := s.assistantSvc.Process(ctx, integration.UserID, ai.UserInput{
			Text: rawText,
		})
		if err != nil {
			log.Printf("⚠️ [WhatsAppService] Erro ao processar mensagem do WhatsApp: %v", err)
			return nil
		}

		replyText := resp.Reply
		if replyText == "" {
			replyText = resp.Message
		}
		if replyText != "" {
			_ = s.client.SendText(ctx, base.Instance, msgData.Key.RemoteJid, replyText)
		}
	}

	return nil
}
