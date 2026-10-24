package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func TestFinanceCollector_BrapiFetch(t *testing.T) {
	mockBrapi := `{
		"results": [
			{
				"symbol": "PETR4",
				"shortName": "PETROBRAS PN",
				"regularMarketPrice": 34.50,
				"regularMarketChangePercent": -2.35,
				"regularMarketDayHigh": 35.20,
				"regularMarketDayLow": 34.10,
				"regularMarketTime": "2026-10-24T13:00:00.000Z"
			}
		]
	}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(mockBrapi))
	}))
	defer server.Close()

	col := &FinanceCollector{
		Client:      server.Client(),
		BrapiBaseURL: server.URL,
	}

	trig := &domain.Trigger{
		Title:    "Petrobras",
		Query:    "PETR4 abaixo de 35",
		Category: domain.CategoryFinance,
	}

	points, err := col.Fetch(context.Background(), trig)
	if err != nil {
		t.Fatalf("erro inesperado no coletor de finanças: %v", err)
	}

	if len(points) == 0 {
		t.Fatalf("esperava ao menos 1 data point")
	}
	if points[0].Value != "34.50" {
		t.Errorf("valor esperado 34.50, obteve %s", points[0].Value)
	}
	if points[0].Source != "Brapi (B3)" {
		t.Errorf("fonte esperada 'Brapi (B3)', obteve %s", points[0].Source)
	}
}

func TestShoppingCollector_MercadoLivreFetch(t *testing.T) {
	mockML := `{
		"results": [
			{
				"id": "MLB123",
				"title": "Capa Case Antishock Para Playstation 5",
				"price": 49.90,
				"permalink": "https://produto.mercadolivre.com.br/MLB-capa"
			},
			{
				"id": "MLB456",
				"title": "Console PlayStation 5 Slim 1TB Lacrado",
				"price": 3799.00,
				"permalink": "https://produto.mercadolivre.com.br/MLB-ps5"
			}
		]
	}`

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(mockML))
	}))
	defer server.Close()

	col := &ShoppingCollector{
		Client:    server.Client(),
		MLBBaseURL: server.URL,
	}

	trig := &domain.Trigger{
		Title:    "PlayStation 5",
		Query:    "Comprar PS5 abaixo de 4000",
		Category: domain.CategoryShopping,
	}

	points, err := col.Fetch(context.Background(), trig)
	if err != nil {
		t.Fatalf("erro no shopping collector: %v", err)
	}

	// O item "Capa Case" deve ter sido descartado pelo filtro anti-acessório
	if len(points) != 1 {
		t.Fatalf("esperava 1 data point válido (sem capa), obteve %d", len(points))
	}
	if points[0].Value != "3799.00" {
		t.Errorf("preço esperado 3799.00, obteve %s", points[0].Value)
	}
	if points[0].Title != "Console PlayStation 5 Slim 1TB Lacrado" {
		t.Errorf("título incorreto: %s", points[0].Title)
	}
}

func TestShoppingCollector_ExtractJSONLD(t *testing.T) {
	htmlSample := `
	<html>
	<head>
		<script type="application/ld+json">
		{
			"@context": "https://schema.org/",
			"@type": "Product",
			"name": "Smartphone Poco X8 Pro 5G",
			"offers": {
				"@type": "Offer",
				"price": "3199.00",
				"priceCurrency": "BRL",
				"availability": "https://schema.org/InStock"
			}
		}
		</script>
	</head>
	<body></body>
	</html>
	`

	price, name, ok := extractJSONLDProduct(htmlSample)
	if !ok {
		t.Fatalf("esperava extrair produto do JSON-LD")
	}
	if price != 3199.00 {
		t.Errorf("preço esperado 3199.00, obteve %f", price)
	}
	if name != "Smartphone Poco X8 Pro 5G" {
		t.Errorf("nome esperado 'Smartphone Poco X8 Pro 5G', obteve %s", name)
	}
}

func TestJobsCollector_FiltersClosedJobs(t *testing.T) {
	items := []SearXNGResult{
		{
			Title:   "Desenvolvedor Go - Gupy",
			URL:     "https://empresa.gupy.io/job/1",
			Content: "Vaga remota para Backend Go. Inscrições abertas.",
		},
		{
			Title:   "Go Software Engineer - Vagas",
			URL:     "https://vagas.com.br/123",
			Content: "Vaga encerrada. Esta oportunidade não está mais aceitando inscrições.",
		},
	}

	valid := filterActiveJobResults(items)
	if len(valid) != 1 {
		t.Fatalf("esperava 1 vaga ativa, obteve %d", len(valid))
	}
	if valid[0].Title != "Desenvolvedor Go - Gupy" {
		t.Errorf("vaga ativa incorreta: %s", valid[0].Title)
	}
}

func TestTenderCollector_FiltersCursinhoClickbait(t *testing.T) {
	items := []TriggerDataPoint{
		{
			Title:  "Concurso INSS 2026: Pode sair em breve? Veja o que estudar!",
			Source: "Blog Gran Concursos",
		},
		{
			Title:       "Edital Publicado: Concurso Banco Central 2026 com 300 vagas",
			Source:      "Diário Oficial da União",
			PublishedAt: time.Now(),
		},
	}

	valid := filterOfficialTenderPoints(items)
	if len(valid) != 1 {
		t.Fatalf("esperava 1 edital oficial, obteve %d", len(valid))
	}
	if valid[0].Source != "Diário Oficial da União" {
		t.Errorf("fonte oficial esperada DOU, obteve %s", valid[0].Source)
	}
}
