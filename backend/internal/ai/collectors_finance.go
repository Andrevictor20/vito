package ai

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// FinanceCollector é o coletor especializado em ativos da B3, moedas globais e cripto.
type FinanceCollector struct {
	Client       *http.Client
	BrapiBaseURL string
	BrapiToken   string
}

func (c *FinanceCollector) Name() string { return "finance" }

func (c *FinanceCollector) Supports(t *domain.Trigger) bool {
	if t.Category == domain.CategoryFinance {
		return true
	}
	text := strings.ToUpper(t.Title + " " + t.Query)
	return regexTicker.MatchString(text) || currencyPairRe.MatchString(text)
}

func (c *FinanceCollector) Fetch(ctx context.Context, t *domain.Trigger) ([]TriggerDataPoint, error) {
	client := c.Client
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}

	text := strings.ToUpper(t.Title + " " + t.Query)

	// 1. Ações, FIIs e ETFs da B3 (ex: PETR4, VALE3, IVVB11)
	if m := regexTicker.FindStringSubmatch(text); len(m) > 1 {
		ticker := m[1]
		points, err := c.fetchBrapiQuote(ctx, client, ticker)
		if err == nil && len(points) > 0 {
			return points, nil
		}
		// Fallback para Yahoo Finance Chart API
		pointsYahoo, errYahoo := c.fetchYahooQuote(ctx, client, ticker+".SA")
		if errYahoo == nil && len(pointsYahoo) > 0 {
			return pointsYahoo, nil
		}
	}

	// 2. Moedas e Câmbio via AwesomeAPI
	awesomeSource := &FinanceSource{Client: client}
	if awesomeSource.Supports(t) {
		return awesomeSource.Fetch(ctx, t)
	}

	return nil, fmt.Errorf("nenhum ativo financeiro identificado para %q", t.Title)
}

func (c *FinanceCollector) fetchBrapiQuote(ctx context.Context, client *http.Client, ticker string) ([]TriggerDataPoint, error) {
	baseURL := c.BrapiBaseURL
	if baseURL == "" {
		baseURL = "https://brapi.dev"
	}
	token := c.BrapiToken
	if token == "" {
		token = os.Getenv("BRAPI_TOKEN")
	}

	reqURL := fmt.Sprintf("%s/api/quote/%s?range=1d&interval=1d", baseURL, ticker)
	if token != "" {
		reqURL += "&token=" + token
	}

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
		return nil, fmt.Errorf("brapi status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var brapiResp struct {
		Results []struct {
			Symbol                     string  `json:"symbol"`
			ShortName                  string  `json:"shortName"`
			RegularMarketPrice         float64 `json:"regularMarketPrice"`
			RegularMarketChangePercent float64 `json:"regularMarketChangePercent"`
			RegularMarketDayHigh       float64 `json:"regularMarketDayHigh"`
			RegularMarketDayLow        float64 `json:"regularMarketDayLow"`
			RegularMarketTime          string  `json:"regularMarketTime"`
		} `json:"results"`
	}

	if err := json.Unmarshal(body, &brapiResp); err != nil || len(brapiResp.Results) == 0 {
		return nil, fmt.Errorf("resposta vazia ou inválida da brapi")
	}

	res := brapiResp.Results[0]
	pubTime := time.Now()
	if res.RegularMarketTime != "" {
		if pt, err := time.Parse(time.RFC3339, res.RegularMarketTime); err == nil {
			pubTime = pt
		}
	}

	title := fmt.Sprintf("%s (%s): R$ %.2f (%.2f%%)", res.ShortName, res.Symbol, res.RegularMarketPrice, res.RegularMarketChangePercent)
	return []TriggerDataPoint{
		{
			Title:       title,
			Source:      "Brapi (B3)",
			Link:        fmt.Sprintf("https://brapi.dev/quote/%s", res.Symbol),
			Value:       fmt.Sprintf("%.2f", res.RegularMarketPrice),
			PublishedAt: pubTime,
		},
	}, nil
}

func (c *FinanceCollector) fetchYahooQuote(ctx context.Context, client *http.Client, symbol string) ([]TriggerDataPoint, error) {
	reqURL := fmt.Sprintf("https://query1.finance.yahoo.com/v8/finance/chart/%s?interval=1d&range=1d", symbol)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("yahoo status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var yResp struct {
		Chart struct {
			Result []struct {
				Meta struct {
					RegularMarketPrice float64 `json:"regularMarketPrice"`
					Symbol             string  `json:"symbol"`
				} `json:"meta"`
			} `json:"result"`
		} `json:"chart"`
	}

	if err := json.Unmarshal(body, &yResp); err != nil || len(yResp.Chart.Result) == 0 {
		return nil, fmt.Errorf("resposta inválida do yahoo finance")
	}

	meta := yResp.Chart.Result[0].Meta
	if meta.RegularMarketPrice <= 0 {
		return nil, fmt.Errorf("preço inválido do yahoo finance")
	}

	return []TriggerDataPoint{
		{
			Title:       fmt.Sprintf("%s: R$ %.2f", meta.Symbol, meta.RegularMarketPrice),
			Source:      "Yahoo Finance",
			Link:        fmt.Sprintf("https://finance.yahoo.com/quote/%s", meta.Symbol),
			Value:       fmt.Sprintf("%.2f", meta.RegularMarketPrice),
			PublishedAt: time.Now(),
		},
	}, nil
}
