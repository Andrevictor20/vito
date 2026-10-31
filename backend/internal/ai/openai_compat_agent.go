package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// OpenAICompatAgentProvider implementa AgentProvider para endpoints compatíveis com OpenAI/OpenRouter/Groq.
type OpenAICompatAgentProvider struct {
	name             string
	model            string
	endpoint         string
	apiKey           string
	qualityTier      int
	supportsTools    bool
	supportsVision   bool
	maxContextTokens int
	client           *http.Client
}

// NewOpenAICompatAgentProvider cria uma nova instância de AgentProvider compatível com a API OpenAI.
func NewOpenAICompatAgentProvider(
	name, model, endpoint, apiKey string,
	tier int,
	tools, vision bool,
	maxTokens int,
) *OpenAICompatAgentProvider {
	if tier <= 0 {
		tier = 1
	}
	if maxTokens <= 0 {
		maxTokens = 8192
	}
	return &OpenAICompatAgentProvider{
		name:             name,
		model:            model,
		endpoint:         endpoint,
		apiKey:           apiKey,
		qualityTier:      tier,
		supportsTools:    tools,
		supportsVision:   vision,
		maxContextTokens: maxTokens,
		client:           &http.Client{Timeout: 60 * time.Second},
	}
}

func (p *OpenAICompatAgentProvider) Name() string          { return p.name }
func (p *OpenAICompatAgentProvider) ModelName() string     { return p.model }
func (p *OpenAICompatAgentProvider) QualityTier() int      { return p.qualityTier }
func (p *OpenAICompatAgentProvider) SupportsTools() bool   { return p.supportsTools }
func (p *OpenAICompatAgentProvider) SupportsVision() bool  { return p.supportsVision }
func (p *OpenAICompatAgentProvider) MaxContextTokens() int { return p.maxContextTokens }

type openAIToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

type openAIMessage struct {
	Role       string           `json:"role"`
	Content    string           `json:"content,omitempty"`
	ToolCalls  []openAIToolCall `json:"tool_calls,omitempty"`
	ToolCallID string           `json:"tool_call_id,omitempty"`
	Name       string           `json:"name,omitempty"`
}

type openAIToolDef struct {
	Type     string         `json:"type"`
	Function ToolDefinition `json:"function"`
}

type openAIRequest struct {
	Model       string          `json:"model"`
	Messages    []openAIMessage `json:"messages"`
	Tools       []openAIToolDef `json:"tools,omitempty"`
	Stream      bool            `json:"stream,omitempty"`
	Temperature *float64        `json:"temperature,omitempty"`
	MaxTokens   int             `json:"max_tokens,omitempty"`
}

func (p *OpenAICompatAgentProvider) buildMessages(req AgentChatRequest) []openAIMessage {
	var msgs []openAIMessage
	if req.SystemPrompt != "" {
		msgs = append(msgs, openAIMessage{
			Role:    "system",
			Content: req.SystemPrompt,
		})
	}

	for _, m := range req.Messages {
		om := openAIMessage{
			Role:       string(m.Role),
			Content:    m.Content,
			ToolCallID: m.ToolCallID,
			Name:       m.Name,
		}
		if len(m.ToolCalls) > 0 {
			for _, tc := range m.ToolCalls {
				om.ToolCalls = append(om.ToolCalls, openAIToolCall{
					ID:   tc.ID,
					Type: "function",
					Function: struct {
						Name      string `json:"name"`
						Arguments string `json:"arguments"`
					}{
						Name:      tc.Name,
						Arguments: string(tc.Arguments),
					},
				})
			}
		}
		msgs = append(msgs, om)
	}
	return msgs
}

// Chat executa uma chamada síncrona com fallback graceful.
func (p *OpenAICompatAgentProvider) Chat(ctx context.Context, req AgentChatRequest) (*AgentChatResponse, error) {
	start := time.Now()
	payload := openAIRequest{
		Model:       p.model,
		Messages:    p.buildMessages(req),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		Stream:      false,
	}

	if p.supportsTools && len(req.Tools) > 0 {
		for _, t := range req.Tools {
			payload.Tools = append(payload.Tools, openAIToolDef{
				Type:     "function",
				Function: t,
			})
		}
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("erro ao serializar request OpenAI: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API OpenAI retornou status %d: %s", resp.StatusCode, string(respBody))
	}

	var parsed struct {
		Choices []struct {
			Message struct {
				Role      string           `json:"role"`
				Content   string           `json:"content"`
				ToolCalls []openAIToolCall `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
		} `json:"usage"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("erro ao decodificar resposta: %w", err)
	}

	agentResp := &AgentChatResponse{
		ProviderName: p.name,
		ModelName:    p.model,
		TokensIn:     parsed.Usage.PromptTokens,
		TokensOut:    parsed.Usage.CompletionTokens,
		LatencyMs:    time.Since(start).Milliseconds(),
	}

	if len(parsed.Choices) > 0 {
		msg := parsed.Choices[0].Message
		agentResp.Text = msg.Content
		for _, tc := range msg.ToolCalls {
			agentResp.ToolCalls = append(agentResp.ToolCalls, ToolCall{
				ID:        tc.ID,
				Name:      tc.Function.Name,
				Arguments: json.RawMessage(tc.Function.Arguments),
			})
		}
	}

	return agentResp, nil
}

// StreamChat executa streaming SSE processando fragmentos de texto e tool calls.
func (p *OpenAICompatAgentProvider) StreamChat(ctx context.Context, req AgentChatRequest, onDelta func(StreamDelta) error) (*AgentChatResponse, error) {
	if onDelta == nil {
		return p.Chat(ctx, req)
	}

	start := time.Now()
	payload := openAIRequest{
		Model:       p.model,
		Messages:    p.buildMessages(req),
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		Stream:      true,
	}

	if p.supportsTools && len(req.Tools) > 0 {
		for _, t := range req.Tools {
			payload.Tools = append(payload.Tools, openAIToolDef{
				Type:     "function",
				Function: t,
			})
		}
	}

	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("erro ao serializar request OpenAI: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", p.endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	if p.apiKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+p.apiKey)
	}

	resp, err := p.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("API OpenAI stream retornou status %d: %s", resp.StatusCode, string(respBody))
	}

	scanner := bufio.NewScanner(resp.Body)
	var fullText strings.Builder
	toolCallsMap := make(map[int]*openAIToolCall)

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			break
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content   string `json:"content"`
					ToolCalls []struct {
						Index    int    `json:"index"`
						ID       string `json:"id"`
						Function struct {
							Name      string `json:"name"`
							Arguments string `json:"arguments"`
						} `json:"function"`
					} `json:"tool_calls"`
				} `json:"delta"`
			} `json:"choices"`
		}

		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if len(chunk.Choices) > 0 {
			choice := chunk.Choices[0]
			if choice.Delta.Content != "" {
				fullText.WriteString(choice.Delta.Content)
				_ = onDelta(StreamDelta{
					TextDelta: choice.Delta.Content,
				})
			}
			for _, tc := range choice.Delta.ToolCalls {
				idx := tc.Index
				if _, ok := toolCallsMap[idx]; !ok {
					toolCallsMap[idx] = &openAIToolCall{
						ID:   tc.ID,
						Type: "function",
					}
				}
				if tc.ID != "" {
					toolCallsMap[idx].ID = tc.ID
				}
				if tc.Function.Name != "" {
					toolCallsMap[idx].Function.Name += tc.Function.Name
				}
				if tc.Function.Arguments != "" {
					toolCallsMap[idx].Function.Arguments += tc.Function.Arguments
				}
			}
		}
	}

	var parsedToolCalls []ToolCall
	for i := 0; i < len(toolCallsMap); i++ {
		if tc, ok := toolCallsMap[i]; ok {
			parsedToolCalls = append(parsedToolCalls, ToolCall{
				ID:        tc.ID,
				Name:      tc.Function.Name,
				Arguments: json.RawMessage(tc.Function.Arguments),
			})
		}
	}

	finalResp := &AgentChatResponse{
		Text:         fullText.String(),
		ToolCalls:    parsedToolCalls,
		ProviderName: p.name,
		ModelName:    p.model,
		LatencyMs:    time.Since(start).Milliseconds(),
	}

	_ = onDelta(StreamDelta{
		Done:         true,
		FinalMetrics: finalResp,
	})

	return finalResp, nil
}
