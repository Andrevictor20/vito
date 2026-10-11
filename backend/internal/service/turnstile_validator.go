package service

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"net/url"
	"time"
)

// TurnstileValidator valida tokens do Cloudflare Turnstile anti-bot.
type TurnstileValidator struct {
	secretKey  string
	endpoint   string
	httpClient *http.Client
}

// NewTurnstileValidator instancia o validador. Se secretKey for vazia, opera em bypass seguro para dev.
func NewTurnstileValidator(secretKey string) *TurnstileValidator {
	return &TurnstileValidator{
		secretKey: secretKey,
		endpoint:  "https://challenges.cloudflare.com/turnstile/v0/siteverify",
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// SetEndpoint permite customizar o endpoint para testes unitários.
func (v *TurnstileValidator) SetEndpoint(endpoint string) {
	v.endpoint = endpoint
}

// Validate verifica se o token Turnstile é válido.
func (v *TurnstileValidator) Validate(ctx context.Context, token, remoteIP string) (bool, error) {
	// Se nenhuma chave secreta estiver configurada, permite bypass em desenvolvimento local
	if v.secretKey == "" {
		return true, nil
	}

	if token == "" {
		return false, nil
	}

	form := url.Values{}
	form.Set("secret", v.secretKey)
	form.Set("response", token)
	if remoteIP != "" {
		form.Set("remoteip", remoteIP)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, v.endpoint, nil)
	if err != nil {
		return false, err
	}
	req.PostForm = form
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := v.httpClient.Do(req)
	if err != nil {
		log.Printf("[Turnstile] falha na requisição de validação: %v", err)
		return false, err
	}
	defer resp.Body.Close()

	var result struct {
		Success    bool     `json:"success"`
		ErrorCodes []string `json:"error-codes"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return false, err
	}

	return result.Success, nil
}
