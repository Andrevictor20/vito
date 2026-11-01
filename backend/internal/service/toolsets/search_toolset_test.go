package toolsets_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service/toolsets"
)

func TestSearchToolset_MetadataAndSchema(t *testing.T) {
	s := toolsets.NewSearchToolset()

	if s.Name() != domain.ToolsetWebSearch {
		t.Errorf("nome inesperado: %s", s.Name())
	}
	if s.Description() == "" {
		t.Errorf("descrição vazia")
	}

	isWrite, isDestr, preview := s.IsWriteOperation("search", nil)
	if isWrite || isDestr || preview != nil {
		t.Errorf("busca não deve ser operação de escrita: write=%v destr=%v", isWrite, isDestr)
	}
}

func TestSearchToolset_FinanceRouting(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"USDBRL":{"code":"USD","codein":"BRL","name":"Dólar Comercial","bid":"5.75","timestamp":"1700000000"}}`)
	}))
	defer ts.Close()

	finCollector := &ai.FinanceCollector{
		Client: ts.Client(),
	}

	toolset := toolsets.NewSearchToolset()
	toolset.SetFinanceCollector(finCollector)

	params, _ := json.Marshal(map[string]any{
		"query":    "USD BRL",
		"category": "finance",
	})

	res, err := toolset.Execute(context.Background(), &domain.ToolExecutionContext{TurnID: "turn-1"}, "search", params)
	if err != nil {
		t.Fatalf("falha ao executar busca financeira: %v", err)
	}

	if !res.MarksContextAsTainted {
		t.Errorf("esperava MarksContextAsTainted verdadeiro para blindagem contra prompt injection")
	}
	if res.TaintSourceLabel != "web_search_results" {
		t.Errorf("label de contaminação incorreto: %s", res.TaintSourceLabel)
	}
	if len(res.Sources) == 0 {
		t.Errorf("esperava fontes retornadas pela AwesomeAPI")
	}
}

func TestSearchToolset_FallbackToSubagent(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"query": "previsão tempo sp",
			"results": [{
				"title": "Clima em SP",
				"url": "https://clima.example.com",
				"content": "Tempo ensolarado com 26 graus.",
				"engine": "bing"
			}]
		}`)
	}))
	defer ts.Close()

	searxng := ai.NewSearXNGClient(ts.URL, ts.Client())
	subagent := ai.NewVerticalSearchSubagent(searxng, nil)

	toolset := toolsets.NewSearchToolset(subagent)

	params, _ := json.Marshal(map[string]any{
		"query":    "previsão tempo sp",
		"category": "general",
	})

	res, err := toolset.Execute(context.Background(), &domain.ToolExecutionContext{TurnID: "turn-2"}, "search", params)
	if err != nil {
		t.Fatalf("falha ao executar busca geral: %v", err)
	}

	if !res.MarksContextAsTainted {
		t.Errorf("MarksContextAsTainted deve ser true")
	}
	if len(res.Sources) != 1 || res.Sources[0].URL != "https://clima.example.com" {
		t.Errorf("fonte inesperada: %+v", res.Sources)
	}
}

type mockWebReader struct {
	readURLFn func(ctx context.Context, targetURL string) (*ai.WebPageContent, error)
}

func (m *mockWebReader) ReadURL(ctx context.Context, targetURL string) (*ai.WebPageContent, error) {
	if m.readURLFn != nil {
		return m.readURLFn(ctx, targetURL)
	}
	return &ai.WebPageContent{
		URL:       targetURL,
		Title:     "Página de Teste",
		Markdown:  "# Artigo Completo\n\nTexto extraído em markdown com sucesso.",
		Source:    "native",
	}, nil
}

func TestSearchToolset_ReadPage_Success(t *testing.T) {
	mockReader := &mockWebReader{
		readURLFn: func(ctx context.Context, targetURL string) (*ai.WebPageContent, error) {
			return &ai.WebPageContent{
				URL:      targetURL,
				Title:    "Edital de Concurso 2026",
				Markdown: "# Edital 01/2026\n\nInscrições abertas de 10 a 25 de novembro com 150 vagas.",
				Source:   "native",
			}, nil
		},
	}

	toolset := toolsets.NewSearchToolset()
	toolset.SetWebReader(mockReader)

	params, _ := json.Marshal(map[string]any{
		"url": "https://concursos.gov.br/edital-2026",
	})

	res, err := toolset.Execute(context.Background(), &domain.ToolExecutionContext{TurnID: "turn-read"}, "read_page", params)
	if err != nil {
		t.Fatalf("falha ao executar read_page: %v", err)
	}

	if res.Status != "COMPLETED" {
		t.Errorf("esperava status COMPLETED, obteve %q", res.Status)
	}
	if !res.MarksContextAsTainted {
		t.Errorf("esperava MarksContextAsTainted verdadeiro")
	}
	if res.TaintSourceLabel != "web_read_page" {
		t.Errorf("esperava label web_read_page, obteve %q", res.TaintSourceLabel)
	}
	if len(res.Sources) != 1 || res.Sources[0].URL != "https://concursos.gov.br/edital-2026" {
		t.Errorf("fontes incorretas: %+v", res.Sources)
	}
	if res.Sources[0].Title != "Edital de Concurso 2026" {
		t.Errorf("título da fonte incorreto: %q", res.Sources[0].Title)
	}
}

func TestSearchToolset_ReadPage_MissingURL(t *testing.T) {
	toolset := toolsets.NewSearchToolset()
	params, _ := json.Marshal(map[string]any{})

	_, err := toolset.Execute(context.Background(), &domain.ToolExecutionContext{TurnID: "turn-err"}, "read_page", params)
	if err == nil {
		t.Fatalf("esperava erro ao chamar read_page sem url")
	}
}

func TestSearchToolset_ReadPage_AutoRouteFromSearch(t *testing.T) {
	mockReader := &mockWebReader{
		readURLFn: func(ctx context.Context, targetURL string) (*ai.WebPageContent, error) {
			return &ai.WebPageContent{
				URL:      targetURL,
				Title:    "Notícia de Economia",
				Markdown: "# PIB Brasileiro Cresce\n\nO PIB subiu no último trimestre.",
				Source:   "jina_reader",
			}, nil
		},
	}

	toolset := toolsets.NewSearchToolset()
	toolset.SetWebReader(mockReader)

	params, _ := json.Marshal(map[string]any{
		"url": "https://g1.globo.com/economia/noticia",
	})

	// Operação search com URL preenchida e query vazia redireciona para read_page
	res, err := toolset.Execute(context.Background(), &domain.ToolExecutionContext{TurnID: "turn-auto"}, "search", params)
	if err != nil {
		t.Fatalf("falha no autorroteamento: %v", err)
	}

	if res.TaintSourceLabel != "web_read_page" {
		t.Errorf("esperava que autorroteasse para web_read_page, obteve %q", res.TaintSourceLabel)
	}
}
