package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

// ShortIoShortenerService gerencia a criação de links encurtados via API do Short.io,
// oferecendo suporte a domínios próprios, slugs customizados e fallback transparente
// para a URL canônica pública do Vito em caso de ausência de credenciais ou falha de rede.
type ShortIoShortenerService struct {
	apiKey        string
	domain        string
	publicBaseURL string
	endpoint      string
	httpClient    *http.Client
}

// NewShortIoShortenerService instancia o serviço com timeouts e defaults seguros.
func NewShortIoShortenerService(apiKey, domain, publicBaseURL string) *ShortIoShortenerService {
	return &ShortIoShortenerService{
		apiKey:        apiKey,
		domain:        domain,
		publicBaseURL: publicBaseURL,
		endpoint:      "https://api.short.io/links",
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// SetEndpoint customiza o endpoint para execução de suítes de testes unitários com httptest.
func (s *ShortIoShortenerService) SetEndpoint(endpoint string) {
	s.endpoint = endpoint
}

// SetTimeout permite customizar o timeout HTTP do cliente (útil em testes de timeout).
func (s *ShortIoShortenerService) SetTimeout(timeout time.Duration) {
	s.httpClient.Timeout = timeout
}

// SetDomain altera o domínio alvo cadastrado no Short.io.
func (s *ShortIoShortenerService) SetDomain(domain string) {
	s.domain = domain
}

// ShortenLink gera o link curto com slug customizado. Caso não haja chave configurada,
// ou caso ocorra qualquer indisponibilidade no serviço externo, retorna a targetURL canônica.
func (s *ShortIoShortenerService) ShortenLink(ctx context.Context, targetURL, key string) (string, error) {
	if s.apiKey == "" {
		return targetURL, nil
	}

	shortURL, err := s.callShortIoAPI(ctx, targetURL, key)
	if err == nil && shortURL != "" {
		return shortURL, nil
	}

	// Caso haja conflito de slug (path já em uso na conta) e uma key customizada foi enviada,
	// tenta uma segunda vez sem o parâmetro 'path' para que o Short.io gere um slug aleatório.
	if key != "" {
		if retryURL, retryErr := s.callShortIoAPI(ctx, targetURL, ""); retryErr == nil && retryURL != "" {
			return retryURL, nil
		}
	}

	// Fallback resiliente: falha externa nunca deve inviabilizar o agendamento
	log.Printf("[ShortIoShortener] API indisponível ou com erro (%v). Utilizando fallback canônico: %s", err, targetURL)
	return targetURL, nil
}

func (s *ShortIoShortenerService) callShortIoAPI(ctx context.Context, targetURL, key string) (string, error) {
	payload := map[string]string{
		"originalURL": targetURL,
	}
	if s.domain != "" {
		payload["domain"] = s.domain
	}
	if key != "" {
		payload["path"] = key
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("falha ao serializar payload JSON: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", fmt.Errorf("falha ao criar requisição HTTP: %w", err)
	}

	req.Header.Set("Authorization", s.apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("erro na conexão com a API do Short.io: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("erro ao ler resposta HTTP: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("status %d da API Short.io: %s", resp.StatusCode, string(respBody))
	}

	var shortResp struct {
		ShortURL       string `json:"shortURL"`
		SecureShortURL string `json:"secureShortURL"`
		ShortLink      string `json:"shortLink"`
	}
	if err := json.Unmarshal(respBody, &shortResp); err != nil {
		return "", fmt.Errorf("falha ao decodificar JSON de resposta: %w", err)
	}

	if shortResp.ShortURL != "" {
		return shortResp.ShortURL, nil
	}
	if shortResp.SecureShortURL != "" {
		return shortResp.SecureShortURL, nil
	}
	if shortResp.ShortLink != "" {
		return shortResp.ShortLink, nil
	}

	return "", fmt.Errorf("resposta sem link encurtado válido")
}
