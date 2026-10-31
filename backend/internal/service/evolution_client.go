package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// WhatsAppContact representa um contato retornado pela Evolution API v2.
type WhatsAppContact struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	PushName      string `json:"pushName"`
	Number        string `json:"number"`
	ProfilePicURL string `json:"profilePicUrl,omitempty"`
}

// EvolutionAPIClient abstrai as chamadas HTTP para o container da Evolution API v2.
type EvolutionAPIClient interface {
	CreateInstance(ctx context.Context, instanceName, phone string) error
	SetWebhook(ctx context.Context, instanceName, webhookURL string) error
	SetSettings(ctx context.Context, instanceName string, settings map[string]interface{}) error
	GetPairingCode(ctx context.Context, instanceName, phone string) (string, error)
	GetConnectionState(ctx context.Context, instanceName string) (string, error)
	DeleteInstance(ctx context.Context, instanceName string) error
	Logout(ctx context.Context, instanceName string) error
	SendText(ctx context.Context, instanceName, to, text string) error
	SendTextWithQuoted(ctx context.Context, instanceName, to, text, quotedID string) error
	GetMediaBase64(ctx context.Context, instanceName string, messagePayload interface{}) (string, error)
	FindContacts(ctx context.Context, instanceName string) ([]WhatsAppContact, error)
	SendReaction(ctx context.Context, instanceName, remoteJid, messageID, reaction string) error
	FindMessages(ctx context.Context, in EvolutionFindMessagesInput) ([]WhatsAppChatMessage, error)
	FindGroups(ctx context.Context, instanceName string) ([]WhatsAppGroup, error)
	FindParticipants(ctx context.Context, instanceName, groupJid string) ([]string, error)
	FindOwnerJID(ctx context.Context, instanceName string) (string, error)
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
		"instanceName":    instanceName,
		"token":           "",
		"qrcode":          false,
		"number":          phone,
		"integration":     "WHATSAPP-BAILEYS",
		"syncFullHistory": false,
		"settings": map[string]interface{}{
			"rejectCall":      false,
			"groupsIgnore":    false,
			"alwaysOnline":    false,
			"readMessages":    false,
			"readStatus":      false,
			"syncFullHistory": false,
		},
	}

	resp, err := c.doRequest(ctx, http.MethodPost, "/instance/create", payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

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
	wrappedPayload := map[string]interface{}{
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
	resp, err := c.doRequest(ctx, http.MethodPost, path, wrappedPayload)
	if err == nil {
		defer resp.Body.Close()
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return nil
		}
	}

	// Fallback para formato flat (utilizado em algumas distribuições da Evolution API v2)
	flatPayload := map[string]interface{}{
		"enabled":         true,
		"url":             webhookURL,
		"webhookByEvents": false,
		"events": []string{
			"MESSAGES_UPSERT",
			"CONNECTION_UPDATE",
		},
	}
	respFlat, errFlat := c.doRequest(ctx, http.MethodPost, path, flatPayload)
	if errFlat != nil {
		return errFlat
	}
	defer respFlat.Body.Close()

	if respFlat.StatusCode >= 200 && respFlat.StatusCode < 300 {
		return nil
	}
	bodyBytes, _ := io.ReadAll(respFlat.Body)
	return fmt.Errorf("evolution api set webhook falhou (status %d): %s", respFlat.StatusCode, string(bodyBytes))
}

func (c *DefaultEvolutionClient) SetSettings(ctx context.Context, instanceName string, settings map[string]interface{}) error {
	path := fmt.Sprintf("/settings/set/%s", instanceName)
	resp, err := c.doRequest(ctx, http.MethodPost, path, settings)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
}

func extractPairingCodeFromBody(bodyBytes []byte) string {
	var parsed struct {
		PairingCode string `json:"pairingCode"`
		Code        string `json:"code"`
	}
	if err := json.Unmarshal(bodyBytes, &parsed); err == nil {
		if parsed.PairingCode != "" {
			return parsed.PairingCode
		}
		if parsed.Code != "" {
			return parsed.Code
		}
	}
	return ""
}

func (c *DefaultEvolutionClient) GetPairingCode(ctx context.Context, instanceName, phone string) (string, error) {
	var lastBody []byte

	// Tentativa 1: GET /instance/connect/{instanceName}?number={phone}
	path := fmt.Sprintf("/instance/connect/%s?number=%s", instanceName, phone)
	resp, err := c.doRequest(ctx, http.MethodGet, path, nil)
	if err == nil {
		defer resp.Body.Close()
		bodyBytes, errRead := io.ReadAll(resp.Body)
		if errRead == nil && resp.StatusCode >= 200 && resp.StatusCode < 300 {
			lastBody = bodyBytes
			if code := extractPairingCodeFromBody(bodyBytes); code != "" {
				return code, nil
			}
		}
	}

	// Tentativa 2: POST /instance/connect/{instanceName} com body {"number": phone}
	postPath := fmt.Sprintf("/instance/connect/%s", instanceName)
	respPost, errPost := c.doRequest(ctx, http.MethodPost, postPath, map[string]interface{}{"number": phone})
	if errPost == nil {
		defer respPost.Body.Close()
		bodyBytes, errRead := io.ReadAll(respPost.Body)
		if errRead == nil && respPost.StatusCode >= 200 && respPost.StatusCode < 300 {
			lastBody = bodyBytes
			if code := extractPairingCodeFromBody(bodyBytes); code != "" {
				return code, nil
			}
		}
	}

	// Tentativa 3: POST /instance/pair/{instanceName} com body {"number": phone, "phone": phone}
	pairPath := fmt.Sprintf("/instance/pair/%s", instanceName)
	respPair, errPair := c.doRequest(ctx, http.MethodPost, pairPath, map[string]interface{}{"number": phone, "phone": phone})
	if errPair == nil {
		defer respPair.Body.Close()
		bodyBytes, errRead := io.ReadAll(respPair.Body)
		if errRead == nil && respPair.StatusCode >= 200 && respPair.StatusCode < 300 {
			lastBody = bodyBytes
			if code := extractPairingCodeFromBody(bodyBytes); code != "" {
				return code, nil
			}
		}
	}

	if len(lastBody) > 0 {
		return "", fmt.Errorf("código de pareamento vazio na resposta da Evolution API: %s", string(lastBody))
	}
	return "", fmt.Errorf("falha ao comunicar com a Evolution API para obter código de pareamento")
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

func (c *DefaultEvolutionClient) DeleteInstance(ctx context.Context, instanceName string) error {
	path := fmt.Sprintf("/instance/delete/%s", instanceName)
	resp, err := c.doRequest(ctx, http.MethodDelete, path, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	return nil
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
	return c.SendTextWithQuoted(ctx, instanceName, to, text, "")
}

func (c *DefaultEvolutionClient) SendTextWithQuoted(ctx context.Context, instanceName, to, text, quotedID string) error {
	payload := map[string]interface{}{
		"number": to,
		"text":   text,
	}
	if quotedID != "" {
		payload["quoted"] = map[string]interface{}{
			"key": map[string]interface{}{
				"id": quotedID,
			},
		}
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

func (c *DefaultEvolutionClient) GetMediaBase64(ctx context.Context, instanceName string, messagePayload interface{}) (string, error) {
	path := fmt.Sprintf("/chat/getBase64FromMediaMessage/%s", instanceName)
	payload := map[string]interface{}{
		"message":      messagePayload,
		"convertToMp4": false,
	}
	resp, err := c.doRequest(ctx, http.MethodPost, path, payload)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("evolution api getBase64 falhou (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var parsed struct {
		Base64 string `json:"base64"`
	}
	if err := json.Unmarshal(bodyBytes, &parsed); err != nil {
		return "", err
	}

	raw := parsed.Base64
	if idx := strings.Index(raw, ";base64,"); idx != -1 {
		raw = raw[idx+8:]
	}
	return strings.TrimSpace(raw), nil
}

func (c *DefaultEvolutionClient) FindContacts(ctx context.Context, instanceName string) ([]WhatsAppContact, error) {
	contacts, err := c.findContacts(ctx, instanceName, map[string]interface{}{})
	if err != nil {
		return nil, err
	}
	return contacts, nil
}

// FindContactsByID busca um contato específico (o `where.id` do contrato).
func (c *DefaultEvolutionClient) FindContactsByID(ctx context.Context, instanceName, id string) ([]WhatsAppContact, error) {
	return c.findContacts(ctx, instanceName, map[string]interface{}{"id": id})
}

// findContacts chama o endpoint de contatos com o `where` informado.
func (c *DefaultEvolutionClient) findContacts(ctx context.Context, instanceName string, where map[string]interface{}) ([]WhatsAppContact, error) {
	path := fmt.Sprintf("/chat/findContacts/%s", instanceName)
	// O `where` é OBRIGATÓRIO no contrato da Evolution (Chat Controller v2):
	// sem ele a API devolve lista vazia — e é assim que o nome SALVO do contato
	// (o nome que o dono dá na agenda) nunca chegava ao Vito.
	resp, err := c.doRequest(ctx, http.MethodPost, path, map[string]interface{}{
		"where": where,
	})
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("evolution api findContacts falhou (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var contacts []WhatsAppContact
	if err := json.Unmarshal(bodyBytes, &contacts); err != nil {
		return nil, err
	}
	return contacts, nil
}

// SendReaction envia uma reação (emoji) a uma mensagem específica no WhatsApp via Evolution API v2.
func (c *DefaultEvolutionClient) SendReaction(ctx context.Context, instanceName, remoteJid, messageID, reaction string) error {
	if instanceName == "" || remoteJid == "" || messageID == "" || reaction == "" {
		return nil
	}
	path := fmt.Sprintf("/message/sendReaction/%s", instanceName)
	payload := map[string]interface{}{
		"key": map[string]interface{}{
			"remoteJid": remoteJid,
			"fromMe":    false,
			"id":        messageID,
		},
		"reaction": reaction,
	}
	resp, err := c.doRequest(ctx, http.MethodPost, path, payload)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	bodyBytes, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("evolution api sendReaction falhou (status %d): %s", resp.StatusCode, string(bodyBytes))
}
