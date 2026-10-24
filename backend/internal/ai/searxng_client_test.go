package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestSearXNGClient_Search_Success(t *testing.T) {
	mockResponse := `{
		"query": "golang vagas remoto",
		"number_of_results": 2,
		"results": [
			{
				"title": "Desenvolvedor Go Sênior - Gupy",
				"url": "https://empresa.gupy.io/job/123",
				"content": "Vaga remota para dev backend Go com experiência em microsserviços.",
				"engine": "google",
				"publishedDate": "2026-10-24T10:00:00Z",
				"score": 1.5
			},
			{
				"title": "Go Engineer - LinkedIn",
				"url": "https://linkedin.com/jobs/view/456",
				"content": "Empresa contrata desenvolvedor pleno/sênior Go.",
				"engine": "bing",
				"score": 1.2
			}
		]
	}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query().Get("q")
		format := r.URL.Query().Get("format")
		timeRange := r.URL.Query().Get("time_range")
		categories := r.URL.Query().Get("categories")

		if q != "golang vagas remoto" {
			t.Errorf("query esperada 'golang vagas remoto', obteve %q", q)
		}
		if format != "json" {
			t.Errorf("formato esperado 'json', obteve %q", format)
		}
		if timeRange != "day" {
			t.Errorf("time_range esperado 'day', obteve %q", timeRange)
		}
		if categories != "general" {
			t.Errorf("categories esperado 'general', obteve %q", categories)
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(mockResponse))
	}))
	defer server.Close()

	client := NewSearXNGClient(server.URL, server.Client())
	results, err := client.Search(context.Background(), "golang vagas remoto", SearXNGQueryOptions{
		TimeRange: "day",
		Category:  "general",
		Language:  "pt-BR",
	})
	if err != nil {
		t.Fatalf("erro inesperado na busca: %v", err)
	}

	if len(results) != 2 {
		t.Fatalf("esperado 2 resultados, obteve %d", len(results))
	}
	if results[0].Title != "Desenvolvedor Go Sênior - Gupy" {
		t.Errorf("título incorreto: %s", results[0].Title)
	}
	if results[0].Engine != "google" {
		t.Errorf("engine incorreta: %s", results[0].Engine)
	}
	if results[0].PublishedDate == nil {
		t.Errorf("data de publicação deveria estar presente")
	} else if results[0].PublishedDate.Format(time.RFC3339) != "2026-10-24T10:00:00Z" {
		t.Errorf("data de publicação incorreta: %v", results[0].PublishedDate)
	}
	if results[1].Title != "Go Engineer - LinkedIn" {
		t.Errorf("segundo título incorreto: %s", results[1].Title)
	}
}

func TestSearXNGClient_Search_EmptyQuery(t *testing.T) {
	client := NewSearXNGClient("http://localhost:8185")
	results, err := client.Search(context.Background(), "   ")
	if err == nil {
		t.Fatalf("esperava erro para query vazia")
	}
	if len(results) != 0 {
		t.Fatalf("resultados deveriam ser nulos ou vazios")
	}
}

func TestSearXNGClient_Search_HttpError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("internal search engine failure"))
	}))
	defer server.Close()

	client := NewSearXNGClient(server.URL, server.Client())
	_, err := client.Search(context.Background(), "teste")
	if err == nil {
		t.Fatalf("esperava erro para status 500")
	}
}
