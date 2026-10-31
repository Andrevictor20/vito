package ai_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestVerticalSearchSubagent_SearXNG(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"query": "cotação euro",
			"results": [
				{
					"title": "Cotação do Euro Hoje",
					"url": "https://economia.uol.com.br/cotacoes/cambio/euro-comercial/",
					"content": "Confira o valor do Euro comercial hoje atualizado em tempo real.",
					"engine": "google"
				}
			]
		}`)
	}))
	defer ts.Close()

	searxng := ai.NewSearXNGClient(ts.URL, ts.Client())
	sub := ai.NewVerticalSearchSubagent(searxng, nil)

	sources, summary, err := sub.Search(context.Background(), "cotação euro", "finance")
	if err != nil {
		t.Fatalf("falha inesperada na busca SearXNG: %v", err)
	}

	if len(sources) != 1 {
		t.Fatalf("esperava 1 fonte, obteve %d", len(sources))
	}
	if sources[0].URL != "https://economia.uol.com.br/cotacoes/cambio/euro-comercial/" {
		t.Errorf("URL incorreta: %s", sources[0].URL)
	}
	if summary == "" {
		t.Errorf("resumo retornado vazio")
	}
}

func TestVerticalSearchSubagent_GeminiGrounding(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"candidates": [{
				"content": {
					"parts": [{"text": "O Flamengo venceu a última partida por 2 a 1."}]
				},
				"groundingMetadata": {
					"groundingChunks": [{
						"web": {
							"uri": "https://ge.globo.com/futebol/times/flamengo",
							"title": "ge Flamengo"
						}
					}]
				}
			}]
		}`)
	}))
	defer ts.Close()

	sub := ai.NewVerticalSearchSubagent(nil, nil)
	sub.SetGeminiConfig("test-key", "gemini-2.5-flash", ts.URL)

	sources, summary, err := sub.Search(context.Background(), "jogo flamengo", "general")
	if err != nil {
		t.Fatalf("falha na busca com Gemini Grounding: %v", err)
	}

	if len(sources) != 1 {
		t.Fatalf("esperava 1 fonte de grounding, obteve %d", len(sources))
	}
	if sources[0].Title != "ge Flamengo" {
		t.Errorf("título incorreto da fonte: %s", sources[0].Title)
	}
	if summary != "O Flamengo venceu a última partida por 2 a 1." {
		t.Errorf("resumo incorreto: %s", summary)
	}
}
