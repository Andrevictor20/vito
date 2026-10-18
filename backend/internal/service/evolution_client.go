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
	DeleteInstance(ctx context.Context, instanceName string) error
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
