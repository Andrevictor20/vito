package ai

import (
	"context"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

var (
	closedJobPhrases = []string{
		"vaga encerrada", "inscrições encerradas", "no longer accepting",
		"processo seletivo encerrado", "oportunidade expirada",
	}

	cursinhoKeywords = []string{
		"gran cursos", "estrategia concursos", "estratégia concursos",
		"direcao concursos", "direção concursos", "folha dirigida",
		"nova concursos", "alfacon", "pode sair", "veja o que estudar",
		"o que cai", "preparatório", "simulado",
	}
)

// JobsCollector monitora oportunidades ativas de emprego em plataformas ATS.
type JobsCollector struct {
	SearXNG *SearXNGClient
}

func (c *JobsCollector) Name() string { return "jobs_collector" }

func (c *JobsCollector) Supports(t *domain.Trigger) bool {
	return t.Category == domain.CategoryCareer || strings.Contains(strings.ToLower(t.Title+" "+t.Query), "vaga")
}

func (c *JobsCollector) Fetch(ctx context.Context, t *domain.Trigger) ([]TriggerDataPoint, error) {
	if c.SearXNG == nil {
		return nil, fmt.Errorf("SearXNG não disponível para coletar vagas")
	}

	plan := BuildTriggerSearchPlan(t.Title, t.Query, domain.CategoryCareer)
	var allResults []SearXNGResult

	for _, q := range plan.Queries {
		results, err := c.SearXNG.Search(ctx, q, SearXNGQueryOptions{
			TimeRange: "week",
			Language:  "pt-BR",
		})
		if err == nil && len(results) > 0 {
			allResults = append(allResults, results...)
		}
	}

	valid := filterActiveJobResults(allResults)
	if len(valid) == 0 {
		return nil, fmt.Errorf("nenhuma vaga ativa localizada para %q", t.Title)
	}

	var points []TriggerDataPoint
	for _, it := range valid {
		pubTime := time.Now()
		if it.PublishedDate != nil {
			pubTime = *it.PublishedDate
		}
		points = append(points, TriggerDataPoint{
			Title:       it.Title,
			Source:      "Vagas / " + it.Engine,
			Link:        it.URL,
			PublishedAt: pubTime,
		})
	}

	return points, nil
}

func filterActiveJobResults(results []SearXNGResult) []SearXNGResult {
	var valid []SearXNGResult
	for _, it := range results {
		lower := strings.ToLower(it.Title + " " + it.Content)
		isClosed := false
		for _, phrase := range closedJobPhrases {
			if strings.Contains(lower, phrase) {
				isClosed = true
				break
			}
		}
		if !isClosed {
			valid = append(valid, it)
		}
	}
	return valid
}

// TenderCollector monitora concursos públicos oficiais eliminando cursinhos.
type TenderCollector struct {
	Client  *http.Client
	SearXNG *SearXNGClient
}

func (c *TenderCollector) Name() string { return "tender_collector" }

func (c *TenderCollector) Supports(t *domain.Trigger) bool {
	return t.Category == domain.CategoryPublicExams || strings.Contains(strings.ToLower(t.Title+" "+t.Query), "concurso")
}

func (c *TenderCollector) Fetch(ctx context.Context, t *domain.Trigger) ([]TriggerDataPoint, error) {
	client := c.Client
	if client == nil {
		client = &http.Client{Timeout: 8 * time.Second}
	}

	var allPoints []TriggerDataPoint

	// 1. Ingestão PCI Concursos RSS
	if pciPoints, err := c.fetchPCIConcursos(ctx, client); err == nil && len(pciPoints) > 0 {
		cleanQ := strings.ToLower(CleanSearchQuery(t.Query, string(t.Category)))
		for _, pt := range pciPoints {
			if cleanQ == "" || strings.Contains(strings.ToLower(pt.Title), cleanQ) {
				allPoints = append(allPoints, pt)
			}
		}
	}

	// 2. Consulta SearXNG no DOU e bancas
	if c.SearXNG != nil {
		results, err := c.SearXNG.Search(ctx, fmt.Sprintf("site:in.gov.br \"edital\" %s", t.Query), SearXNGQueryOptions{
			TimeRange: "week",
			Language:  "pt-BR",
		})
		if err == nil {
			for _, r := range results {
				allPoints = append(allPoints, TriggerDataPoint{
					Title:       r.Title,
					Source:      "Diário Oficial da União",
					Link:        r.URL,
					PublishedAt: time.Now(),
				})
			}
		}
	}

	filtered := filterOfficialTenderPoints(allPoints)
	if len(filtered) == 0 {
		return nil, fmt.Errorf("nenhum edital ou concurso oficial confirmado para %q", t.Title)
	}

	return filtered, nil
}

func (c *TenderCollector) fetchPCIConcursos(ctx context.Context, client *http.Client) ([]TriggerDataPoint, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "https://www.pciconcursos.com.br/noticias/rss.xml", nil)
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
		return nil, fmt.Errorf("pci status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var feed rssRoot
	if err := xml.Unmarshal(body, &feed); err != nil {
		return nil, err
	}

	var points []TriggerDataPoint
	for _, it := range feed.Channel.Items {
		points = append(points, TriggerDataPoint{
			Title:       it.Title,
			Source:      "PCI Concursos",
			Link:        it.Link,
			PublishedAt: time.Now(),
		})
	}
	return points, nil
}

func filterOfficialTenderPoints(points []TriggerDataPoint) []TriggerDataPoint {
	var valid []TriggerDataPoint
	for _, pt := range points {
		lower := strings.ToLower(pt.Title + " " + pt.Source)
		isCursinho := false
		for _, kw := range cursinhoKeywords {
			if strings.Contains(lower, kw) {
				isCursinho = true
				break
			}
		}
		if !isCursinho {
			valid = append(valid, pt)
		}
	}
	return valid
}

// NewsCollector busca notícias recentes via SearXNG News com Freshness Gate rígido.
type NewsCollector struct {
	SearXNG *SearXNGClient
}

func (c *NewsCollector) Name() string { return "news_collector" }

func (c *NewsCollector) Supports(t *domain.Trigger) bool { return true }

func (c *NewsCollector) Fetch(ctx context.Context, t *domain.Trigger) ([]TriggerDataPoint, error) {
	if c.SearXNG != nil {
		results, err := c.SearXNG.Search(ctx, t.Query, SearXNGQueryOptions{
			Category:  "news",
			TimeRange: "day",
			Language:  "pt-BR",
		})
		if err == nil && len(results) > 0 {
			var points []TriggerDataPoint
			now := time.Now()
			for _, r := range results {
				if r.PublishedDate != nil && now.Sub(*r.PublishedDate) > 24*time.Hour {
					continue // Freshness Gate
				}
				points = append(points, TriggerDataPoint{
					Title:       r.Title,
					Source:      "SearXNG (" + r.Engine + ")",
					Link:        r.URL,
					PublishedAt: now,
				})
			}
			if len(points) > 0 {
				return points, nil
			}
		}
	}

	// Fallback para GoogleNewsSource
	fallback := &GoogleNewsSource{}
	return fallback.Fetch(ctx, t)
}
