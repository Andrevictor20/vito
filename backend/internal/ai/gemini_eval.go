package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// EvaluateTriggerWithSearch realiza pesquisa na web via Google Search Grounding e resume a vigília.
func (p *GeminiProvider) EvaluateTriggerWithSearch(ctx context.Context, title, query string) (string, string, error) {
	if p.apiKey == "" {
		return "", "", errors.New("chave de api do gemini não configurada")
	}

	base := p.baseURL
	if base == "" {
		base = "https://generativelanguage.googleapis.com"
	}

	promptText := fmt.Sprintf("Você é o secretário executivo Vito. Realize uma pesquisa atualizada e forneça um relatório conciso, executivo e factual sobre o tema de vigília: '%s' (Consulta solicitada: '%s'). Destaque dados recentes, cotações, notícias ou status relevante. NUNCA use emojis. Mantenha tom executivo e formal.", title, query)

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: promptText}}},
		},
		Tools: []geminiTool{
			{GoogleSearch: &geminiGoogleSearch{}},
		},
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", "", err
	}

	url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", base, p.model, p.apiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("gemini api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var geminiResp geminiResponse
	if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil {
		return "", "", err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", "", errors.New("resposta vazia retornada na pesquisa do gemini")
	}

	resultText := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
	payload := fmt.Sprintf(`{"status":"searched","query":"%s","time":"%s"}`, query, time.Now().UTC().Format(time.RFC3339))
	return resultText, payload, nil
}

// TestEvaluateTrigger avalia a condição do disparador consultando fatos atualizados na web via Google Search.
func (p *GeminiProvider) TestEvaluateTrigger(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	if p.apiKey == "" {
		return nil, errors.New("chave de api do gemini não configurada")
	}

	base := p.baseURL
	if base == "" {
		base = "https://generativelanguage.googleapis.com"
	}

	now := time.Now()
	nowStr := now.Format("02/01/2006 às 15:04")
	currentMonthYear := now.Format("01/2006")

	isShopping := IsShoppingOrPriceQuery(t.Query, t.Title, string(t.Category))

	var realtimeFeed string
	var collectedNews []NewsItem
	searchQuery := CleanSearchQuery(t.Query, string(t.Category))
	if searchQuery == "" {
		searchQuery = CleanSearchQuery(t.Title, string(t.Category))
	}
	if items, err := FetchGoogleNews(ctx, searchQuery, 6, p.httpClient); err == nil && len(items) > 0 {
		collectedNews = FilterShoppingNews(items, isShopping)
		realtimeFeed = FormatNewsFeed(collectedNews)
	} else if items, err := FetchGoogleNews(ctx, t.Title, 6, p.httpClient); err == nil && len(items) > 0 {
		collectedNews = FilterShoppingNews(items, isShopping)
		realtimeFeed = FormatNewsFeed(collectedNews)
	}

	realtimeBlock := ""
	if realtimeFeed != "" {
		realtimeBlock = fmt.Sprintf("\nNOTÍCIAS FACTUAIS COLETADAS EM TEMPO REAL NA WEB (GOOGLE NOTÍCIAS BRASIL):\n%s\n", WrapUntrustedContent("web_search", realtimeFeed))
	}

	promptText := fmt.Sprintf(`Você é o motor de inteligência e vigília proativa do assistente executivo Vito.
Avalie em tempo real este radar de monitoramento consultando dados atualizados da web brasileira via Google Search:
- TÍTULO: %s
- CONSULTA / VIGÍLIA: %s
- CATEGORIA: %s
- DATA/HORA DE REFERÊNCIA: %s (Mês/Ano Atual: %s)
%s
DIRETRIZES DE LOCALIZAÇÃO, IDIOMA E ATUALIDADE:
1. IDIOMA E LOCALIZAÇÃO MANDATÓRIOS: Responda 100%% em PORTUGUÊS DO BRASIL (pt-BR). É EXPRESSAMENTE PROIBIDO gerar texto em inglês. Todos os preços DEVEM ser em Reais (R$) e voltados para o Brasil.
2. ATENÇÃO AO CALENDÁRIO: Estamos em %s. As notícias e preços DEVEM ser de hoje ou dos últimos dias do mês atual. PROIBIDO trazer fatos antigos de meses anteriores.
3. SE FOR TIME OU EVENTO ESPORTIVO (ex: jogos do Flamengo, futebol):
   - Priorize OBRIGATORIAMENTE o ÚLTIMO JOGO DISPUTADO com placar exato (ex: "Flamengo 2 x 1 Racing", data e campeonato).
   - Defina "metric_label": "Último Jogo" e "metric_value": "Time X x Y Adversário" com o placar concreto.
   - Traga também a data/horário do PRÓXIMO jogo se disponível.
4. SE FOR MONITORAMENTO DE PRODUTO, APARELHO OU PREÇO (ex: smartphone, Poco X8 Pro Max, eletrônicos):
   - Use a pesquisa do Google para consultar os PREÇOS REAIS DE VENDA nos principais e-commerces brasileiros (Mercado Livre, KaBuM!, Amazon Brasil, Magazine Luiza, Casas Bahia, Shopee).
   - SANIDADE DE PREÇO E ANTI-ANOMALIA:
     a) O preço DEVE ser do APARELHO PRINCIPAL (novo, original e lacrado). NUNCA traga preços de capas, películas, carregadores, cabos, peças de reposição ou aparelhos recondicionados/usados.
     b) Jamais aceite valores discrepantes fora da realidade de mercado (ex: R$ 1.199 para um smartphone intermediário-premium/topo como Poco X8 Pro Max, cuja faixa de mercado real é de R$ 2.600 a R$ 3.900). Se encontrar ofertas irreais de sites de concursos ou blogs caça-cliques, IGNORE-AS categoricamente.
     c) Defina "metric_label": "Menor Preço" e "metric_value": valor em R$ (ex: "R$ 3.128" ou "R$ 3.249").
     d) No array "bullets", liste os preços concretos nas lojas pesquisadas com as condições reais (ex: "A partir de R$ 3.128 no Mercado Livre à vista no Pix", "R$ 3.300 na KaBuM! com parcelamento em 10x sem juros", "R$ 3.468 na Amazon Brasil").
     e) Em "sources", inclua as lojas reais encontradas na pesquisa com URLs legítimas.
5. ESCANEABILIDADE E ZERO PAREDES DE TEXTO:
   - "summary": manchete executiva principal em 1 linha (máx 100 caracteres).
   - "bullets": array com 2 a 3 tópicos factuais curtos e diretos (máximo 120 caracteres por item). PROIBIDO parágrafos longos ou texto corrido maçante.
6. REGRA ANTI-SLOP ESTRITA: NUNCA use metalinguagem de IA (não diga "Conforme solicitado", "Identifiquei que", "A condição foi atendida"). Seja analítico e direto como um briefing executivo.

Responda ESTRITAMENTE em formato JSON puro (sem marcações markdown extras):
{
  "condition_met": boolean,
  "summary": string (manchete executiva concisa em 1 frase em português do Brasil),
  "metric_label": string (rótulo curto como "Último Jogo", "Menor Preço", "Status"),
  "metric_value": string (valor ou placar em destaque como "Flamengo 2 x 1 Adversário" ou "R$ 3.128"),
  "bullets": [string, string, string] (array de 2 a 3 tópicos objetivos de até 120 caracteres),
  "current_data": string (dados resumidos em tópicos factuais),
  "simulated_notification": string (alerta curto e chamativo para push notification),
  "confidence": number (0-100),
  "why_relevant": string (1 frase explicando a relevância imediata para o usuário em português),
  "urgency": string ("breaking" ou "high" se for gol, vitória/derrota recente, queda histórica de preço ou notícia urgente; senão "low"),
  "sources": [
    {"name": string, "title": string, "url": string}
  ]
}`, t.Title, t.Query, t.Category, nowStr, currentMonthYear, realtimeBlock, currentMonthYear)

	// Modelos prioritários com fallback resiliente para Grounding e geração
	modelsToTry := []string{p.model}
	candidates := []string{"gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"}
	for _, cand := range candidates {
		found := false
		for _, m := range modelsToTry {
			if m == cand {
				found = true
				break
			}
		}
		if !found {
			modelsToTry = append(modelsToTry, cand)
		}
	}

	var rawText string
	var lastErr error
	var groundingChunks []geminiGroundingChunk

	// 1. Tentar com busca na web (Grounding Google Search)
	for _, m := range modelsToTry {
		reqBody := geminiRequest{
			Contents: []geminiContent{
				{Role: "user", Parts: []geminiPart{{Text: promptText}}},
			},
			Tools: []geminiTool{
				{GoogleSearch: &geminiGoogleSearch{}},
			},
		}

		jsonBytes, err := json.Marshal(reqBody)
		if err != nil {
			lastErr = err
			continue
		}

		url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", base, m, p.apiKey)
		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := p.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusOK {
			var geminiResp geminiResponse
			if err := json.Unmarshal(bodyBytes, &geminiResp); err == nil && len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
				rawText = strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
				if geminiResp.Candidates[0].GroundingMetadata != nil {
					groundingChunks = geminiResp.Candidates[0].GroundingMetadata.GroundingChunks
				}
				if rawText != "" {
					break
				}
			}
		} else {
			lastErr = fmt.Errorf("gemini search api status %d: %s", resp.StatusCode, string(bodyBytes))
		}
	}

	// 2. Fallback resiliente: se a cota do Google Search estiver esgotada (429) ou indisponível,
	// efetua a síntese inteligente sem a tool de busca para não travar a vigília em fallback estático
	if rawText == "" {
		for _, m := range modelsToTry {
			reqBody := geminiRequest{
				Contents: []geminiContent{
					{Role: "user", Parts: []geminiPart{{Text: promptText}}},
				},
			}

			jsonBytes, err := json.Marshal(reqBody)
			if err != nil {
				lastErr = err
				continue
			}

			url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", base, m, p.apiKey)
			req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
			if err != nil {
				lastErr = err
				continue
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := p.httpClient.Do(req)
			if err != nil {
				lastErr = err
				continue
			}

			bodyBytes, err := io.ReadAll(resp.Body)
			resp.Body.Close()
			if err != nil {
				lastErr = err
				continue
			}

			if resp.StatusCode == http.StatusOK {
				var geminiResp geminiResponse
				if err := json.Unmarshal(bodyBytes, &geminiResp); err == nil && len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
					rawText = strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
					if rawText != "" {
						break
					}
				}
			} else {
				lastErr = fmt.Errorf("gemini fallback api status %d: %s", resp.StatusCode, string(bodyBytes))
			}
		}
	}

	if rawText == "" {
		return nil, fmt.Errorf("falha ao avaliar vigília com gemini: %w", lastErr)
	}

	res, err := ParseTriggerEvalResult(rawText, t)
	if err != nil {
		return nil, err
	}

	// 1. Prioridade máxima para fontes reais retornadas pelo Google Search Grounding
	if len(res.Sources) == 0 && len(groundingChunks) > 0 {
		seen := make(map[string]bool)
		for _, chunk := range groundingChunks {
			uri := strings.TrimSpace(chunk.Web.URI)
			title := strings.TrimSpace(chunk.Web.Title)
			if uri != "" && !seen[uri] {
				seen[uri] = true
				sourceName := cleanDomainName(uri)
				res.Sources = append(res.Sources, domain.TriggerSourceItem{
					Title: title,
					Name:  sourceName,
					URL:   uri,
				})
			}
		}
	}

	// 2. Se ainda não há fontes e o feed de notícias confiáveis coletou algo (não espúrio e não shopping genérico)
	if len(res.Sources) == 0 && len(collectedNews) > 0 && !isShopping {
		for _, n := range collectedNews {
			if !IsSpuriousNewsSource(n.Source, n.Title) {
				res.Sources = append(res.Sources, domain.TriggerSourceItem{
					Title: n.Title,
					Name:  n.Source,
					URL:   n.Link,
				})
			}
		}
	}

	return res, nil
}

func cleanDomainName(rawURL string) string {
	u, err := url.Parse(rawURL)
	if err != nil || u.Host == "" {
		return "Google Search"
	}
	host := strings.ToLower(strings.TrimPrefix(u.Host, "www."))
	switch {
	case strings.Contains(host, "mercadolivre"):
		return "Mercado Livre"
	case strings.Contains(host, "amazon"):
		return "Amazon Brasil"
	case strings.Contains(host, "kabum"):
		return "KaBuM!"
	case strings.Contains(host, "magazineluiza") || strings.Contains(host, "magalu"):
		return "Magazine Luiza"
	case strings.Contains(host, "casasbahia"):
		return "Casas Bahia"
	case strings.Contains(host, "shopee"):
		return "Shopee"
	case strings.Contains(host, "tudocelular"):
		return "TudoCelular"
	case strings.Contains(host, "techtudo"):
		return "TechTudo"
	case strings.Contains(host, "canaltech"):
		return "Canaltech"
	case strings.Contains(host, "zoom.com"):
		return "Zoom"
	case strings.Contains(host, "buscape.com"):
		return "Buscapé"
	default:
		parts := strings.Split(host, ".")
		if len(parts) > 0 && len(parts[0]) > 2 {
			return strings.ToUpper(parts[0][:1]) + parts[0][1:]
		}
		return host
	}
}
