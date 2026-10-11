package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// DubShortenerService gerencia a geração de links encurtados via Dub.co
// com fallback resiliente para a URL canônica do próprio Vito.
type DubShortenerService struct {
	apiKey        string
	domain        string
	publicBaseURL string
	endpoint      string
	httpClient    *http.Client
}

// NewDubShortenerService instancia o serviço de encurtamento.
func NewDubShortenerService(apiKey, publicBaseURL string) *DubShortenerService {
	return &DubShortenerService{
		apiKey:        apiKey,
		publicBaseURL: publicBaseURL,
		endpoint:      "https://api.dub.co/links",
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}
}

// SetEndpoint permite customizar o endpoint para testes unitários.
func (s *DubShortenerService) SetEndpoint(endpoint string) {
	s.endpoint = endpoint
}

// SetDomain define um domínio customizado registrado no Workspace do Dub.
func (s *DubShortenerService) SetDomain(domain string) {
	s.domain = domain
}

// ShortenLink tenta encurtar via Dub.co; se não houver chave ou em caso de erro,
// faz fallback gracioso para a targetURL original.
func (s *DubShortenerService) ShortenLink(ctx context.Context, targetURL, key string) (string, error) {
	if s.apiKey == "" {
		return targetURL, nil
	}

	shortLink, err := s.callDubAPI(ctx, targetURL, key, true)
	if err == nil && shortLink != "" {
		return s.formatDomain(shortLink), nil
	}

	// Se falhou e foi tentado com domínio customizado, tenta sem domínio no payload
	// para o Dub criar sob dub.sh e nós formatamos para o domínio alvo depois
	if s.domain != "" {
		if noDomLink, noDomErr := s.callDubAPI(ctx, targetURL, key, false); noDomErr == nil && noDomLink != "" {
			return s.formatDomain(noDomLink), nil
		}
	}

	// Se falhou e foi tentado com key customizado, tenta novamente sem key
	// para deixar o Dub gerar um slug aleatório exclusivo e evitar conflito (409)
	if key != "" {
		if fallbackLink, fallbackErr := s.callDubAPI(ctx, targetURL, "", false); fallbackErr == nil && fallbackLink != "" {
			return s.formatDomain(fallbackLink), nil
		}
	}

	return targetURL, nil
}

func (s *DubShortenerService) formatDomain(link string) string {
	if s.domain != "" && strings.Contains(link, "dub.sh") {
		return strings.Replace(link, "dub.sh", s.domain, 1)
	}
	return link
}

func (s *DubShortenerService) callDubAPI(ctx context.Context, targetURL, key string, includeDomain bool) (string, error) {
	payload := map[string]string{
		"url": targetURL,
	}
	if key != "" {
		payload["key"] = key
	}
	if includeDomain && s.domain != "" {
		payload["domain"] = s.domain
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[DubShortener] falha ao serializar payload: %v (usando fallback)", err)
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewBuffer(bodyBytes))
	if err != nil {
		log.Printf("[DubShortener] falha ao criar request: %v (usando fallback)", err)
		return "", err
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[DubShortener] erro na requisição HTTP: %v (usando fallback)", err)
		return "", err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[DubShortener] erro ao ler corpo da resposta: %v", err)
		return "", err
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[DubShortener] resposta não-2xx da API Dub (%d): %s (usando fallback)", resp.StatusCode, string(respBody))
		return "", fmt.Errorf("status %d", resp.StatusCode)
	}

	var dubResp struct {
		ShortLink string `json:"shortLink"`
		URL       string `json:"url"`
	}
	if err := json.Unmarshal(respBody, &dubResp); err != nil {
		log.Printf("[DubShortener] erro ao decodificar resposta Dub: %v (usando fallback)", err)
		return "", err
	}

	if dubResp.ShortLink != "" {
		return dubResp.ShortLink, nil
	}

	return "", fmt.Errorf("shortLink vazio")
}

