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
		model = "google/gemini-2.0-flash-exp:free"
	}
	return &OpenAICompatProvider{
		providerName: "OpenRouter (" + model + ")",
		baseURL:      "https://openrouter.ai/api/v1/chat/completions",
		apiKey:       apiKey,
		model:        model,
		httpClient:   &http.Client{Timeout: 20 * time.Second},
	}
}

// NewGroqProvider instancia o provedor para o Groq Cloud.
func NewGroqProvider(apiKey, model string) *OpenAICompatProvider {
	if model == "" {
		model = "llama-3.3-70b-versatile"
	}
	return &OpenAICompatProvider{
		providerName: "Groq (" + model + ")",
		baseURL:      "https://api.groq.com/openai/v1/chat/completions",
		apiKey:       apiKey,
		model:        model,
		httpClient:   &http.Client{Timeout: 20 * time.Second},
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
