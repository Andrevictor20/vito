package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/domain"
	"io"
	"net/http"
	"strings"
	"time"
)

// OpenAICompatProvider atende OpenRouter, Groq e qualquer API compatível com OpenAI.
type OpenAICompatProvider struct {
	providerName string
	baseURL      string
	apiKey       string
	model        string
	httpClient   *http.Client
	// visionCapable marca a instância como capaz de ler imagens. Só o elo de
	// visão (OpenRouter servindo um modelo multimodal) recebe a marca: Groq e
	// Mistral devolveram 404 para os modelos de visão disponíveis.
	visionCapable bool
}

// NewOpenRouterProvider instancia o provedor para o OpenRouter (com modelos :free).
func NewOpenRouterProvider(apiKey, model string) *OpenAICompatProvider {
	if model == "" {
		model = "nvidia/nemotron-3.5-lightning:free"
	}
	return &OpenAICompatProvider{
		providerName: "OpenRouter (" + model + ")",
		baseURL:      "https://openrouter.ai/api/v1/chat/completions",
		apiKey:       apiKey,
		model:        model,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

// NewOpenRouterVisionProvider instancia o elo de visão via OpenRouter.
//
// Existe para dar redundância real à leitura de imagens: a cota do Google AI
// Studio (20 req/dia no free tier) é compartilhada por todos os modelos do
// Gemini, enquanto o OpenRouter tem cota própria.
func NewOpenRouterVisionProvider(apiKey, model string) *OpenAICompatProvider {
	if model == "" {
		model = "google/gemini-3.5-flash-lite"
	}
	p := NewOpenRouterProvider(apiKey, model)
	p.providerName = "OpenRouter Visão (" + model + ")"
	p.visionCapable = true
	return p
}

// NewGroqProvider instancia o provedor para o Groq Cloud.
func NewGroqProvider(apiKey, model string) *OpenAICompatProvider {
	if model == "" {
		model = "qwen/qwen3.8-27b"
	}
	return &OpenAICompatProvider{
		providerName: "Groq (" + model + ")",
		baseURL:      "https://api.groq.com/openai/v1/chat/completions",
		apiKey:       apiKey,
		model:        model,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

// NewMistralProvider instancia o provedor para o Mistral La Plateforme
// (4º elo: free mode sem cartão, IDs 2512).
func NewMistralProvider(apiKey, model string) *OpenAICompatProvider {
	if model == "" {
		// Mesmo default de MISTRAL_MODEL em config.go.
		model = "ministral-8b-latest"
	}
	return &OpenAICompatProvider{
		providerName: "Mistral (" + model + ")",
		baseURL:      "https://api.mistral.ai/v1/chat/completions",
		apiKey:       apiKey,
		model:        model,
		httpClient:   &http.Client{Timeout: 30 * time.Second},
	}
}

// NewOpenAICompatProviderForTest cria uma instância com cliente customizado para testes.
func NewOpenAICompatProviderForTest(name, baseURL, apiKey, model string, client *http.Client) *OpenAICompatProvider {
	if client == nil {
		client = &http.Client{Timeout: 5 * time.Second}
	}
	return &OpenAICompatProvider{
		providerName: name,
		baseURL:      baseURL,
		apiKey:       apiKey,
		model:        model,
		httpClient:   client,
	}
}

func (p *OpenAICompatProvider) Name() string {
	return p.providerName
}

func (p *OpenAICompatProvider) SupportsVision() bool {
	return p.visionCapable
}

func (p *OpenAICompatProvider) SupportsAudio() bool {
	return false
}

type openAIChatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type openAIChatRequest struct {
	Model          string              `json:"model"`
	Messages       []openAIChatMessage `json:"messages"`
	ResponseFormat *struct {
		Type string `json:"type"`
	} `json:"response_format,omitempty"`
	MaxTokens int `json:"max_tokens,omitempty"`
}

type openAIChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

func (p *OpenAICompatProvider) ParseIntent(ctx context.Context, input UserInput) (*ParsedIntent, error) {
	if p.apiKey == "" {
		return nil, errors.New("chave de api não configurada para " + p.providerName)
	}

	systemPrompt := BuildSystemPromptFromInput(input)
	userContent := SanitizeUntrustedInput(input.Text)
	if userContent == "" && input.AudioB64 != "" {
		return nil, errors.New("áudio direto não suportado por este provedor, requer transcrição prévia")
	}

	// Elo de visão: imagem vai no formato multimodal da API (data URL).
	if input.ImageB64 != "" {
		if !p.visionCapable {
			return nil, errors.New("imagem não suportada por este provedor: " + p.providerName)
		}
		return p.parseVisionIntent(ctx, systemPrompt, userContent, input.ImageB64, input.ImageMime)
	}

	maxTokens := 1024
	// Proteção contra limites no Groq (limite de 1000 OTPM e 8000 TPM no tier gratuito).
	if strings.Contains(strings.ToLower(p.baseURL), "groq.com") {
		maxTokens = 800
		if len(systemPrompt) > 14000 {
			systemPrompt = systemPrompt[:14000]
		}
	}

	reqBody := openAIChatRequest{
		Model: p.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userContent},
		},
		ResponseFormat: &struct {
			Type string `json:"type"`
		}{Type: "json_object"},
		MaxTokens: maxTokens,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "vito-assistant/1.0")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var chatResp openAIChatResponse
	if err := json.Unmarshal(bodyBytes, &chatResp); err != nil {
		return nil, err
	}

	if chatResp.Error != nil {
		return nil, errors.New(chatResp.Error.Message)
	}

	if len(chatResp.Choices) == 0 {
		return nil, errors.New("nenhuma resposta gerada")
	}

	content := strings.TrimSpace(chatResp.Choices[0].Message.Content)
	var intent ParsedIntent
	if err := UnmarshalIntent(content, &intent); err != nil {
		return nil, fmt.Errorf("falha ao interpretar json do provedor: %w", err)
	}

	return &intent, nil
}

// EvaluateTrigger avalia uma vigília/radar utilizando modelos compatíveis com a API do OpenAI (Groq / OpenRouter).
func (p *OpenAICompatProvider) EvaluateTrigger(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	if p.apiKey == "" {
		return nil, errors.New("chave de api não configurada para " + p.providerName)
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

	systemPrompt := fmt.Sprintf(`Você é o Vito, assistente de inteligência autônoma e monitoramento executivo do usuário.
Sua missão é avaliar uma vigília/radar cadastrado pelo usuário e trazer as NOTÍCIAS MAIS RECENTES sobre o tema, nunca um panorama genérico ou histórico.
DATA ATUAL DO SISTEMA: %s (Mês/Ano: %s).
DIRETRIZES DE LOCALIZAÇÃO, IDIOMA E ATUALIDADE:
1. IDIOMA E LOCALIZAÇÃO MANDATÓRIOS: Responda 100%% em PORTUGUÊS DO BRASIL (pt-BR). É EXPRESSAMENTE PROIBIDO gerar texto em inglês. Todos os preços DEVEM ser em Reais (R$) e voltados para o mercado brasileiro.
2. ATENÇÃO CRÍTICA À ATUALIDADE: Estamos em %s. As notícias e preços DEVEM ser de hoje ou dos últimos dias do mês atual. PROIBIDO trazer notícias de meses anteriores.
3. SE FOR TIME OU EVENTO ESPORTIVO (ex: jogos do Flamengo, futebol):
   - Priorize OBRIGATORIAMENTE o ÚLTIMO JOGO DISPUTADO com placar exato (ex: "Flamengo 2 x 1 Racing", data e campeonato).
   - Defina "metric_label": "Último Jogo" e "metric_value": "Time X x Y Adversário" com o placar concreto.
   - Traga também a data/horário do PRÓXIMO jogo se disponível.
4. SE FOR MONITORAMENTO DE PRODUTO, APARELHO OU PREÇO (ex: smartphone, Poco X8 Pro Max, eletrônicos):
   - BASEIE-SE EXCLUSIVAMENTE em preços reais de venda dos principais marketplaces e e-commerces brasileiros (Mercado Livre, KaBuM!, Amazon Brasil, Magazine Luiza, Casas Bahia, Shopee).
   - SANIDADE DE PREÇO E ANTI-ANOMALIA:
     a) O preço DEVE ser do APARELHO PRINCIPAL (novo, original e lacrado). NUNCA traga preços de capas, películas, carregadores, cabos, peças de reposição ou aparelhos recondicionados/usados.
     b) Jamais aceite valores discrepantes fora da realidade de mercado (ex: R$ 1.199 para um smartphone intermediário-premium/topo como Poco X8 Pro Max, cuja faixa de mercado real é de R$ 2.600 a R$ 3.900). Se encontrar ofertas irreais de sites de concursos ou blogs caça-cliques, IGNORE-AS categoricamente.
     c) Defina "metric_label": "Menor Preço" e "metric_value": valor em R$ (ex: "R$ 3.128" ou "R$ 3.249").
     d) No array "bullets", liste os preços concretos nas lojas pesquisadas com as condições reais (ex: "A partir de R$ 3.128 no Mercado Livre à vista no Pix", "R$ 3.300 na KaBuM! com parcelamento em 10x sem juros", "R$ 3.468 na Amazon Brasil").
     e) Em "sources", inclua as lojas reais com nomes e URLs legítimas.
5. ESCANEABILIDADE E ZERO PAREDES DE TEXTO:
   - "summary": manchete executiva principal em 1 linha (máx 100 caracteres).
   - "bullets": array com 2 a 3 tópicos factuais curtos e diretos (máximo 120 caracteres por item). PROIBIDO parágrafos longos ou texto corrido maçante.
6. REGRA ANTI-SLOP: NUNCA use metalinguagem de IA (não diga "Conforme monitorado", "A condição foi atendida"). Seja direto e conciso.

Responda EXCLUSIVAMENTE em formato JSON puro, sem markdown delimitador:
{
  "condition_met": true,
  "summary": "manchete executiva principal em 1 frase em português do Brasil",
  "metric_label": "rótulo curto como Último Jogo, Menor Preço, Status",
  "metric_value": "valor ou placar em destaque como Flamengo 2 x 1 Adversário ou R$ 3.128",
  "bullets": ["tópico factual 1 (máx 120 chars)", "tópico factual 2 (máx 120 chars)"],
  "current_data": "dados resumidos em tópicos factuais",
  "simulated_notification": "título curto e impactante da notificação de alerta",
  "confidence": 0-100,
  "why_relevant": "1 frase explicando por que é relevante para a vigília em português",
  "urgency": "breaking ou high se for gol, vitória/derrota recente, queda histórica de preço ou notícia urgente; senão low",
  "sources": [
    {"name": "Mercado Livre", "title": "Xiaomi Poco X8 Pro Max", "url": "https://www.mercadolivre.com.br"}
  ]
}`, nowStr, currentMonthYear, currentMonthYear)

	userPrompt := fmt.Sprintf(`Avalie esta vigília/radar do usuário:
- Título: %s
- Categoria: %s
- Consulta/Busca: %s
- Condição/Alvo: %s
- Tipo de Condição: %s
- Data de Referência: %s
%s
Analise o cenário, verifique se a condição foi atingida ou se há fatos relevantes atualizados e elabore o relatório executivo completo em JSON puro baseado nos fatos mais recentes.`,
		t.Title, t.Category, t.Query, t.TargetValue, t.ConditionType, nowStr, realtimeBlock,
	)

	reqBody := openAIChatRequest{
		Model: p.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		ResponseFormat: &struct {
			Type string `json:"type"`
		}{Type: "json_object"},
		MaxTokens: 2048,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "vito-assistant/1.0")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var chatResp openAIChatResponse
	if err := json.Unmarshal(bodyBytes, &chatResp); err != nil {
		return nil, err
	}
	if chatResp.Error != nil {
		return nil, errors.New(chatResp.Error.Message)
	}
	if len(chatResp.Choices) == 0 {
		return nil, errors.New("nenhuma resposta gerada")
	}

	rawText := strings.TrimSpace(chatResp.Choices[0].Message.Content)
	res, err := ParseTriggerEvalResult(rawText, t)
	if err != nil {
		return nil, err
	}
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

// GenerateText sintetiza textos e resumos executivos via OpenAICompatProvider.
func (p *OpenAICompatProvider) GenerateText(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	if p.apiKey == "" {
		return "", errors.New("chave de api não configurada para " + p.providerName)
	}

	reqBody := openAIChatRequest{
		Model: p.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userPrompt},
		},
		MaxTokens: 2048,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "vito-assistant/1.0")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var chatResp openAIChatResponse
	if err := json.Unmarshal(bodyBytes, &chatResp); err != nil {
		return "", err
	}
	if chatResp.Error != nil {
		return "", errors.New(chatResp.Error.Message)
	}
	if len(chatResp.Choices) == 0 {
		return "", errors.New("nenhuma resposta gerada")
	}

	return strings.TrimSpace(chatResp.Choices[0].Message.Content), nil
}
