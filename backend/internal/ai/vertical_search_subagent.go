package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// VerticalSearchSubagent encapsula busca factual isolada via SearXNG ou Gemini Grounding com fallback para RSS.
type VerticalSearchSubagent struct {
	searxng    *SearXNGClient
	geminiProv *GeminiProvider
	apiKey     string
	model      string
	baseURL    string
	httpClient *http.Client
}

// NewVerticalSearchSubagent cria um novo subagente de busca factual.
func NewVerticalSearchSubagent(searxng *SearXNGClient, geminiProv *GeminiProvider) *VerticalSearchSubagent {
	return &VerticalSearchSubagent{
		searxng:    searxng,
		geminiProv: geminiProv,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

// SetGeminiConfig permite configurar as credenciais do Google AI Studio para Grounding.
func (s *VerticalSearchSubagent) SetGeminiConfig(apiKey, model, baseURL string) {
	s.apiKey = apiKey
	s.model = model
	s.baseURL = baseURL
}

// Search executa a busca factual isolada retornando fontes verificadas e um resumo factual.
func (s *VerticalSearchSubagent) Search(ctx context.Context, query, category string) ([]domain.SearchSource, string, error) {
	cleanQuery := strings.TrimSpace(query)
	if cleanQuery == "" {
		return nil, "", fmt.Errorf("termo de pesquisa não pode ser vazio")
	}

	cat := strings.TrimSpace(category)
	if cat == "" {
		cat = "general"
	}

	// 1. Tentar SearXNG se disponível
	sClient := s.searxng
	if sClient == nil {
		sClient = DefaultSearXNGClient()
	}

	if sClient != nil {
		opts := SearXNGQueryOptions{
			Category:  cat,
			Language:  "pt-BR",
			TimeRange: "month",
		}
		results, err := sClient.Search(ctx, cleanQuery, opts)
		if err == nil && len(results) > 0 {
			var sources []domain.SearchSource
			var snippets []string
			for _, r := range results {
				sources = append(sources, domain.SearchSource{
					Title:   r.Title,
					URL:     r.URL,
					Snippet: r.Content,
				})
				if len(snippets) < 3 && r.Content != "" {
					snippets = append(snippets, fmt.Sprintf("- %s: %s", r.Title, r.Content))
				}
			}
			summary := fmt.Sprintf("Informações apuradas via SearXNG (%s) para %q:\n%s", cat, cleanQuery, strings.Join(snippets, "\n"))
			return sources, summary, nil
		}
	}

	// 2. Tentar Gemini Grounding se configurado
	if s.geminiProv != nil || s.apiKey != "" {
		sources, summary, err := s.searchViaGeminiGrounding(ctx, cleanQuery)
		if err == nil && len(sources) > 0 {
			return sources, summary, nil
		}
	}

	// 3. Fallback: Google News RSS
	newsItems, err := FetchGoogleNews(ctx, cleanQuery, 5, s.httpClient)
	if err == nil && len(newsItems) > 0 {
		var sources []domain.SearchSource
		var bullets []string
		for _, item := range newsItems {
			sources = append(sources, domain.SearchSource{
				Title:   item.Title,
				URL:     item.Link,
				Snippet: item.Source,
			})
			if len(bullets) < 3 {
				bullets = append(bullets, fmt.Sprintf("- %s (%s)", item.Title, item.Source))
			}
		}
		summary := fmt.Sprintf("Notícias factuais recentes encontradas para %q:\n%s", cleanQuery, strings.Join(bullets, "\n"))
		return sources, summary, nil
	}

	return nil, "", fmt.Errorf("nenhum resultado factual encontrado para %q", cleanQuery)
}

func (s *VerticalSearchSubagent) searchViaGeminiGrounding(ctx context.Context, query string) ([]domain.SearchSource, string, error) {
	apiKey := s.apiKey
	model := s.model
	baseURL := s.baseURL
	if s.geminiProv != nil {
		if apiKey == "" {
			apiKey = s.geminiProv.apiKey
		}
		if model == "" {
			model = s.geminiProv.model
		}
		if baseURL == "" {
			baseURL = s.geminiProv.baseURL
		}
	}
	if baseURL == "" {
		baseURL = "https://generativelanguage.googleapis.com"
	}
	if model == "" {
		model = "gemini-2.5-flash"
	}
	if apiKey == "" {
		return nil, "", fmt.Errorf("chave de api do gemini não fornecida")
	}

	prompt := fmt.Sprintf("Pesquise dados reais e atualizados na web brasileira sobre: %s. Resuma os fatos em 2 a 3 frases objetivas.", query)
	reqBody := geminiRequest{
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: prompt}}},
		},
		Tools: []geminiTool{
			{GoogleSearch: &geminiGoogleSearch{}},
		},
	}
	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, "", err
	}

	reqURL := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", baseURL, model, apiKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBytes, _ := io.ReadAll(resp.Body)
		return nil, "", fmt.Errorf("gemini grounding error %d: %s", resp.StatusCode, string(respBytes))
	}

	var gResp geminiResponse
	if err := json.NewDecoder(resp.Body).Decode(&gResp); err != nil {
		return nil, "", err
	}

	if len(gResp.Candidates) == 0 {
		return nil, "", fmt.Errorf("nenhum candidato retornado pelo grounding")
	}

	cand := gResp.Candidates[0]
	var text string
	if len(cand.Content.Parts) > 0 {
		text = strings.TrimSpace(cand.Content.Parts[0].Text)
	}

	var sources []domain.SearchSource
	if cand.GroundingMetadata != nil {
		for _, chunk := range cand.GroundingMetadata.GroundingChunks {
			if chunk.Web.URI != "" {
				sources = append(sources, domain.SearchSource{
					Title:   chunk.Web.Title,
					URL:     chunk.Web.URI,
					Snippet: "Google Search Grounding",
				})
			}
		}
	}

	if len(sources) == 0 {
		sources = append(sources, domain.SearchSource{
			Title:   "Google Search",
			URL:     "https://www.google.com/search?q=" + query,
			Snippet: text,
		})
	}

	return sources, text, nil
}
