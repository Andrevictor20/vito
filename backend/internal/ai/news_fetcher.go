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
	} else {
		if sanitized := CleanSearchQuery(cleanQuery, ""); sanitized != "" {
			cleanQuery = sanitized
		}
	}

	searchURL := fmt.Sprintf("https://news.google.com/rss/search?q=%s&hl=pt-BR&gl=BR&ceid=BR:pt-419", url.QueryEscape(cleanQuery))

	var client *http.Client
	if len(customClient) > 0 && customClient[0] != nil {
		client = customClient[0]
	} else {
		client = &http.Client{Timeout: 12 * time.Second}
	}

	// Bug §8.7/11: retry com backoff + validação de conteúdo não-vazio.
	var items []NewsItem
	var err error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 {
			select {
			case <-ctx.Done():
				return nil, ctx.Err()
			case <-time.After(time.Duration(attempt) * 500 * time.Millisecond):
			}
		}
		items, err = fetchGoogleNewsFromURL(ctx, searchURL, client, maxResults, time.Now())
		if err == nil && len(items) > 0 {
			return items, nil
		}
		if err == nil {
			err = fmt.Errorf("feed RSS sem notícias utilizáveis para %q", cleanQuery)
		}
	}
	return nil, fmt.Errorf("falha ao coletar notícias após 3 tentativas: %w", err)
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

		// Filtra fontes espúrias conhecidas de afiliados e caça-cliques
		if IsSpuriousNewsSource(source, title) {
			continue
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

// Portais de afiliados caça-cliques, concursos públicos ou agregadores espúrios
// que publicam matérias com falsas ofertas de celulares e eletrônicos.
var spuriousNewsSources = []string{
	"jc concursos",
	"ciclovivo",
	"distrito online",
	"edital concursos brasil",
	"notícias concursos",
	"noticias concursos",
	"catraca livre",
	"mix vale",
	"pronatec",
	"fdr",
	"bons investimentos",
	"remessa conforme",
	"folha financeira",
	"monitordomercado",
	"click petroleo",
}

// IsSpuriousNewsSource detecta se o portal é um site caça-cliques de afiliados/concursos.
func IsSpuriousNewsSource(source, title string) bool {
	s := strings.ToLower(strings.TrimSpace(source))
	t := strings.ToLower(strings.TrimSpace(title))
	for _, spurious := range spuriousNewsSources {
		if strings.Contains(s, spurious) || strings.Contains(t, spurious) {
			return true
		}
	}
	return false
}

// Portais de tecnologia, comparadores e e-commerces certificados para consultas de preço.
var trustedTechShoppingSources = []string{
	"tudocelular",
	"techtudo",
	"canaltech",
	"tecmundo",
	"oficina da net",
	"zoom",
	"buscapé",
	"buscape",
	"adrenaline",
	"macmagazine",
	"olhar digital",
	"gizmodo",
	"mercado livre",
	"amazon",
	"kabum",
	"magalu",
	"magazine luiza",
	"shopee",
	"casas bahia",
	"pichau",
	"terabyte",
	"fast shop",
	"pelando",
	"promobit",
}

// IsTrustedShoppingSource valida se a fonte é um comparador, loja ou portal técnico de hardware/eletrônicos.
func IsTrustedShoppingSource(source string) bool {
	s := strings.ToLower(strings.TrimSpace(source))
	for _, trusted := range trustedTechShoppingSources {
		if strings.Contains(s, trusted) {
			return true
		}
	}
	return false
}

var shoppingKeywords = []string{
	"preço", "preco", "comprar", "oferta", "promoção", "promocao",
	"desconto", "valor", "smartphone", "celular", "iphone", "poco",
	"pocophone", "xiaomi", "galaxy", "motorola", "notebook", "tv", "fone",
}

// IsShoppingOrPriceQuery identifica se a consulta é de produto, preço ou compras.
func IsShoppingOrPriceQuery(query, title, category string) bool {
	if strings.EqualFold(category, "shopping") {
		return true
	}
	combined := strings.ToLower(query + " " + title)
	for _, kw := range shoppingKeywords {
		if strings.Contains(combined, kw) {
			return true
		}
	}
	return false
}

// FilterShoppingNews garante que, para produtos e compras, apenas fontes técnicas ou de e-commerce sejam aceitas.
func FilterShoppingNews(items []NewsItem, isShopping bool) []NewsItem {
	if !isShopping || len(items) == 0 {
		return items
	}
	var filtered []NewsItem
	for _, it := range items {
		if IsTrustedShoppingSource(it.Source) {
			filtered = append(filtered, it)
		}
	}
	return filtered
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
