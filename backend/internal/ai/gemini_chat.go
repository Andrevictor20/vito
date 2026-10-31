package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// GeminiAgentProvider implementa a interface ai.AgentProvider para a API oficial do Google AI Studio.
type GeminiAgentProvider struct {
	apiKey     string
	model      string
	baseURL    string
	httpClient *http.Client
}

// NewGeminiAgentProvider cria uma nova instância de AgentProvider para o Google AI Studio.
func NewGeminiAgentProvider(apiKey, model string) *GeminiAgentProvider {
	if model == "" {
		model = "gemini-2.5-flash"
	}
	return &GeminiAgentProvider{
		apiKey:  apiKey,
		model:   model,
		baseURL: "https://generativelanguage.googleapis.com",
		httpClient: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// NewGeminiAgentProviderForTest instancia o provedor com endpoint e cliente customizados para httptest.Server.
func NewGeminiAgentProviderForTest(apiKey, model, baseURL string, client *http.Client) *GeminiAgentProvider {
	if model == "" {
		model = "gemini-2.5-flash"
	}
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	return &GeminiAgentProvider{
		apiKey:     apiKey,
		model:      model,
		baseURL:    baseURL,
		httpClient: client,
	}
}

func (p *GeminiAgentProvider) Name() string          { return "Google AI Studio (" + p.model + ")" }
func (p *GeminiAgentProvider) ModelName() string     { return p.model }
func (p *GeminiAgentProvider) QualityTier() int      { return 3 } // Alto (Gemini 2.5 Flash)
func (p *GeminiAgentProvider) SupportsTools() bool   { return true }
func (p *GeminiAgentProvider) SupportsVision() bool  { return true }
func (p *GeminiAgentProvider) MaxContextTokens() int { return 32768 }

type geminiChatPart struct {
	Text             string                  `json:"text,omitempty"`
	InlineData       *geminiInlineData       `json:"inlineData,omitempty"`
	FunctionCall     *geminiFunctionCallPart `json:"functionCall,omitempty"`
	FunctionResponse *geminiFunctionRespPart `json:"functionResponse,omitempty"`
}

type geminiFunctionCallPart struct {
	Name string          `json:"name"`
	Args json.RawMessage `json:"args,omitempty"`
}

type geminiFunctionRespPart struct {
	Name     string          `json:"name"`
	Response json.RawMessage `json:"response"`
}

type geminiChatContent struct {
	Role  string           `json:"role"`
	Parts []geminiChatPart `json:"parts"`
}

type geminiFunctionDecl struct {
	Name        string          `json:"name"`
	Description string          `json:"description,omitempty"`
	Parameters  json.RawMessage `json:"parameters,omitempty"`
}

type geminiChatTool struct {
	FunctionDeclarations []geminiFunctionDecl `json:"functionDeclarations,omitempty"`
}

type geminiChatGenConfig struct {
	Temperature     *float64              `json:"temperature,omitempty"`
	MaxOutputTokens int                   `json:"maxOutputTokens,omitempty"`
	ThinkingConfig  *geminiThinkingConfig `json:"thinkingConfig,omitempty"`
}

type geminiChatRequest struct {
	SystemInstruction *geminiChatContent  `json:"systemInstruction,omitempty"`
	Contents          []geminiChatContent `json:"contents"`
	Tools             []geminiChatTool    `json:"tools,omitempty"`
	GenerationConfig  geminiChatGenConfig `json:"generationConfig"`
}

type geminiCandidatePart struct {
	Text         string                  `json:"text,omitempty"`
	FunctionCall *geminiFunctionCallPart `json:"functionCall,omitempty"`
}

type geminiChatCandidate struct {
	Content struct {
		Role  string                `json:"role"`
		Parts []geminiCandidatePart `json:"parts"`
	} `json:"content"`
	FinishReason string `json:"finishReason,omitempty"`
}

type geminiUsageMetadata struct {
	PromptTokenCount     int `json:"promptTokenCount"`
	CandidatesTokenCount int `json:"candidatesTokenCount"`
	TotalTokenCount      int `json:"totalTokenCount"`
}

type geminiChatResponse struct {
	Candidates    []geminiChatCandidate `json:"candidates"`
	UsageMetadata *geminiUsageMetadata  `json:"usageMetadata,omitempty"`
	Error         *struct {
		Code    int    `json:"code"`
		Message string `json:"message"`
		Status  string `json:"status"`
	} `json:"error,omitempty"`
}

func (p *GeminiAgentProvider) buildRequest(req AgentChatRequest) geminiChatRequest {
	var gReq geminiChatRequest

	if req.SystemPrompt != "" {
		gReq.SystemInstruction = &geminiChatContent{
			Role:  "system",
			Parts: []geminiChatPart{{Text: req.SystemPrompt}},
		}
	}

	for _, m := range req.Messages {
		content := geminiChatContent{}
		switch m.Role {
		case RoleUser:
			content.Role = "user"
			if m.Content != "" {
				content.Parts = append(content.Parts, geminiChatPart{Text: m.Content})
			}
			if len(m.ImageBytes) > 0 {
				mime := m.ImageMIME
				if mime == "" {
					mime = "image/jpeg"
				}
				content.Parts = append(content.Parts, geminiChatPart{
					InlineData: &geminiInlineData{
						MimeType: mime,
						Data:     base64.StdEncoding.EncodeToString(m.ImageBytes),
					},
				})
			}
		case RoleAssistant:
			content.Role = "model"
			if m.Content != "" {
				content.Parts = append(content.Parts, geminiChatPart{Text: m.Content})
			}
			for _, tc := range m.ToolCalls {
				content.Parts = append(content.Parts, geminiChatPart{
					FunctionCall: &geminiFunctionCallPart{
						Name: tc.Name,
						Args: tc.Arguments,
					},
				})
			}
		case RoleTool:
			content.Role = "function"
			respObj := map[string]any{
				"name":    m.Name,
				"content": m.Content,
			}
			rawResp, _ := json.Marshal(respObj)
			content.Parts = append(content.Parts, geminiChatPart{
				FunctionResponse: &geminiFunctionRespPart{
					Name:     m.Name,
					Response: rawResp,
				},
			})
		case RoleSystem:
			if gReq.SystemInstruction == nil {
				gReq.SystemInstruction = &geminiChatContent{
					Role:  "system",
					Parts: []geminiChatPart{{Text: m.Content}},
				}
				continue
			}
			content.Role = "user"
			content.Parts = append(content.Parts, geminiChatPart{Text: "[Contexto do Sistema]: " + m.Content})
		}
		if len(content.Parts) > 0 {
			gReq.Contents = append(gReq.Contents, content)
		}
	}

	if len(req.Tools) > 0 {
		var fns []geminiFunctionDecl
		for _, t := range req.Tools {
			fns = append(fns, geminiFunctionDecl{
				Name:        t.Name,
				Description: t.Description,
				Parameters:  t.Parameters,
			})
		}
		gReq.Tools = []geminiChatTool{{FunctionDeclarations: fns}}
	}

	gReq.GenerationConfig.Temperature = req.Temperature
	gReq.GenerationConfig.MaxOutputTokens = req.MaxTokens
	if strings.Contains(p.model, "2.5") {
		gReq.GenerationConfig.ThinkingConfig = &geminiThinkingConfig{ThinkingBudget: 0}
	}

	return gReq
}

func (p *GeminiAgentProvider) modelsChain() []string {
	chain := []string{p.model, "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"}
	var res []string
	seen := make(map[string]bool)
	for _, m := range chain {
		m = strings.TrimSpace(m)
		if m != "" && !seen[m] {
			seen[m] = true
			res = append(res, m)
		}
	}
	return res
}

// Chat executa uma chamada síncrona convertendo tools e responses do Gemini.
func (p *GeminiAgentProvider) Chat(ctx context.Context, req AgentChatRequest) (*AgentChatResponse, error) {
	start := time.Now()
	gReq := p.buildRequest(req)
	bodyBytes, err := json.Marshal(gReq)
	if err != nil {
		return nil, fmt.Errorf("falha ao serializar requisição gemini: %w", err)
	}

	var lastErr error
	models := p.modelsChain()

	for _, modelName := range models {
		reqURL := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", p.baseURL, modelName, p.apiKey)
		httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
		if err != nil {
			return nil, err
		}
		httpReq.Header.Set("Content-Type", "application/json")

		resp, err := p.httpClient.Do(httpReq)
		if err != nil {
			lastErr = err
			continue
		}

		respBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("falha ao ler corpo da resposta: %w", err)
			continue
		}

		// Se cota excedida (429) ou modelo indisponível (404), tenta o próximo modelo da cadeia
		if resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusNotFound {
			lastErr = fmt.Errorf("gemini status %d em %s: %s", resp.StatusCode, modelName, string(respBytes))
			continue
		}

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, fmt.Errorf("api gemini retornou status %d: %s", resp.StatusCode, string(respBytes))
		}

		var gResp geminiChatResponse
		if err := json.Unmarshal(respBytes, &gResp); err != nil {
			return nil, fmt.Errorf("falha ao decodificar json gemini: %w", err)
		}
		if gResp.Error != nil {
			if gResp.Error.Code == 429 || gResp.Error.Code == 404 {
				lastErr = fmt.Errorf("gemini api error (%d): %s", gResp.Error.Code, gResp.Error.Message)
				continue
			}
			return nil, fmt.Errorf("gemini api error (%d): %s", gResp.Error.Code, gResp.Error.Message)
		}

		agentResp := &AgentChatResponse{
			ProviderName: p.Name(),
			ModelName:    modelName,
			LatencyMs:    time.Since(start).Milliseconds(),
		}

		if gResp.UsageMetadata != nil {
			agentResp.TokensIn = gResp.UsageMetadata.PromptTokenCount
			agentResp.TokensOut = gResp.UsageMetadata.CandidatesTokenCount
		}

		if len(gResp.Candidates) > 0 {
			cand := gResp.Candidates[0]
			for i, part := range cand.Content.Parts {
				if part.Text != "" {
					agentResp.Text += part.Text
				}
				if part.FunctionCall != nil {
					agentResp.ToolCalls = append(agentResp.ToolCalls, ToolCall{
						ID:        fmt.Sprintf("call_%s_%d", part.FunctionCall.Name, i+1),
						Name:      part.FunctionCall.Name,
						Arguments: part.FunctionCall.Args,
					})
				}
			}
		}

		return agentResp, nil
	}

	return nil, fmt.Errorf("todos os modelos gemini falharam: %w", lastErr)
}

// StreamChat executa streaming SSE processando fragmentos de texto e tool calls.
func (p *GeminiAgentProvider) StreamChat(ctx context.Context, req AgentChatRequest, onDelta func(StreamDelta) error) (*AgentChatResponse, error) {
	if onDelta == nil {
		return p.Chat(ctx, req)
	}

	start := time.Now()
	gReq := p.buildRequest(req)
	bodyBytes, err := json.Marshal(gReq)
	if err != nil {
		return nil, fmt.Errorf("falha ao serializar requisição gemini stream: %w", err)
	}

	reqURL := fmt.Sprintf("%s/v1beta/models/%s:streamGenerateContent?alt=sse&key=%s", p.baseURL, p.model, p.apiKey)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, reqURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		respBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("api gemini stream retornou status %d: %s", resp.StatusCode, string(respBytes))
	}

	agentResp := &AgentChatResponse{
		ProviderName: p.Name(),
		ModelName:    p.model,
	}

	scanner := bufio.NewScanner(resp.Body)
	toolCallIdx := 0
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		dataStr := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if dataStr == "" || dataStr == "[DONE]" {
			continue
		}

		var chunk geminiChatResponse
		if err := json.Unmarshal([]byte(dataStr), &chunk); err != nil {
			continue
		}

		if chunk.UsageMetadata != nil {
			agentResp.TokensIn = chunk.UsageMetadata.PromptTokenCount
			agentResp.TokensOut = chunk.UsageMetadata.CandidatesTokenCount
		}

		if len(chunk.Candidates) > 0 {
			cand := chunk.Candidates[0]
			for _, part := range cand.Content.Parts {
				delta := StreamDelta{}
				if part.Text != "" {
					agentResp.Text += part.Text
					delta.TextDelta = part.Text
				}
				if part.FunctionCall != nil {
					toolCallIdx++
					tc := ToolCall{
						ID:        fmt.Sprintf("call_%s_%d", part.FunctionCall.Name, toolCallIdx),
						Name:      part.FunctionCall.Name,
						Arguments: part.FunctionCall.Args,
					}
					agentResp.ToolCalls = append(agentResp.ToolCalls, tc)
					delta.ToolCalls = append(delta.ToolCalls, tc)
				}
				if delta.TextDelta != "" || len(delta.ToolCalls) > 0 {
					if err := onDelta(delta); err != nil {
						return nil, err
					}
				}
			}
		}
	}

	if err := scanner.Err(); err != nil && !errors.Is(err, io.EOF) {
		return nil, fmt.Errorf("erro durante streaming SSE do gemini: %w", err)
	}

	agentResp.LatencyMs = time.Since(start).Milliseconds()
	_ = onDelta(StreamDelta{
		Done:         true,
		FinalMetrics: agentResp,
	})

	return agentResp, nil
}
