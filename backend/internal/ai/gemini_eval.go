package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
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

	var realtimeFeed string
	searchQuery := CleanSearchQuery(t.Query, string(t.Category))
	if searchQuery == "" {
		searchQuery = CleanSearchQuery(t.Title, string(t.Category))
	}
	if items, err := FetchGoogleNews(ctx, searchQuery, 6, p.httpClient); err == nil && len(items) > 0 {
		realtimeFeed = FormatNewsFeed(items)
	} else if items, err := FetchGoogleNews(ctx, t.Title, 6, p.httpClient); err == nil && len(items) > 0 {
		realtimeFeed = FormatNewsFeed(items)
	}

	realtimeBlock := ""
	if realtimeFeed != "" {
		realtimeBlock = fmt.Sprintf("\nNOTÍCIAS FACTUAIS COLETADAS EM TEMPO REAL NA WEB (GOOGLE NOTÍCIAS BRASIL):\n%s\n", WrapUntrustedContent("web_search", realtimeFeed))
	}

	promptText := fmt.Sprintf(`Você é o motor de inteligência e vigília proativa do assistente executivo Vito.
Avalie em tempo real este radar de monitoramento consultando dados atualizados da web brasileira:
- TÍTULO: %s
- CONSULTA / VIGÍLIA: %s
- CATEGORIA: %s
- DATA/HORA DE REFERÊNCIA: %s (Mês/Ano Atual: %s)
%s
DIRETRIZES DE LOCALIZAÇÃO, IDIOMA E ATUALIDADE:
1. IDIOMA E LOCALIZAÇÃO MANDATÓRIOS: Responda 100%% em PORTUGUÊS DO BRASIL (pt-BR). É EXPRESSAMENTE PROIBIDO gerar texto em inglês. Todos os preços DEVEM ser em Reais (R$) e voltados para o Brasil.
2. ATENÇÃO AO CALENDÁRIO: Estamos em %s. As notícias e preços DEVEM ser de hoje ou dos últimos dias do mês atual. PROIBIDO trazer fatos antigos de meses anteriores.
3. SE FOR MONITORAMENTO DE PRODUTO OU PREÇO:
   - Pesquise exclusivamente lojas confiáveis que operam no Brasil (ex: Mercado Livre, Amazon Brasil, KaBuM!, Magazine Luiza, Casas Bahia, Fast Shop, Promobit).
   - Discrimine obrigatoriamente: o menor preço à vista no PIX com desconto, preço no DÉBITO e opções de parcelamento sem juros no CARTÃO DE CRÉDITO (ex: até 10x ou 12x).
4. ESTRUTURA DOS PARÁGRAFOS (campo "paragraphs"):
   Gere de 2 a 3 parágrafos analíticos completos e substanciais:
   - Parágrafo 1: Notícia e fato central do dia, contextualizando a vigília e variação em relação ao histórico.
   - Parágrafo 2: Dados detalhados e concretos (se produto: lojas, preços Pix, débito e parcelado; se notícias/viagens: números, companhias, linhas ou datas de impacto).
   - Parágrafo 3: Análise prática e recomendação executiva para o usuário (se vale a pena comprar hoje, esperar ou tomar uma ação preventiva).
5. REGRA ANTI-SLOP ESTRITA: NUNCA use metalinguagem de IA (não diga "Conforme solicitado", "Identifiquei que", "A condição foi atendida"). Seja analítico e direto como um briefing executivo.

Responda ESTRITAMENTE em formato JSON puro (sem marcações markdown extras):
{
  "condition_met": boolean,
  "summary": string (manchete executiva principal em 1 frase em português do Brasil),
  "paragraphs": [string, string, string] (array de 2 a 3 parágrafos detalhados em português do Brasil),
  "current_data": string (dados resumidos em tópicos factuais),
  "simulated_notification": string (alerta curto e chamativo para push notification),
  "confidence": number (0-100),
  "why_relevant": string (1 frase explicando a relevância imediata para o usuário em português),
  "urgency": string ("high" se for queda histórica de preço, cupom urgente ou notícia de impacto imediato; senão "low")
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

	return ParseTriggerEvalResult(rawText, t)
}
