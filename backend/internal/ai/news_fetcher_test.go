package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

const sampleGoogleNewsRSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>Google Notícias - tecnologia</title>
  <item>
    <title>Nem os agentes de IA escapam da disparidade salarial de gênero - O GLOBO</title>
    <link>https://oglobo.globo.com/economia/ia-disparidade</link>
    <pubDate>Sun, 11 Oct 2026 16:33:12 GMT</pubDate>
    <source url="https://oglobo.globo.com">O GLOBO</source>
  </item>
  <item>
    <title>CEO do TikTok prevê grandes avanços científicos com IA - Times Brasil</title>
    <link>https://timesbrasil.com.br/ia-tiktok</link>
    <pubDate>Mon, 12 Oct 2026 12:33:00 GMT</pubDate>
    <source url="https://timesbrasil.com.br">Times Brasil</source>
  </item>
  <item>
    <title>Notícia Antiga de Maio sobre Robôs - Portal Antigo</title>
    <link>https://exemplo.com/maio</link>
    <pubDate>Wed, 15 May 2024 10:00:00 GMT</pubDate>
    <source url="https://exemplo.com">Portal Antigo</source>
  </item>
</channel>
</rss>`

func TestFetchGoogleNews_Success(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		_, _ = w.Write([]byte(sampleGoogleNewsRSS))
	}))
	defer server.Close()

	client := server.Client()
	refDate := time.Date(2026, 10, 12, 13, 0, 0, 0, time.UTC)

	items, err := fetchGoogleNewsFromURL(context.Background(), server.URL, client, 5, refDate)
	if err != nil {
		t.Fatalf("fetchGoogleNewsFromURL falhou: %v", err)
	}

	// Notícia de maio deve ter sido descartada (mais de 14 dias atrás)
	if len(items) != 2 {
		t.Fatalf("esperava 2 notícias recentes de outubro, obteve %d", len(items))
	}

	// Primeira deve ser a mais recente (12/10)
	if items[0].Title != "CEO do TikTok prevê grandes avanços científicos com IA" && items[0].Source != "Times Brasil" {
		t.Errorf("ordenação incorreta, esperava CEO do TikTok em primeiro, obteve: %+v", items[0])
	}

	formatted := FormatNewsFeed(items)
	if formatted == "" {
		t.Fatal("FormatNewsFeed retornou vazio")
	}
	t.Logf("Feed formatado:\n%s", formatted)
}

func TestFetchGoogleNews_EmptyOrError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
	}))
	defer server.Close()

	client := server.Client()
	_, err := fetchGoogleNewsFromURL(context.Background(), server.URL, client, 5, time.Now())
	if err == nil {
		t.Fatal("esperava erro para HTTP 404")
	}
}

func TestIsSpuriousNewsSource(t *testing.T) {
	cases := []struct {
		source string
		title  string
		want   bool
	}{
		{"JC Concursos", "Melhores celulares em promoção", true},
		{"CicloVivo", "Novo smartphone com desconto", true},
		{"Distrito Online", "Poco X8 Pro Max por 1.199", true},
		{"TudoCelular", "Poco X8 Pro Max chega ao Brasil", false},
		{"TechTudo", "Review do Poco X8 Pro Max", false},
		{"G1", "Economia brasileira cresce", false},
	}

	for _, c := range cases {
		got := IsSpuriousNewsSource(c.source, c.title)
		if got != c.want {
			t.Errorf("IsSpuriousNewsSource(%q, %q) = %v; esperado %v", c.source, c.title, got, c.want)
		}
	}
}

func TestShoppingDetectionAndFiltering(t *testing.T) {
	// 1. Detecção de compras/preço
	if !IsShoppingOrPriceQuery("Preço pocophone x8 pro max", "Poco X8", "shopping") {
		t.Error("esperava que consulta de pocophone fosse detectada como shopping")
	}
	if !IsShoppingOrPriceQuery("qual o valor do celular iphone", "iPhone 15", "tech") {
		t.Error("esperava que consulta com 'valor do celular' fosse detectada como shopping")
	}
	if IsShoppingOrPriceQuery("próximos jogos do flamengo", "Flamengo", "sports") {
		t.Error("não deveria detectar jogos de futebol como shopping")
	}

	// 2. Filtro de notícias de shopping
	rawItems := []NewsItem{
		{Title: "Poco X8 em oferta", Source: "TudoCelular"},
		{Title: "Celular por 1000 reais", Source: "JC Concursos"},
		{Title: "Poco X8 review", Source: "Canaltech"},
		{Title: "Dicas de sustentabilidade", Source: "CicloVivo"},
	}

	filtered := FilterShoppingNews(rawItems, true)
	if len(filtered) != 2 {
		t.Fatalf("esperava 2 itens filtrados para shopping, obteve %d", len(filtered))
	}
	for _, it := range filtered {
		if it.Source != "TudoCelular" && it.Source != "Canaltech" {
			t.Errorf("fonte não confiável passou no filtro de shopping: %s", it.Source)
		}
	}
}
