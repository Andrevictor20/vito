package ai

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"
)

// NewsItem representa uma notícia factual em tempo real apurada na web.
type NewsItem struct {
	Title       string
	Source      string
	PublishedAt time.Time
	Link        string
}

type rssRoot struct {
	XMLName xml.Name `xml:"rss"`
	Channel struct {
		Items []rssItem `xml:"item"`
	} `xml:"channel"`
}

type rssItem struct {
	Title   string `xml:"title"`
	Link    string `xml:"link"`
	PubDate string `xml:"pubDate"`
	Source  struct {
		Name string `xml:",chardata"`
		URL  string `xml:"url,attr"`
	} `xml:"source"`
}

// FetchGoogleNews busca as notícias mais recentes diretamente do feed Google Notícias.
func FetchGoogleNews(ctx context.Context, query string, maxResults int, customClient ...*http.Client) ([]NewsItem, error) {
	cleanQuery := strings.TrimSpace(query)
	if cleanQuery == "" {
		cleanQuery = "tecnologia"
	}

	searchURL := fmt.Sprintf("https://news.google.com/rss/search?q=%s&hl=pt-BR&gl=BR&ceid=BR:pt-419", url.QueryEscape(cleanQuery))

	var client *http.Client
	if len(customClient) > 0 && customClient[0] != nil {
		client = customClient[0]
	} else {
		client = &http.Client{Timeout: 6 * time.Second}
	}

	return fetchGoogleNewsFromURL(ctx, searchURL, client, maxResults, time.Now())
}

func fetchGoogleNewsFromURL(ctx context.Context, targetURL string, client *http.Client, maxResults int, refDate time.Time) ([]NewsItem, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", targetURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "application/xml, text/xml, */*")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status HTTP inesperado ao buscar notícias: %d", resp.StatusCode)
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var rss rssRoot
	if err := xml.Unmarshal(bodyBytes, &rss); err != nil {
		return nil, fmt.Errorf("falha ao interpretar feed RSS de notícias: %w", err)
	}

	var items []NewsItem
	// Janela de corte estrita: no máximo 14 dias atrás em relação à data de referência
	// Impede categoricamente o vazamento de notícias de meses passados (ex: maio quando em outubro)
	cutoffTime := refDate.AddDate(0, 0, -14)

	dateLayouts := []string{
		time.RFC1123,
		time.RFC1123Z,
		"Mon, 02 Jan 2006 15:04:05 -0700",
		"02 Jan 2006 15:04:05 GMT",
		"2006-01-02T15:04:05Z",
	}

	for _, raw := range rss.Channel.Items {
		var pubTime time.Time
		pubDateStr := strings.TrimSpace(raw.PubDate)
		for _, layout := range dateLayouts {
			if t, errParse := time.Parse(layout, pubDateStr); errParse == nil {
				pubTime = t
				break
			}
		}

		if !pubTime.IsZero() && pubTime.Before(cutoffTime) {
			// Notícia antiga fora da janela recente
			continue
		}

		title := strings.TrimSpace(raw.Title)
		source := strings.TrimSpace(raw.Source.Name)

		// Google News costuma colocar " - Nome do Veículo" no final do título
		if idx := strings.LastIndex(title, " - "); idx > 0 {
			if source == "" {
				source = strings.TrimSpace(title[idx+3:])
			}
			title = strings.TrimSpace(title[:idx])
		}

		items = append(items, NewsItem{
			Title:       title,
			Source:      source,
			PublishedAt: pubTime,
			Link:        raw.Link,
		})
	}

	// Ordena por data decrescente (mais recente primeiro)
	sort.Slice(items, func(i, j int) bool {
		return items[i].PublishedAt.After(items[j].PublishedAt)
	})

	if maxResults > 0 && len(items) > maxResults {
		items = items[:maxResults]
	}

	return items, nil
}

// FormatNewsFeed formata a lista de notícias no padrão executivo de feed para a IA e o radar.
func FormatNewsFeed(items []NewsItem) string {
	if len(items) == 0 {
		return ""
	}

	var lines []string
	for _, it := range items {
		dateStr := "Recente"
		if !it.PublishedAt.IsZero() {
			dateStr = it.PublishedAt.Format("02/01")
		}
		if it.Source != "" {
			lines = append(lines, fmt.Sprintf("— %s · %s (%s)", dateStr, it.Title, it.Source))
		} else {
			lines = append(lines, fmt.Sprintf("— %s · %s", dateStr, it.Title))
		}
	}

	return strings.Join(lines, "\n")
}
