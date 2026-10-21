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

// NewGroqProvider instancia o provedor para o Groq Cloud.
func NewGroqProvider(apiKey, model string) *OpenAICompatProvider {
	if model == "" {
		// Mesmo default de GROQ_MODEL em config.go (llama-3.3 aposentado em 08/2026).
		model = "openai/gpt-oss-20b"
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
	return false
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

	reqBody := openAIChatRequest{
		Model: p.model,
		Messages: []openAIChatMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userContent},
		},
		ResponseFormat: &struct {
			Type string `json:"type"`
		}{Type: "json_object"},
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

	systemPrompt := fmt.Sprintf(`Você é o Vito, assistente de inteligência autônoma e monitoramento executivo do usuário.
Sua missão é avaliar uma vigília/radar cadastrado pelo usuário e trazer as NOTÍCIAS MAIS RECENTES sobre o tema, nunca um panorama genérico ou histórico.
DATA ATUAL DO SISTEMA: %s (Mês/Ano: %s).
DIRETRIZES DE LOCALIZAÇÃO, IDIOMA E ATUALIDADE:
1. IDIOMA E LOCALIZAÇÃO MANDATÓRIOS: Responda 100%% em PORTUGUÊS DO BRASIL (pt-BR). É EXPRESSAMENTE PROIBIDO gerar texto em inglês. Todos os preços DEVEM ser em Reais (R$) e voltados para o mercado brasileiro.
2. ATENÇÃO CRÍTICA À ATUALIDADE: Estamos em %s. As notícias e preços DEVEM ser de hoje ou dos últimos dias do mês atual. PROIBIDO trazer notícias de meses anteriores.
3. SE FOR MONITORAMENTO DE PRODUTO OU PREÇO:
   - Pesquise exclusivamente lojas confiáveis que operam no Brasil (ex: Mercado Livre, Amazon Brasil, KaBuM!, Magazine Luiza, Casas Bahia, Fast Shop, Promobit).
   - Discrimine obrigatoriamente: o menor preço à vista no PIX com desconto, preço no DÉBITO e opções de parcelamento sem juros no CARTÃO DE CRÉDITO (ex: até 10x ou 12x).
4. ESTRUTURA DOS PARÁGRAFOS (campo "paragraphs"):
   Gere de 2 a 3 parágrafos analíticos completos e substanciais:
   - Parágrafo 1: Notícia e fato central do dia, contextualizando a vigília e variação em relação ao histórico.
   - Parágrafo 2: Dados detalhados e concretos (se produto: lojas, preços Pix, débito e parcelado; se notícias/viagens: números, companhias, linhas ou datas de impacto).
   - Parágrafo 3: Análise prática e recomendação executiva para o usuário (se vale a pena comprar hoje, esperar ou tomar uma ação preventiva).
5. REGRA ANTI-SLOP: NUNCA use metalinguagem de IA (não diga "Conforme monitorado", "A condição foi atendida").
Responda EXCLUSIVAMENTE em formato JSON puro, sem markdown delimitador:
{
  "condition_met": true,
  "summary": "manchete executiva principal em 1 frase em português do Brasil",
  "paragraphs": ["Parágrafo 1...", "Parágrafo 2...", "Parágrafo 3..."],
  "current_data": "dados resumidos em tópicos factuais",
  "simulated_notification": "título curto e impactante da notificação de alerta",
  "confidence": 0-100,
  "why_relevant": "1 frase explicando por que é relevante para a vigília em português",
  "urgency": "high se for queda histórica de preço, cupom urgente ou notícia de impacto imediato; senão low"
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
	return ParseTriggerEvalResult(rawText, t)
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
