package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

var (
	regexJSONLDScript = regexp.MustCompile(`(?is)<script[^>]*type=["']application/ld\+json["'][^>]*>(.*?)</script>`)
	accessoryKeywords = []string{
		"capa", "capinha", "película", "pelicula", "case", "suporte",
		"carregador", "cabo", "peça", "peças", "usado", "defeito", "caixa vazia",
	}
)

// ShoppingCollector pesquisa preços reais de e-commerce e filtra acessórios/usados.
type ShoppingCollector struct {
	Client     *http.Client
	MLBBaseURL string
	SearXNG    *SearXNGClient
}

func (c *ShoppingCollector) Name() string { return "shopping_collector" }

func (c *ShoppingCollector) Supports(t *domain.Trigger) bool {
	return t.Category == domain.CategoryShopping || IsShoppingOrPriceQuery(t.Query, t.Title, string(t.Category))
}

func (c *ShoppingCollector) Fetch(ctx context.Context, t *domain.Trigger) ([]TriggerDataPoint, error) {
	client := c.Client
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}

	searchQuery := CleanSearchQuery(t.Query, string(t.Category))
	if searchQuery == "" {
		searchQuery = CleanSearchQuery(t.Title, string(t.Category))
	}

	var allPoints []TriggerDataPoint

	// 1. Consulta API oficial Mercado Livre
	mlPoints, errML := c.fetchMercadoLivre(ctx, client, searchQuery)
	if errML == nil && len(mlPoints) > 0 {
		allPoints = append(allPoints, mlPoints...)
	}

	// 2. Consulta SearXNG shopping se configurado
	if c.SearXNG != nil {
		results, errS := c.SearXNG.Search(ctx, searchQuery, SearXNGQueryOptions{
			Category:  "shopping",
			TimeRange: "day",
			Language:  "pt-BR",
		})
		if errS == nil {
			for _, r := range results {
				if isAccessoryTitle(r.Title) {
					continue
				}
				allPoints = append(allPoints, TriggerDataPoint{
					Title:       r.Title,
					Source:      "SearXNG Shopping (" + r.Engine + ")",
					Link:        r.URL,
					PublishedAt: time.Now(),
				})
			}
		}
	}

	if len(allPoints) == 0 {
		return nil, fmt.Errorf("nenhum produto em estoque encontrado para %q", searchQuery)
	}

	return allPoints, nil
}

func (c *ShoppingCollector) fetchMercadoLivre(ctx context.Context, client *http.Client, query string) ([]TriggerDataPoint, error) {
	baseURL := c.MLBBaseURL
	if baseURL == "" {
		baseURL = "https://api.mercadolibre.com"
	}

	reqURL := fmt.Sprintf("%s/sites/MLB/search?q=%s&condition=new&sort=price_asc&limit=5", baseURL, url.QueryEscape(query))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "VitoRadarBot/2.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("mercadolivre api status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var mlResp struct {
		Results []struct {
			ID        string  `json:"id"`
			Title     string  `json:"title"`
			Price     float64 `json:"price"`
			Permalink string  `json:"permalink"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &mlResp); err != nil {
		return nil, err
	}

	var points []TriggerDataPoint
	for _, it := range mlResp.Results {
		if isAccessoryTitle(it.Title) {
			continue
		}
		if it.Price <= 0 {
			continue
		}

		points = append(points, TriggerDataPoint{
			Title:       it.Title,
			Source:      "Mercado Livre",
			Link:        it.Permalink,
			Value:       fmt.Sprintf("%.2f", it.Price),
			PublishedAt: time.Now(),
		})
	}

	return points, nil
}

func isAccessoryTitle(title string) bool {
	lower := strings.ToLower(title)
	for _, kw := range accessoryKeywords {
		if strings.Contains(lower, kw) {
			return true
		}
	}
	return false
}

func extractJSONLDProduct(htmlContent string) (price float64, productName string, ok bool) {
	matches := regexJSONLDScript.FindAllStringSubmatch(htmlContent, -1)
	for _, m := range matches {
		if len(m) < 2 {
			continue
		}
		jsonStr := strings.TrimSpace(m[1])
		var raw map[string]interface{}
		if err := json.Unmarshal([]byte(jsonStr), &raw); err != nil {
			continue
		}

		typeVal, _ := raw["@type"].(string)
		if !strings.EqualFold(typeVal, "Product") {
			continue
		}

		productName, _ = raw["name"].(string)
		if offers, hasOffers := raw["offers"].(map[string]interface{}); hasOffers {
			if pVal, exists := offers["price"]; exists {
				switch v := pVal.(type) {
				case float64:
					price = v
					return price, productName, true
				case string:
					clean := strings.ReplaceAll(v, "R$", "")
					clean = strings.TrimSpace(strings.ReplaceAll(clean, ",", "."))
					if parsed, errP := strconv.ParseFloat(clean, 64); errP == nil {
						price = parsed
						return price, productName, true
					}
				}
			}
		}
	}
	return 0, "", false
}
