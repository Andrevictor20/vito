package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// SearchToolset implementa a Macro-Ferramenta web_and_vertical_search com coletores especializados
// e leitor web aprofundado (read_page) com fallback Jina.
type SearchToolset struct {
	subagent          *ai.VerticalSearchSubagent
	financeCollector  *ai.FinanceCollector
	shoppingCollector *ai.ShoppingCollector
	webReader         ai.WebReader
}

// NewSearchToolset instancia o toolset conectando os coletores verticais, o subagente factual e o leitor web.
func NewSearchToolset(subagent ...*ai.VerticalSearchSubagent) *SearchToolset {
	var sub *ai.VerticalSearchSubagent
	if len(subagent) > 0 && subagent[0] != nil {
		sub = subagent[0]
	} else {
		sub = ai.NewVerticalSearchSubagent(ai.DefaultSearXNGClient(), nil)
	}

	return &SearchToolset{
		subagent:          sub,
		financeCollector:  &ai.FinanceCollector{},
		shoppingCollector: &ai.ShoppingCollector{SearXNG: ai.DefaultSearXNGClient()},
		webReader:         ai.DefaultWebReader(),
	}
}

func (t *SearchToolset) SetFinanceCollector(fc *ai.FinanceCollector) {
	t.financeCollector = fc
}

func (t *SearchToolset) SetShoppingCollector(sc *ai.ShoppingCollector) {
	t.shoppingCollector = sc
}

func (t *SearchToolset) SetSubagent(sub *ai.VerticalSearchSubagent) {
	t.subagent = sub
}

func (t *SearchToolset) SetWebReader(wr ai.WebReader) {
	t.webReader = wr
}

func (t *SearchToolset) Name() domain.ToolsetName {
	return domain.ToolsetWebSearch
}

func (t *SearchToolset) Description() string {
	return "Realiza buscas factuais em tempo real na web, coletores verticais e leitura aprofundada de links/páginas web com extração de Markdown."
}

func (t *SearchToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["search", "read_page"],
				"description": "Operação: 'search' para busca factual ou 'read_page' para leitura aprofundada de URL específica."
			},
			"params": {
				"type": "object",
				"properties": {
					"query": {"type": "string", "description": "Termo de pesquisa factual na web (para operação search)."},
					"category": {
						"type": "string",
						"enum": ["general", "finance", "shopping", "news", "jobs"],
						"description": "Categoria vertical de busca."
					},
					"url": {"type": "string", "description": "URL completa da página para leitura aprofundada (para operação read_page)."}
				}
			}
		},
		"required": ["operation"]
	}`)
}

func (t *SearchToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	return false, false, nil // Busca e leitura web são operações puramente de leitura
}

func (t *SearchToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	var params struct {
		Query    string `json:"query"`
		Category string `json:"category"`
		URL      string `json:"url"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
	}

	normOp := strings.ToLower(strings.TrimSpace(op))

	// Roteamento para Leitura Aprofundada de Página (read_page)
	if normOp == "read_page" || (normOp == "search" && strings.TrimSpace(params.URL) != "" && strings.TrimSpace(params.Query) == "") {
		targetURL := strings.TrimSpace(params.URL)
		if targetURL == "" && strings.HasPrefix(strings.TrimSpace(params.Query), "http") {
			targetURL = strings.TrimSpace(params.Query)
		}
		if targetURL == "" {
			return nil, fmt.Errorf("parâmetro url é obrigatório para a operação read_page")
		}

		reader := t.webReader
		if reader == nil {
			reader = ai.DefaultWebReader()
		}

		page, err := reader.ReadURL(ctx, targetURL)
		if err != nil {
			return nil, fmt.Errorf("falha ao ler página %q: %w", targetURL, err)
		}

		snippetLen := 300
		if len(page.Markdown) < snippetLen {
			snippetLen = len(page.Markdown)
		}

		summary := fmt.Sprintf("Conteúdo completo extraído da página %q (%s) via %s:\n\n%s", page.Title, page.URL, page.Source, page.Markdown)
		sources := []domain.SearchSource{
			{
				Title:   page.Title,
				URL:     page.URL,
				Snippet: page.Markdown[:snippetLen],
			},
		}

		return &domain.ToolExecutionResult{
			Status:                "COMPLETED",
			SummaryForLLM:         summary,
			Sources:               sources,
			MarksContextAsTainted: true,
			TaintSourceLabel:      "web_read_page",
		}, nil
	}

	query := strings.TrimSpace(params.Query)
	if query == "" {
		return nil, fmt.Errorf("termo de pesquisa query é obrigatório")
	}

	cat := strings.ToLower(strings.TrimSpace(params.Category))
	if cat == "" {
		cat = "general"
	}

	var sources []domain.SearchSource
	var summary string
	var searchErr error

	// 1. Roteamento por Categoria Vertical
	switch cat {
	case "finance":
		if t.financeCollector != nil {
			trigger := &domain.Trigger{
				Title:    query,
				Query:    query,
				Category: domain.CategoryFinance,
			}
			points, err := t.financeCollector.Fetch(ctx, trigger)
			if err == nil && len(points) > 0 {
				var summaries []string
				for _, pt := range points {
					url := pt.Link
					if url == "" {
						url = "https://economia.awesomeapi.com.br"
					}
					sources = append(sources, domain.SearchSource{
						Title:   pt.Title,
						URL:     url,
						Snippet: fmt.Sprintf("%s (Valor: %s)", pt.Source, pt.Value),
					})
					summaries = append(summaries, pt.Title)
				}
				summary = fmt.Sprintf("Cotações financeiras apuradas para %q:\n- %s", query, strings.Join(summaries, "\n- "))
			} else {
				searchErr = err
			}
		}

	case "shopping":
		if t.shoppingCollector != nil {
			trigger := &domain.Trigger{
				Title:    query,
				Query:    query,
				Category: domain.CategoryShopping,
			}
			points, err := t.shoppingCollector.Fetch(ctx, trigger)
			if err == nil && len(points) > 0 {
				var summaries []string
				for _, pt := range points {
					sources = append(sources, domain.SearchSource{
						Title:   pt.Title,
						URL:     pt.Link,
						Snippet: pt.Source,
					})
					if len(summaries) < 5 {
						summaries = append(summaries, pt.Title)
					}
				}
				summary = fmt.Sprintf("Produtos e preços encontrados para %q:\n- %s", query, strings.Join(summaries, "\n- "))
			} else {
				searchErr = err
			}
		}

	case "news":
		items, err := ai.FetchGoogleNews(ctx, query, 5)
		if err == nil && len(items) > 0 {
			var summaries []string
			for _, it := range items {
				sources = append(sources, domain.SearchSource{
					Title:   it.Title,
					URL:     it.Link,
					Snippet: it.Source,
				})
				if len(summaries) < 3 {
					summaries = append(summaries, fmt.Sprintf("%s (%s)", it.Title, it.Source))
				}
			}
			summary = fmt.Sprintf("Notícias factuais recentes sobre %q:\n- %s", query, strings.Join(summaries, "\n- "))
		} else {
			searchErr = err
		}
	}

	// 2. Fallback para VerticalSearchSubagent se a categoria vertical falhou ou for "general"
	if len(sources) == 0 && t.subagent != nil {
		subSources, subSummary, err := t.subagent.Search(ctx, query, cat)
		if err == nil && len(subSources) > 0 {
			sources = subSources
			summary = subSummary
			searchErr = nil
		} else if searchErr == nil {
			searchErr = err
		}
	}

	// 3. Fallback informativo caso nada tenha retornado
	if len(sources) == 0 {
		if searchErr != nil {
			summary = fmt.Sprintf("Nenhum dado factual em tempo real disponível para %q na vertical %s: %v", query, cat, searchErr)
		} else {
			summary = fmt.Sprintf("Nenhum resultado factual encontrado para %q na vertical %s.", query, cat)
		}
	}

	return &domain.ToolExecutionResult{
		Status:                "COMPLETED",
		SummaryForLLM:         summary,
		Sources:               sources,
		MarksContextAsTainted: true, // Dados da web aberta contaminam o contexto contra injeção de prompt
		TaintSourceLabel:      "web_search_results",
	}, nil
}
