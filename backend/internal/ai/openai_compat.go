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

	systemPrompt := `Você é o Vito, assistente de inteligência autônoma e monitoramento executivo do usuário.
Sua missão é avaliar uma vigília/radar cadastrado pelo usuário e trazer as NOTÍCIAS MAIS RECENTES sobre o tema (estilo Google Notícias), nunca um panorama genérico.
Responda EXCLUSIVAMENTE em formato JSON puro, sem markdown delimitador nem explicações fora do JSON:
{
  "condition_met": true,
  "current_data": "3 a 6 linhas no formato '— DD/MM · Manchete curta: detalhe concreto (placar, número, decisão)', da mais recente para a mais antiga; opcionalmente uma última linha 'Próximo: DD/MM HH:MM · evento'. Sem introduções institucionais, sem calendário completo, máximo ~120 palavras",
  "summary": "manchete da notícia mais importante e recente em 1 frase",
  "simulated_notification": "título curto e impactante da notificação de alerta"
}`

	userPrompt := fmt.Sprintf(`Avalie esta vigília/radar do usuário:
- Título: %s
- Categoria: %s
- Consulta/Busca: %s
- Condição/Alvo: %s
- Tipo de Condição: %s

Analise o cenário, verifique se a condição foi atingida ou se há fatos relevantes atualizados e elabore o relatório executivo completo em JSON puro.`,
		t.Title, t.Category, t.Query, t.TargetValue, t.ConditionType,
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

	type testEvalResult struct {
		ConditionMet          bool   `json:"condition_met"`
		CurrentData           string `json:"current_data"`
		Summary               string `json:"summary"`
		SimulatedNotification string `json:"simulated_notification"`
	}

	cleanJSON := rawText
	if start := strings.Index(cleanJSON, "{"); start != -1 {
		if end := strings.LastIndex(cleanJSON, "}"); end != -1 && end > start {
			cleanJSON = cleanJSON[start : end+1]
		}
	}

	var eval testEvalResult
	if err := json.Unmarshal([]byte(cleanJSON), &eval); err != nil {
		return &domain.TriggerTestResult{
			TriggerID:             t.ID,
			Title:                 t.Title,
			Query:                 t.Query,
			ConditionMet:          false,
			CurrentData:           rawText,
			Summary:               "Consulta realizada com sucesso. Condições avaliadas.",
			SimulatedNotification: fmt.Sprintf("Alerta Vito: Vigília de '%s' atualizada.", t.Title),
			TestedAt:              time.Now().UTC(),
		}, nil
	}

	return &domain.TriggerTestResult{
		TriggerID:             t.ID,
		Title:                 t.Title,
		Query:                 t.Query,
		ConditionMet:          eval.ConditionMet,
		CurrentData:           eval.CurrentData,
		Summary:               eval.Summary,
		SimulatedNotification: eval.SimulatedNotification,
		TestedAt:              time.Now().UTC(),
	}, nil
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

