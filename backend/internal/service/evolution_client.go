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
