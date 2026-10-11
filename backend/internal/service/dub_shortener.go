package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"time"
)

// DubShortenerService gerencia a geração de links encurtados via Dub.co
// com fallback resiliente para a URL canônica do próprio Vito.
type DubShortenerService struct {
	apiKey        string
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

// ShortenLink tenta encurtar via Dub.co; se não houver chave ou em caso de erro,
// faz fallback gracioso para a targetURL original.
func (s *DubShortenerService) ShortenLink(ctx context.Context, targetURL, key string) (string, error) {
	if s.apiKey == "" {
		return targetURL, nil
	}

	payload := map[string]string{
		"url": targetURL,
	}
	if key != "" {
		payload["key"] = key
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		log.Printf("[DubShortener] falha ao serializar payload: %v (usando fallback)", err)
		return targetURL, nil
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewBuffer(bodyBytes))
	if err != nil {
		log.Printf("[DubShortener] falha ao criar request: %v (usando fallback)", err)
		return targetURL, nil
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", s.apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(req)
	if err != nil {
		log.Printf("[DubShortener] erro na requisição HTTP: %v (usando fallback)", err)
		return targetURL, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		log.Printf("[DubShortener] resposta não-2xx da API Dub (%d) (usando fallback)", resp.StatusCode)
		return targetURL, nil
	}

	var dubResp struct {
		ShortLink string `json:"shortLink"`
		URL       string `json:"url"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&dubResp); err != nil {
		log.Printf("[DubShortener] erro ao decodificar resposta Dub: %v (usando fallback)", err)
		return targetURL, nil
	}

	if dubResp.ShortLink != "" {
		return dubResp.ShortLink, nil
	}

	return targetURL, nil
}
