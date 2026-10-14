package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// TriggerDataPoint é um fato apurado por um conector especializado (§9.2).
type TriggerDataPoint struct {
	Title       string
	Source      string
	Link        string
	PublishedAt time.Time
	Value       string
}

// TriggerDataSource busca dados reais por categoria (finance, weather, ...).
type TriggerDataSource interface {
	Name() string
	Supports(t *domain.Trigger) bool
	Fetch(ctx context.Context, t *domain.Trigger) ([]TriggerDataPoint, error)
}

// GoogleNewsSource: conector padrão (todas as categorias).
type GoogleNewsSource struct{}

func (s *GoogleNewsSource) Name() string { return "google_news" }

func (s *GoogleNewsSource) Supports(t *domain.Trigger) bool { return true }

// NewsQueryFor anexa when:1h para frequências quente/imediata (§9.4).
func NewsQueryFor(t *domain.Trigger) string {
	q := t.Query
	if q == "" {
		q = t.Title
	}
	if t.Frequency == domain.FrequencyImmediate || t.Frequency == domain.FrequencyHourly {
		q += " when:1h"
	}
	return q
}

// HashDataPoint identifica o fato para o delta gate (§9.3).
func HashDataPoint(p TriggerDataPoint) string {
	sum := sha256.Sum256([]byte(p.Link + "|" + p.Title + "|" + p.Value))
	return hex.EncodeToString(sum[:])
}

func (s *GoogleNewsSource) Fetch(ctx context.Context, t *domain.Trigger) ([]TriggerDataPoint, error) {
	items, err := FetchGoogleNews(ctx, NewsQueryFor(t), 8)
	if err != nil {
		return nil, err
	}
	out := make([]TriggerDataPoint, 0, len(items))
	for _, it := range items {
		out = append(out, TriggerDataPoint{
			Title: it.Title, Source: it.Source, Link: it.Link,
			PublishedAt: it.PublishedAt,
		})
	}
	return out, nil
}

// FinanceSource: cotações reais via AwesomeAPI (grátis, sem key) para pares
// detectados no texto (USD/BRL, EUR/BRL, BTC/BRL...).
type FinanceSource struct {
	Client *http.Client
}

func (s *FinanceSource) Name() string { return "finance" }

func (s *FinanceSource) Supports(t *domain.Trigger) bool {
	return t.Category == domain.CategoryFinance
}

var currencyPairRe = regexp.MustCompile(`(?i)\b(USD|EUR|BTC|ETH|GBP|JPY|ARS|BRL)\b`)

func (s *FinanceSource) Fetch(ctx context.Context, t *domain.Trigger) ([]TriggerDataPoint, error) {
	found := map[string]bool{}
	for _, m := range currencyPairRe.FindAllString(strings.ToUpper(t.Query+" "+t.Title), -1) {
		if m != "BRL" {
			found[m+"-BRL"] = true
		}
	}
	if len(found) == 0 {
		found["USD-BRL"] = true
	}
	pairs := make([]string, 0, len(found))
	for p := range found {
		pairs = append(pairs, p)
	}

	client := s.Client
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	reqURL := "https://economia.awesomeapi.com.br/json/last/" + strings.Join(pairs, ",")
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, err
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("awesomeapi status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var decoded map[string]struct {
		Code      string `json:"code"`
		Codein    string `json:"codein"`
		Name      string `json:"name"`
		Bid       string `json:"bid"`
		Timestamp string `json:"timestamp"`
	}
	if err := json.Unmarshal(body, &decoded); err != nil {
		return nil, err
	}
	var out []TriggerDataPoint
	for _, q := range decoded {
		out = append(out, TriggerDataPoint{
			Title:       fmt.Sprintf("%s: R$ %s", q.Name, q.Bid),
			Source:      "AwesomeAPI",
			Value:       q.Bid,
			PublishedAt: time.Now(),
		})
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("sem cotações utilizáveis")
	}
	return out, nil
}

// WeatherSource: clima real via Open-Meteo (grátis, sem key).
// Cidade extraída de "em <Cidade>" ou São Paulo como fallback documentado.
type WeatherSource struct {
	Client *http.Client
}

func (s *WeatherSource) Name() string { return "weather" }

func (s *WeatherSource) Supports(t *domain.Trigger) bool {
	return t.Category == domain.CategoryWeather
}

var cityRe = regexp.MustCompile(`\b(?i:em)\s+([A-ZÀ-Þ][a-zà-ÿ]+(?:\s+[A-ZÀ-Þ][a-zà-ÿ]+){0,2})`)

func weatherCity(t *domain.Trigger) string {
	if m := cityRe.FindStringSubmatch(t.Query + " " + t.Title); m != nil {
		return strings.TrimSpace(m[1])
	}
	return "São Paulo"
}

func (s *WeatherSource) Fetch(ctx context.Context, t *domain.Trigger) ([]TriggerDataPoint, error) {
	client := s.Client
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}
	city := weatherCity(t)

	geoURL := "https://geocoding-api.open-meteo.com/v1/search?name=" + url.QueryEscape(city) + "&count=1&language=pt&format=json"
	geoReq, err := http.NewRequestWithContext(ctx, http.MethodGet, geoURL, nil)
	if err != nil {
		return nil, err
	}
	geoResp, err := client.Do(geoReq)
	if err != nil {
		return nil, err
	}
	defer geoResp.Body.Close()
	geoBody, err := io.ReadAll(geoResp.Body)
	if err != nil {
		return nil, err
	}
	var geo struct {
		Results []struct {
			Latitude  float64 `json:"latitude"`
			Longitude float64 `json:"longitude"`
			Name      string  `json:"name"`
		} `json:"results"`
	}
	if err := json.Unmarshal(geoBody, &geo); err != nil || len(geo.Results) == 0 {
		return nil, fmt.Errorf("cidade não localizada: %s", city)
	}
	loc := geo.Results[0]

	fcURL := fmt.Sprintf("https://api.open-meteo.com/v1/forecast?latitude=%f&longitude=%f&current=temperature_2m,relative_humidity_2m,precipitation,weather_code&timezone=auto",
		loc.Latitude, loc.Longitude)
	fcReq, err := http.NewRequestWithContext(ctx, http.MethodGet, fcURL, nil)
	if err != nil {
		return nil, err
	}
	fcResp, err := client.Do(fcReq)
	if err != nil {
		return nil, err
	}
	defer fcResp.Body.Close()
	fcBody, err := io.ReadAll(fcResp.Body)
	if err != nil {
		return nil, err
	}
	var fc struct {
		Current struct {
			Temperature float64 `json:"temperature_2m"`
			Humidity    int     `json:"relative_humidity_2m"`
			Precip      float64 `json:"precipitation"`
		} `json:"current"`
	}
	if err := json.Unmarshal(fcBody, &fc); err != nil {
		return nil, err
	}
	return []TriggerDataPoint{{
		Title:       fmt.Sprintf("%s: %.1f°C, umidade %d%%, chuva %.1fmm", loc.Name, fc.Current.Temperature, fc.Current.Humidity, fc.Current.Precip),
		Source:      "Open-Meteo",
		Value:       fmt.Sprintf("%.1f", fc.Current.Temperature),
		PublishedAt: time.Now(),
	}}, nil
}

// RouteTriggerSource escolhe o conector especializado ou o padrão (§9.2).
func RouteTriggerSource(t *domain.Trigger) TriggerDataSource {
	fin := &FinanceSource{}
	if fin.Supports(t) {
		return fin
	}
	w := &WeatherSource{}
	if w.Supports(t) {
		return w
	}
	return &GoogleNewsSource{}
}
