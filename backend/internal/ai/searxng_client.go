package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// SearXNGQueryOptions configura parâmetros adicionais de busca.
type SearXNGQueryOptions struct {
	Category  string   // "general", "news", "shopping", "science", "it"
	TimeRange string   // "day", "week", "month", "year"
	Language  string   // "pt-BR", "en-US", etc.
	Engines   []string // Lista de engines específicas
}

// SearXNGResult representa um resultado de busca devolvido pelo SearXNG.
type SearXNGResult struct {
	Title         string     `json:"title"`
	URL           string     `json:"url"`
	Content       string     `json:"content"`
	Engine        string     `json:"engine"`
	PublishedDate *time.Time `json:"publishedDate,omitempty"`
	Score         float64    `json:"score,omitempty"`
}

type searXNGRawResult struct {
	Title         string  `json:"title"`
	URL           string  `json:"url"`
	Content       string  `json:"content"`
	Engine        string  `json:"engine"`
	PublishedDate string  `json:"publishedDate"`
	Score         float64 `json:"score"`
}

type searXNGSearchResponse struct {
	Query           string             `json:"query"`
	NumberOfResults int                `json:"number_of_results"`
	Results         []searXNGRawResult `json:"results"`
}

// SearXNGClient realiza consultas ao metabuscador SearXNG.
type SearXNGClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewSearXNGClient instancia o cliente SearXNG.
func NewSearXNGClient(baseURL string, customClient ...*http.Client) *SearXNGClient {
	cleanURL := strings.TrimRight(strings.TrimSpace(baseURL), "/")
	if cleanURL == "" {
		cleanURL = "http://localhost:8185"
	}

	var client *http.Client
	if len(customClient) > 0 && customClient[0] != nil {
		client = customClient[0]
	} else {
		client = &http.Client{Timeout: 8 * time.Second}
	}

	return &SearXNGClient{
		baseURL:    cleanURL,
		httpClient: client,
	}
}

// Search executa uma busca agregada no SearXNG em formato JSON.
func (c *SearXNGClient) Search(ctx context.Context, query string, opts ...SearXNGQueryOptions) ([]SearXNGResult, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return nil, errors.New("query de busca não pode ser vazia")
	}

	params := url.Values{}
	params.Set("q", q)
	params.Set("format", "json")

	opt := SearXNGQueryOptions{
		Language: "pt-BR",
	}
	if len(opts) > 0 {
		opt = opts[0]
	}

	if opt.Language != "" {
		params.Set("language", opt.Language)
	}
	if opt.Category != "" {
		params.Set("categories", opt.Category)
	}
	if opt.TimeRange != "" {
		params.Set("time_range", opt.TimeRange)
	}
	if len(opt.Engines) > 0 {
		params.Set("engines", strings.Join(opt.Engines, ","))
	}

	reqURL := fmt.Sprintf("%s/search?%s", c.baseURL, params.Encode())
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("falha ao criar requisição SearXNG: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "VitoRadarBot/2.0")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("falha ao consultar SearXNG: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("SearXNG retornou status HTTP %d: %s", resp.StatusCode, string(body))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("falha ao ler resposta do SearXNG: %w", err)
	}

	var rawResp searXNGSearchResponse
	if err := json.Unmarshal(bodyBytes, &rawResp); err != nil {
		return nil, fmt.Errorf("falha ao deserializar JSON do SearXNG: %w", err)
	}

	results := make([]SearXNGResult, 0, len(rawResp.Results))
	for _, r := range rawResp.Results {
		item := SearXNGResult{
			Title:   strings.TrimSpace(r.Title),
			URL:     strings.TrimSpace(r.URL),
			Content: strings.TrimSpace(r.Content),
			Engine:  strings.TrimSpace(r.Engine),
			Score:   r.Score,
		}

		if r.PublishedDate != "" {
			if t, err := time.Parse(time.RFC3339, r.PublishedDate); err == nil {
				item.PublishedDate = &t
			} else if t, err := time.Parse("2006-01-02 15:04:05", r.PublishedDate); err == nil {
				item.PublishedDate = &t
			}
		}

		results = append(results, item)
	}

	return results, nil
}
