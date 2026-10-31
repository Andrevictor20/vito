package toolsets

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// SearchToolset implementa a Macro-Ferramenta web_and_vertical_search com coletores especializados.
type SearchToolset struct {
	subagent          *ai.VerticalSearchSubagent
	financeCollector  *ai.FinanceCollector
	shoppingCollector *ai.ShoppingCollector
}

// NewSearchToolset instancia o toolset conectando os coletores verticais e o subagente factual.
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

func (t *SearchToolset) Name() domain.ToolsetName {
	return domain.ToolsetWebSearch
}

func (t *SearchToolset) Description() string {
	return "Realiza buscas factuais em tempo real na web e em coletores verticais (finanças, notícias, compras, concursos)."
}

func (t *SearchToolset) JSONSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"operation": {
				"type": "string",
				"enum": ["search"],
				"description": "Operação de busca."
			},
			"params": {
				"type": "object",
				"properties": {
					"query": {"type": "string", "description": "Termo de pesquisa factual."},
					"category": {
						"type": "string",
						"enum": ["general", "finance", "shopping", "news", "jobs"],
						"description": "Categoria vertical de busca."
					}
				},
				"required": ["query"]
			}
		},
		"required": ["operation"]
	}`)
}

func (t *SearchToolset) IsWriteOperation(op string, rawParams json.RawMessage) (bool, bool, map[string]any) {
	return false, false, nil // Busca é operação puramente de leitura
}

func (t *SearchToolset) Execute(ctx context.Context, execCtx *domain.ToolExecutionContext, op string, rawParams json.RawMessage) (*domain.ToolExecutionResult, error) {
	var params struct {
		Query    string `json:"query"`
		Category string `json:"category"`
	}
	if len(rawParams) > 0 {
		_ = json.Unmarshal(rawParams, &params)
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
