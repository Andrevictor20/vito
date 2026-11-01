package ai

import (
	"context"
	"strings"
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func TestRouteTriggerSource(t *testing.T) {
	fin := &domain.Trigger{Category: domain.CategoryFinance, Query: "dólar hoje", Title: "Câmbio"}
	if got := RouteTriggerSource(fin).Name(); got != "finance" {
		t.Errorf("finance esperado, veio %s", got)
	}
	w := &domain.Trigger{Category: domain.CategoryWeather, Query: "clima em Recife", Title: "Tempo"}
	if got := RouteTriggerSource(w).Name(); got != "weather" {
		t.Errorf("weather esperado, veio %s", got)
	}
	n := &domain.Trigger{Category: domain.CategoryTech, Query: "IA", Title: "Tech"}
	if got := RouteTriggerSource(n).Name(); got != "google_news" {
		t.Errorf("google_news esperado, veio %s", got)
	}

	// Testes do conector web_page (§Plano 17)
	webCat := &domain.Trigger{Category: domain.CategoryWebPage, Title: "Página Concurso", Query: "concurso"}
	if got := RouteTriggerSource(webCat).Name(); got != "web_page" {
		t.Errorf("web_page esperado para categoria web_page, veio %s", got)
	}

	webTarget := &domain.Trigger{Category: domain.CategoryCustom, Title: "Edital", TargetURL: "https://portal.gov.br/edital"}
	if got := RouteTriggerSource(webTarget).Name(); got != "web_page" {
		t.Errorf("web_page esperado para TargetURL presente, veio %s", got)
	}

	webQueryURL := &domain.Trigger{Category: domain.CategoryNews, Title: "Notícia Direta", Query: "https://g1.globo.com/economia"}
	if got := RouteTriggerSource(webQueryURL).Name(); got != "web_page" {
		t.Errorf("web_page esperado para query iniciando com http, veio %s", got)
	}
}

type mockSourceWebReader struct {
	content string
}

func (m *mockSourceWebReader) ReadURL(ctx context.Context, targetURL string) (*WebPageContent, error) {
	return &WebPageContent{
		URL:      targetURL,
		Title:    "Portal de Editais",
		Markdown: m.content,
		Source:   "native",
	}, nil
}

func TestWebPageSource_FetchAndDeltaHash(t *testing.T) {
	reader := &mockSourceWebReader{content: "# Edital 01\nStatus: Aberto"}
	src := &WebPageSource{Reader: reader}

	tr := &domain.Trigger{
		Category:  domain.CategoryWebPage,
		Title:     "Monitor de Edital",
		TargetURL: "https://example.com/edital",
	}

	points1, err := src.Fetch(context.Background(), tr)
	if err != nil {
		t.Fatalf("Fetch 1 falhou: %v", err)
	}
	if len(points1) != 1 {
		t.Fatalf("esperava 1 datapoint, obteve %d", len(points1))
	}
	if points1[0].Link != "https://example.com/edital" {
		t.Errorf("link incorreto: %s", points1[0].Link)
	}

	hash1 := HashDataPoint(points1[0])

	// Simula nova execução sem alterações de conteúdo
	points1Again, _ := src.Fetch(context.Background(), tr)
	hash1Again := HashDataPoint(points1Again[0])
	if hash1 != hash1Again {
		t.Errorf("hashes deveriam ser idênticos para mesmo conteúdo")
	}

	// Simula alteração no conteúdo da página monitorada
	reader.content = "# Edital 01\nStatus: RETIFICADO - Novas Vagas Adicionadas"
	points2, err := src.Fetch(context.Background(), tr)
	if err != nil {
		t.Fatalf("Fetch 2 falhou: %v", err)
	}

	hash2 := HashDataPoint(points2[0])
	if hash1 == hash2 {
		t.Errorf("hashes deveriam ser diferentes após alteração do conteúdo da página")
	}
	if !strings.Contains(points2[0].Value, "RETIFICADO") {
		t.Errorf("valor deveria conter o trecho atualizado da página")
	}
}

func TestNewsQueryFor(t *testing.T) {
	imm := &domain.Trigger{Query: "concurso", Frequency: domain.FrequencyImmediate}
	if q := NewsQueryFor(imm); q != "concurso when:1h" {
		t.Errorf("when:1h esperado, veio %q", q)
	}
	daily := &domain.Trigger{Query: "concurso", Frequency: domain.FrequencyDailyMorning}
	if q := NewsQueryFor(daily); q != "concurso" {
		t.Errorf("query intacta esperada, veio %q", q)
	}
}

func TestWeatherCity(t *testing.T) {
	tr := &domain.Trigger{Query: "vai chover em Recife amanhã?", Title: "Clima"}
	if c := weatherCity(tr); c != "Recife" {
		t.Errorf("Recife esperado, veio %q", c)
	}
	def := &domain.Trigger{Query: "clima", Title: "Tempo"}
	if c := weatherCity(def); c != "São Paulo" {
		t.Errorf("fallback São Paulo esperado, veio %q", c)
	}
}

func TestHashDataPoint_Stable(t *testing.T) {
	p := TriggerDataPoint{Title: "A", Link: "http://x", Value: "1"}
	if HashDataPoint(p) != HashDataPoint(p) {
		t.Error("hash deveria ser estável")
	}
	q := TriggerDataPoint{Title: "B", Link: "http://x", Value: "1"}
	if HashDataPoint(p) == HashDataPoint(q) {
		t.Error("títulos distintos deveriam gerar hashes distintos")
	}
}
