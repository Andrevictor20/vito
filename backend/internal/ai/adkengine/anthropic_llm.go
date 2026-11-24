package adkengine

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/ai/byok"
	"io"
	"iter"
	"net/http"
	"sort"
	"strings"
	"time"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"
)

const (
	defaultAnthropicBaseURL = "https://api.anthropic.com"
	anthropicAPIVersion     = "2023-06-01"
	defaultAnthropicMaxToks = 4096
)

// AnthropicOption configura o adaptador AnthropicLLM.
type AnthropicOption func(*AnthropicLLM)

// WithAnthropicBaseURL define a URL base da API Anthropic (útil para testes e proxies).
func WithAnthropicBaseURL(baseURL string) AnthropicOption {
	return func(a *AnthropicLLM) {
		if b := strings.TrimRight(strings.TrimSpace(baseURL), "/"); b != "" {
			a.baseURL = b
		}
	}
}

// WithAnthropicHTTPClient injeta um *http.Client customizado.
func WithAnthropicHTTPClient(client *http.Client) AnthropicOption {
	return func(a *AnthropicLLM) {
		if client != nil {
			a.client = client
		}
	}
}

// AnthropicLLM implementa google.golang.org/adk/v2/model.LLM sobre a API Messages da Anthropic.
type AnthropicLLM struct {
	modelID, apiKey, baseURL string
	client                   *http.Client
}

// NewAnthropicLLM cria um adaptador model.LLM nativo para Claude (Anthropic /v1/messages).
func NewAnthropicLLM(modelID, apiKey string, opts ...AnthropicOption) *AnthropicLLM {
	llm := &AnthropicLLM{modelID: strings.TrimSpace(modelID), apiKey: strings.TrimSpace(apiKey), baseURL: defaultAnthropicBaseURL, client: &http.Client{Timeout: 60 * time.Second}}
	for _, opt := range opts {
		if opt != nil {
			opt(llm)
		}
	}
	return llm
}

// Name retorna o identificador do modelo configurado.
func (a *AnthropicLLM) Name() string { return a.modelID }

type anthropicMessage struct {
	Role    string           `json:"role"`
	Content []anthropicBlock `json:"content"`
}
type anthropicBlock struct {
	Type      string            `json:"type"`
	Text      string            `json:"text,omitempty"`
	Thinking  string            `json:"thinking,omitempty"`
	Signature string            `json:"signature,omitempty"`
	ID        string            `json:"id,omitempty"`
	Name      string            `json:"name,omitempty"`
	Input     any               `json:"input,omitempty"`
	ToolUseID string            `json:"tool_use_id,omitempty"`
	Content   string            `json:"content,omitempty"`
	IsError   bool              `json:"is_error,omitempty"`
	Source    map[string]string `json:"source,omitempty"`
}

// GenerateContent executa a chamada síncrona ou SSE streaming contra /v1/messages.
func (a *AnthropicLLM) GenerateContent(ctx context.Context, req *model.LLMRequest, stream bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {
		headers := map[string]string{"x-api-key": a.apiKey, "anthropic-version": anthropicAPIVersion}
		body, err := doProviderJSONPost(ctx, a.client, "anthropic", a.messagesEndpoint(), headers, a.buildRequestPayload(ctx, req, stream))
		if err != nil {
			yield(nil, err)
			return
		}
		defer body.Close()
		meta := TurnExecutionMetaFromContext(ctx)
		if stream {
			a.consumeStream(body, meta, yield)
			return
		}
		llmResp, err := a.parseSyncResponse(body)
		if err != nil {
			yield(nil, err)
			return
		}
		updateMetaFromResponse(meta, "anthropic", effectiveModelName(req, a.modelID), llmResp)
		yield(llmResp, nil)
	}
}
func (a *AnthropicLLM) messagesEndpoint() string {
	base := strings.TrimRight(a.baseURL, "/")
	if strings.HasSuffix(base, "/v1/messages") {
		return base
	}
	if strings.HasSuffix(base, "/v1") {
		return base + "/messages"
	}
	return base + "/v1/messages"
}
func (a *AnthropicLLM) buildRequestPayload(ctx context.Context, req *model.LLMRequest, stream bool) map[string]any {
	maxToks := defaultAnthropicMaxToks
	payload := map[string]any{"model": effectiveModelName(req, a.modelID), "stream": stream}
	if req != nil && req.Config != nil {
		if sys := joinSystemInstruction(req.Config.SystemInstruction); sys != "" {
			payload["system"] = sys
		}
		if req.Config.MaxOutputTokens > 0 {
			maxToks = int(req.Config.MaxOutputTokens)
		}
		if req.Config.Temperature != nil {
			payload["temperature"] = float64(*req.Config.Temperature)
		}
		if req.Config.ResponseSchema != nil {
			if b, err := json.Marshal(req.Config.ResponseSchema); err == nil && len(b) > 0 {
				sysSuffix := fmt.Sprintf("Responda EXCLUSIVAMENTE em JSON válido compatível com o seguinte JSON Schema:\n%s", string(b))
				if existing, ok := payload["system"].(string); ok && existing != "" {
					payload["system"] = existing + "\n\n" + sysSuffix
				} else {
					payload["system"] = sysSuffix
				}
			}
		} else if strings.EqualFold(strings.TrimSpace(req.Config.ResponseMIMEType), "application/json") {
			sysSuffix := "Responda EXCLUSIVAMENTE em JSON válido."
			if existing, ok := payload["system"].(string); ok && existing != "" {
				payload["system"] = existing + "\n\n" + sysSuffix
			} else {
				payload["system"] = sysSuffix
			}
		}
		var tools []map[string]any
		for _, gt := range req.Config.Tools {
			if gt == nil {
				continue
			}
			for _, fd := range gt.FunctionDeclarations {
				if fd != nil {
					tools = append(tools, map[string]any{"name": fd.Name, "description": fd.Description, "input_schema": extractSchemaJSON(fd)})
				}
			}
		}
		if len(tools) > 0 {
			payload["tools"] = tools
		}
	}
	if budget := resolveAnthropicThinkingBudget(ctx, req); budget > 0 {
		if budget < 1024 {
			budget = 1024
		}
		payload["thinking"] = map[string]any{"type": "enabled", "budget_tokens": budget}
		if maxToks <= budget {
			maxToks = budget + 4096
		}
		delete(payload, "temperature") // Anthropic rejeita temperature com extended thinking ativo.
	}
	payload["max_tokens"] = maxToks
	if req != nil {
		payload["messages"] = buildAnthropicMessages(req.Contents)
	} else {
		payload["messages"] = []anthropicMessage{}
	}
	return payload
}

func resolveAnthropicThinkingBudget(ctx context.Context, req *model.LLMRequest) int {
	if meta := TurnExecutionMetaFromContext(ctx); meta != nil {
		switch normalizeEffort(meta.Effort) {
		case "none":
			return 0
		case "low":
			return 1024
		case "medium":
			return 4096
		case "high":
			return 16000
		}
	}
	if req != nil && req.Config != nil && req.Config.ThinkingConfig != nil && req.Config.ThinkingConfig.ThinkingBudget != nil {
		return int(*req.Config.ThinkingConfig.ThinkingBudget)
	}
	return 0
}

func buildAnthropicMessages(contents []*genai.Content) []anthropicMessage {
	var msgs []anthropicMessage
	for _, c := range contents {
		if c == nil {
			continue
		}
		role := "user"
		if c.Role == genai.RoleModel || c.Role == "assistant" {
			role = "assistant"
		}
		var blocks []anthropicBlock
		for _, p := range c.Parts {
			if p == nil {
				continue
			}
			if role == "assistant" {
				if p.Thought && p.Text != "" && len(p.ThoughtSignature) > 0 {
					blocks = append(blocks, anthropicBlock{Type: "thinking", Thinking: p.Text, Signature: string(p.ThoughtSignature)})
				} else if !p.Thought && p.Text != "" {
					blocks = append(blocks, anthropicBlock{Type: "text", Text: p.Text})
				}
				if p.FunctionCall != nil {
					callID := p.FunctionCall.ID
					if callID == "" {
						callID = "toolu_" + p.FunctionCall.Name
					}
					args := p.FunctionCall.Args
					if args == nil {
						args = map[string]any{}
					}
					blocks = append(blocks, anthropicBlock{Type: "tool_use", ID: callID, Name: p.FunctionCall.Name, Input: args})
				}
				continue
			}
			if p.FunctionResponse != nil {
				resText, isErr := extractToolResultString(p.FunctionResponse.Response)
				blocks = append(blocks, anthropicBlock{Type: "tool_result", ToolUseID: p.FunctionResponse.ID, Content: resText, IsError: isErr})
				continue
			}
			if p.InlineData != nil && len(p.InlineData.Data) > 0 {
				mime := p.InlineData.MIMEType
				if mime == "" {
					mime = "image/jpeg"
				}
				blocks = append(blocks, anthropicBlock{Type: "image", Source: map[string]string{"type": "base64", "media_type": mime, "data": base64.StdEncoding.EncodeToString(p.InlineData.Data)}})
			}
			if p.Text != "" {
				blocks = append(blocks, anthropicBlock{Type: "text", Text: p.Text})
			}
		}
		if len(blocks) == 0 {
			continue
		}
		if n := len(msgs); n > 0 && msgs[n-1].Role == role {
			msgs[n-1].Content = append(msgs[n-1].Content, blocks...)
		} else {
			msgs = append(msgs, anthropicMessage{Role: role, Content: blocks})
		}
	}
	return msgs
}

func (a *AnthropicLLM) parseSyncResponse(body io.Reader) (*model.LLMResponse, error) {
	var parsed struct {
		Model      string           `json:"model"`
		StopReason string           `json:"stop_reason"`
		Content    []anthropicBlock `json:"content"`
		Usage      struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	}
	if err := json.NewDecoder(body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("erro ao decodificar resposta Anthropic: %w", err)
	}
	parts := make([]*genai.Part, 0, len(parsed.Content))
	for _, blk := range parsed.Content {
		switch blk.Type {
		case "thinking":
			if blk.Thinking != "" {
				parts = append(parts, &genai.Part{Text: blk.Thinking, Thought: true, ThoughtSignature: []byte(blk.Signature)})
			}
		case "text":
			if blk.Text != "" {
				parts = append(parts, &genai.Part{Text: blk.Text})
			}
		case "tool_use":
			argsMap, _ := blk.Input.(map[string]any)
			if argsMap == nil {
				argsMap = map[string]any{}
			}
			parts = append(parts, &genai.Part{FunctionCall: &genai.FunctionCall{ID: blk.ID, Name: blk.Name, Args: argsMap}})
		}
	}
	return &model.LLMResponse{
		ModelVersion:  parsed.Model,
		TurnComplete:  true,
		FinishReason:  mapAnthropicStopReason(parsed.StopReason),
		Content:       &genai.Content{Role: genai.RoleModel, Parts: parts},
		UsageMetadata: &genai.GenerateContentResponseUsageMetadata{PromptTokenCount: int32(parsed.Usage.InputTokens), CandidatesTokenCount: int32(parsed.Usage.OutputTokens), TotalTokenCount: int32(parsed.Usage.InputTokens + parsed.Usage.OutputTokens)},
	}, nil
}

type anthropicStreamBlock struct {
	blockType, id, name       string
	text, signature, jsonArgs strings.Builder
}

type anthropicSSEEvent struct {
	Type    string `json:"type"`
	Index   int    `json:"index"`
	Message struct {
		Model string `json:"model"`
		Usage struct {
			InputTokens  int `json:"input_tokens"`
			OutputTokens int `json:"output_tokens"`
		} `json:"usage"`
	} `json:"message"`
	ContentBlock struct {
		Type string `json:"type"`
		ID   string `json:"id"`
		Name string `json:"name"`
	} `json:"content_block"`
	Delta struct {
		Type        string `json:"type"`
		Text        string `json:"text"`
		Thinking    string `json:"thinking"`
		Signature   string `json:"signature"`
		PartialJSON string `json:"partial_json"`
		StopReason  string `json:"stop_reason"`
	} `json:"delta"`
	Usage struct {
		OutputTokens int `json:"output_tokens"`
	} `json:"usage"`
	Error struct {
		Message string `json:"message"`
	} `json:"error"`
}

func (a *AnthropicLLM) consumeStream(body io.Reader, meta *TurnExecutionMeta, yield func(*model.LLMResponse, error) bool) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	blocks := make(map[int]*anthropicStreamBlock)
	var modelVersion, stopReason, eventName string
	var inTokens, outTokens int

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			eventName = ""
			continue
		}
		if strings.HasPrefix(line, "event:") {
			eventName = strings.TrimSpace(strings.TrimPrefix(line, "event:"))
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" || data == "[DONE]" {
			continue
		}
		var ev anthropicSSEEvent
		if err := json.Unmarshal([]byte(data), &ev); err != nil {
			continue
		}
		if ev.Type == "" {
			ev.Type = eventName
		}
		switch ev.Type {
		case "error":
			yield(nil, &ProviderHTTPError{Provider: "anthropic", StatusCode: 502, Body: byok.RedactSecrets(ev.Error.Message)})
			return
		case "message_start":
			modelVersion, inTokens = ev.Message.Model, ev.Message.Usage.InputTokens
			if ev.Message.Usage.OutputTokens > 0 {
				outTokens = ev.Message.Usage.OutputTokens
			}
		case "content_block_start":
			blocks[ev.Index] = &anthropicStreamBlock{blockType: ev.ContentBlock.Type, id: ev.ContentBlock.ID, name: ev.ContentBlock.Name}
		case "content_block_delta":
			blk := blocks[ev.Index]
			if blk == nil {
				blk = &anthropicStreamBlock{blockType: strings.TrimSuffix(ev.Delta.Type, "_delta")}
				blocks[ev.Index] = blk
			}
			switch ev.Delta.Type {
			case "thinking_delta":
				blk.text.WriteString(ev.Delta.Thinking)
				if !emitStreamPartial(meta, yield, true, ev.Delta.Thinking) {
					return
				}
			case "signature_delta":
				blk.signature.WriteString(ev.Delta.Signature)
			case "text_delta":
				blk.text.WriteString(ev.Delta.Text)
				if !emitStreamPartial(meta, yield, false, ev.Delta.Text) {
					return
				}
			case "input_json_delta":
				blk.jsonArgs.WriteString(ev.Delta.PartialJSON)
			}
		case "message_delta":
			if ev.Delta.StopReason != "" {
				stopReason = ev.Delta.StopReason
			}
			if ev.Usage.OutputTokens > 0 {
				outTokens = ev.Usage.OutputTokens
			}
		}
	}
	if err := scanner.Err(); err != nil {
		yield(nil, fmt.Errorf("erro de leitura no stream Anthropic: %w", err))
		return
	}
	if modelVersion == "" {
		modelVersion = a.modelID
	}
	finalResp := &model.LLMResponse{
		ModelVersion:  modelVersion,
		TurnComplete:  true,
		FinishReason:  mapAnthropicStopReason(stopReason),
		Content:       &genai.Content{Role: genai.RoleModel, Parts: finalizeAnthropicBlocks(blocks)},
		UsageMetadata: &genai.GenerateContentResponseUsageMetadata{PromptTokenCount: int32(inTokens), CandidatesTokenCount: int32(outTokens), TotalTokenCount: int32(inTokens + outTokens)},
	}
	updateMetaFromResponse(meta, "anthropic", modelVersion, finalResp)
	yield(finalResp, nil)
}

func finalizeAnthropicBlocks(blocks map[int]*anthropicStreamBlock) []*genai.Part {
	indices := make([]int, 0, len(blocks))
	for idx := range blocks {
		indices = append(indices, idx)
	}
	sort.Ints(indices)
	var parts []*genai.Part
	for _, idx := range indices {
		blk := blocks[idx]
		switch blk.blockType {
		case "thinking":
			if blk.text.Len() > 0 {
				parts = append(parts, &genai.Part{Text: blk.text.String(), Thought: true, ThoughtSignature: []byte(blk.signature.String())})
			}
		case "text":
			if blk.text.Len() > 0 {
				parts = append(parts, &genai.Part{Text: blk.text.String()})
			}
		case "tool_use":
			argsMap := map[string]any{}
			if raw := strings.TrimSpace(blk.jsonArgs.String()); raw != "" {
				_ = json.Unmarshal([]byte(raw), &argsMap)
			}
			parts = append(parts, &genai.Part{FunctionCall: &genai.FunctionCall{ID: blk.id, Name: blk.name, Args: argsMap}})
		}
	}
	return parts
}

func mapAnthropicStopReason(reason string) genai.FinishReason {
	if reason == "max_tokens" {
		return genai.FinishReasonMaxTokens
	}
	return genai.FinishReasonStop
}
