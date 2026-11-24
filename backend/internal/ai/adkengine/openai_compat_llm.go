package adkengine

import (
	"bufio"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"iter"
	"net/http"
	"sort"
	"strings"
	"time"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"
)

// OpenAICompatOption configura o adaptador OpenAICompatLLM.
type OpenAICompatOption func(*OpenAICompatLLM)
// WithOpenAIHTTPClient injeta um *http.Client (ex.: ai.NewSafeHTTPClient para custom).
func WithOpenAIHTTPClient(client *http.Client) OpenAICompatOption {
	return func(o *OpenAICompatLLM) {
		if client != nil {
			o.client = client
		}
	}
}
// WithOpenAISupportsReasoning habilita o envio de parâmetros de raciocínio (low/medium/high).
func WithOpenAISupportsReasoning(enabled bool) OpenAICompatOption {
	return func(o *OpenAICompatLLM) { o.supportsReasoning = enabled }
}
// WithOpenAISupportsTools habilita ou desabilita o envio de declarações de ferramentas.
func WithOpenAISupportsTools(enabled bool) OpenAICompatOption {
	return func(o *OpenAICompatLLM) { o.supportsTools = enabled }
}
// WithOpenAIHeaders adiciona cabeçalhos extras (ex.: HTTP-Referer / X-Title para OpenRouter).
func WithOpenAIHeaders(headers map[string]string) OpenAICompatOption {
	return func(o *OpenAICompatLLM) {
		for k, v := range headers {
			if strings.TrimSpace(k) != "" {
				o.extraHeaders[k] = v
			}
		}
	}
}
// OpenAICompatLLM implementa google.golang.org/adk/v2/model.LLM sobre endpoints /chat/completions.
type OpenAICompatLLM struct {
	providerKey, modelID, baseURL, apiKey string
	supportsReasoning, supportsTools      bool
	extraHeaders                          map[string]string
	client                                *http.Client
}
// NewOpenAICompatLLM cria um adaptador model.LLM compatível com OpenAI/Groq/OpenRouter/Custom.
func NewOpenAICompatLLM(providerKey, modelID, baseURL, apiKey string, opts ...OpenAICompatOption) *OpenAICompatLLM {
	llm := &OpenAICompatLLM{
		providerKey: strings.ToLower(strings.TrimSpace(providerKey)), modelID: strings.TrimSpace(modelID),
		baseURL: strings.TrimRight(strings.TrimSpace(baseURL), "/"), apiKey: strings.TrimSpace(apiKey),
		supportsTools: true, extraHeaders: make(map[string]string), client: &http.Client{Timeout: 60 * time.Second},
	}
	for _, opt := range opts {
		if opt != nil {
			opt(llm)
		}
	}
	return llm
}
// Name retorna o identificador do modelo configurado.
func (o *OpenAICompatLLM) Name() string { return o.modelID }
type oaiCompatMessage struct {
	Role       string              `json:"role"`
	Content    any                 `json:"content,omitempty"`
	ToolCalls  []oaiCompatToolCall `json:"tool_calls,omitempty"`
	ToolCallID string              `json:"tool_call_id,omitempty"`
	Name       string              `json:"name,omitempty"`
}
type oaiCompatToolCall struct {
	ID       string `json:"id"`
	Type     string `json:"type"`
	Function struct {
		Name      string `json:"name"`
		Arguments string `json:"arguments"`
	} `json:"function"`
}

// GenerateContent executa a chamada síncrona ou SSE streaming contra /chat/completions.
func (o *OpenAICompatLLM) GenerateContent(ctx context.Context, req *model.LLMRequest, stream bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {
		headers := make(map[string]string, len(o.extraHeaders)+1)
		for k, v := range o.extraHeaders {
			headers[k] = v
		}
		if o.apiKey != "" {
			headers["Authorization"] = "Bearer " + o.apiKey
		}
		body, err := doProviderJSONPost(ctx, o.client, o.providerKey, o.completionsEndpoint(), headers, o.buildRequestPayload(ctx, req, stream))
		if err != nil {
			yield(nil, err)
			return
		}
		defer body.Close()

		meta := TurnExecutionMetaFromContext(ctx)
		modelName := effectiveModelName(req, o.modelID)
		if stream {
			o.consumeStream(body, meta, modelName, yield)
			return
		}
		llmResp, err := o.parseSyncResponse(body, modelName)
		if err != nil {
			yield(nil, err)
			return
		}
		updateMetaFromResponse(meta, o.providerKey, modelName, llmResp)
		yield(llmResp, nil)
	}
}
func (o *OpenAICompatLLM) completionsEndpoint() string {
	if base := strings.TrimRight(o.baseURL, "/"); strings.HasSuffix(base, "/chat/completions") {
		return base
	} else {
		return base + "/chat/completions"
	}
}
func (o *OpenAICompatLLM) buildRequestPayload(ctx context.Context, req *model.LLMRequest, stream bool) map[string]any {
	payload := map[string]any{"model": effectiveModelName(req, o.modelID), "stream": stream}
	var msgs []oaiCompatMessage
	if req != nil && req.Config != nil {
		if sys := joinSystemInstruction(req.Config.SystemInstruction); sys != "" {
			msgs = append(msgs, oaiCompatMessage{Role: "system", Content: sys})
		}
		if req.Config.MaxOutputTokens > 0 {
			payload["max_tokens"] = int(req.Config.MaxOutputTokens)
		}
		if req.Config.Temperature != nil {
			payload["temperature"] = float64(*req.Config.Temperature)
		}
		if req.Config.ResponseSchema != nil {
			if b, err := json.Marshal(req.Config.ResponseSchema); err == nil && len(b) > 0 {
				var schemaObj any
				if json.Unmarshal(b, &schemaObj) == nil {
					payload["response_format"] = map[string]any{
						"type": "json_schema",
						"json_schema": map[string]any{
							"name":   "structured_output",
							"strict": false,
							"schema": schemaObj,
						},
					}
				}
			}
		} else if strings.EqualFold(strings.TrimSpace(req.Config.ResponseMIMEType), "application/json") {
			payload["response_format"] = map[string]any{"type": "json_object"}
		}
		if o.supportsTools {
			var tools []map[string]any
			for _, gt := range req.Config.Tools {
				if gt == nil {
					continue
				}
				for _, fd := range gt.FunctionDeclarations {
					if fd != nil {
						tools = append(tools, map[string]any{"type": "function", "function": map[string]any{"name": fd.Name, "description": fd.Description, "parameters": extractSchemaJSON(fd)}})
					}
				}
			}
			if len(tools) > 0 {
				payload["tools"] = tools
			}
		}
	}
	if o.supportsReasoning && o.providerKey != "custom" {
		if effort := resolveOpenAIReasoningEffort(ctx, req); effort != "" {
			if o.providerKey == "openrouter" {
				payload["reasoning"] = map[string]string{"effort": effort}
			} else {
				payload["reasoning_effort"] = effort
			}
		}
	}
	if req != nil {
		msgs = append(msgs, buildOpenAICompatMessages(req.Contents)...)
	}
	payload["messages"] = msgs
	return payload
}

func resolveOpenAIReasoningEffort(ctx context.Context, req *model.LLMRequest) string {
	if meta := TurnExecutionMetaFromContext(ctx); meta != nil {
		switch normalizeEffort(meta.Effort) {
		case "low", "medium", "high":
			return normalizeEffort(meta.Effort)
		case "none":
			return ""
		}
	}
	if req != nil && req.Config != nil && req.Config.ThinkingConfig != nil && req.Config.ThinkingConfig.ThinkingBudget != nil {
		b := *req.Config.ThinkingConfig.ThinkingBudget
		switch {
		case b <= 0:
			return ""
		case b <= 1024:
			return "low"
		case b <= 4096:
			return "medium"
		default:
			return "high"
		}
	}
	return ""
}

func buildOpenAICompatMessages(contents []*genai.Content) []oaiCompatMessage {
	var msgs []oaiCompatMessage
	for _, c := range contents {
		if c == nil {
			continue
		}
		if c.Role == genai.RoleModel || c.Role == "assistant" {
			var textParts []string
			var toolCalls []oaiCompatToolCall
			for i, p := range c.Parts {
				if p == nil {
					continue
				}
				if !p.Thought && p.Text != "" {
					textParts = append(textParts, p.Text)
				}
				if p.FunctionCall != nil {
					argsBytes, _ := json.Marshal(p.FunctionCall.Args)
					if len(argsBytes) == 0 || string(argsBytes) == "null" {
						argsBytes = []byte("{}")
					}
					tc := oaiCompatToolCall{ID: firstNonEmpty(p.FunctionCall.ID, fmt.Sprintf("call_%s_%d", p.FunctionCall.Name, i+1)), Type: "function"}
					tc.Function.Name, tc.Function.Arguments = p.FunctionCall.Name, string(argsBytes)
					toolCalls = append(toolCalls, tc)
				}
			}
			msg := oaiCompatMessage{Role: "assistant", ToolCalls: toolCalls}
			if len(textParts) > 0 {
				msg.Content = strings.Join(textParts, "\n")
			}
			msgs = append(msgs, msg)
			continue
		}
		var textParts []string
		var imageParts []map[string]any
		for _, p := range c.Parts {
			if p == nil {
				continue
			}
			if p.FunctionResponse != nil {
				resText, _ := extractToolResultString(p.FunctionResponse.Response)
				msgs = append(msgs, oaiCompatMessage{Role: "tool", ToolCallID: p.FunctionResponse.ID, Name: p.FunctionResponse.Name, Content: resText})
				continue
			}
			if p.Text != "" {
				textParts = append(textParts, p.Text)
			}
			if p.InlineData != nil && len(p.InlineData.Data) > 0 {
				dataURI := fmt.Sprintf("data:%s;base64,%s", firstNonEmpty(p.InlineData.MIMEType, "image/jpeg"), base64.StdEncoding.EncodeToString(p.InlineData.Data))
				imageParts = append(imageParts, map[string]any{"type": "image_url", "image_url": map[string]string{"url": dataURI}})
			}
		}
		if len(imageParts) > 0 {
			contentArr := make([]map[string]any, 0, len(imageParts)+1)
			if len(textParts) > 0 {
				contentArr = append(contentArr, map[string]any{"type": "text", "text": strings.Join(textParts, "\n")})
			}
			msgs = append(msgs, oaiCompatMessage{Role: "user", Content: append(contentArr, imageParts...)})
		} else if len(textParts) > 0 {
			msgs = append(msgs, oaiCompatMessage{Role: "user", Content: strings.Join(textParts, "\n")})
		}
	}
	return msgs
}

func (o *OpenAICompatLLM) parseSyncResponse(body io.Reader, fallbackModel string) (*model.LLMResponse, error) {
	var parsed struct {
		Model   string `json:"model"`
		Choices []struct {
			FinishReason string `json:"finish_reason"`
			Message      struct {
				Content          string              `json:"content"`
				Reasoning        string              `json:"reasoning"`
				ReasoningContent string              `json:"reasoning_content"`
				ToolCalls        []oaiCompatToolCall `json:"tool_calls"`
			} `json:"message"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.NewDecoder(body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("erro ao decodificar resposta %s: %w", o.providerKey, err)
	}
	var parts []*genai.Part
	var finishReason genai.FinishReason
	if len(parsed.Choices) > 0 {
		ch := parsed.Choices[0]
		finishReason = mapOpenAIFinishReason(ch.FinishReason)
		if thought := firstNonEmpty(ch.Message.ReasoningContent, ch.Message.Reasoning); thought != "" {
			parts = append(parts, &genai.Part{Text: thought, Thought: true})
		}
		if ch.Message.Content != "" {
			parts = append(parts, &genai.Part{Text: ch.Message.Content})
		}
		parts = append(parts, convertOpenAIToolCalls(ch.Message.ToolCalls)...)
	}
	modelVer := firstNonEmpty(parsed.Model, fallbackModel)
	return buildOpenAILLMResponse(modelVer, finishReason, parts, parsed.Usage.PromptTokens, parsed.Usage.CompletionTokens, parsed.Usage.TotalTokens), nil
}

type oaiStreamChunk struct {
	Model   string `json:"model"`
	Choices []struct {
		FinishReason string `json:"finish_reason"`
		Delta        struct {
			Content          string `json:"content"`
			Reasoning        string `json:"reasoning"`
			ReasoningContent string `json:"reasoning_content"`
			ToolCalls        []struct {
				Index    int    `json:"index"`
				ID       string `json:"id"`
				Function struct {
					Name      string `json:"name"`
					Arguments string `json:"arguments"`
				} `json:"function"`
			} `json:"tool_calls"`
		} `json:"delta"`
	} `json:"choices"`
	Usage *struct {
		PromptTokens     int `json:"prompt_tokens"`
		CompletionTokens int `json:"completion_tokens"`
	} `json:"usage"`
}

func (o *OpenAICompatLLM) consumeStream(body io.Reader, meta *TurnExecutionMeta, fallbackModel string, yield func(*model.LLMResponse, error) bool) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 0, 64*1024), 4*1024*1024)
	var textBuf, reasoningBuf strings.Builder
	toolCalls := make(map[int]*oaiCompatToolCall)
	var modelVersion, finishReason string
	var inTokens, outTokens int
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var chunk oaiStreamChunk
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if chunk.Model != "" {
			modelVersion = chunk.Model
		}
		if chunk.Usage != nil {
			inTokens, outTokens = chunk.Usage.PromptTokens, chunk.Usage.CompletionTokens
		}
		if len(chunk.Choices) == 0 {
			continue
		}
		ch := chunk.Choices[0]
		if ch.FinishReason != "" {
			finishReason = ch.FinishReason
		}
		if rc := firstNonEmpty(ch.Delta.ReasoningContent, ch.Delta.Reasoning); rc != "" {
			reasoningBuf.WriteString(rc)
			if !emitStreamPartial(meta, yield, true, rc) {
				return
			}
		}
		if ch.Delta.Content != "" {
			textBuf.WriteString(ch.Delta.Content)
			if !emitStreamPartial(meta, yield, false, ch.Delta.Content) {
				return
			}
		}
		for _, tc := range ch.Delta.ToolCalls {
			entry := toolCalls[tc.Index]
			if entry == nil {
				entry = &oaiCompatToolCall{Type: "function"}
				toolCalls[tc.Index] = entry
			}
			if tc.ID != "" {
				entry.ID = tc.ID
			}
			entry.Function.Name += tc.Function.Name
			entry.Function.Arguments += tc.Function.Arguments
		}
	}
	if err := scanner.Err(); err != nil {
		yield(nil, fmt.Errorf("erro de leitura no stream %s: %w", o.providerKey, err))
		return
	}
	var finalParts []*genai.Part
	if reasoningBuf.Len() > 0 {
		finalParts = append(finalParts, &genai.Part{Text: reasoningBuf.String(), Thought: true})
	}
	if textBuf.Len() > 0 {
		finalParts = append(finalParts, &genai.Part{Text: textBuf.String()})
	}
	indices := make([]int, 0, len(toolCalls))
	for idx := range toolCalls {
		indices = append(indices, idx)
	}
	sort.Ints(indices)
	ordered := make([]oaiCompatToolCall, 0, len(indices))
	for _, idx := range indices {
		ordered = append(ordered, *toolCalls[idx])
	}
	finalParts = append(finalParts, convertOpenAIToolCalls(ordered)...)
	modelVer := firstNonEmpty(modelVersion, fallbackModel)
	finalResp := buildOpenAILLMResponse(modelVer, mapOpenAIFinishReason(finishReason), finalParts, inTokens, outTokens, inTokens+outTokens)
	updateMetaFromResponse(meta, o.providerKey, modelVer, finalResp)
	yield(finalResp, nil)
}

func buildOpenAILLMResponse(modelVer string, finish genai.FinishReason, parts []*genai.Part, inTok, outTok, totalTok int) *model.LLMResponse {
	if totalTok == 0 {
		totalTok = inTok + outTok
	}
	return &model.LLMResponse{
		ModelVersion: modelVer, TurnComplete: true, FinishReason: finish,
		Content:       &genai.Content{Role: genai.RoleModel, Parts: parts},
		UsageMetadata: &genai.GenerateContentResponseUsageMetadata{PromptTokenCount: int32(inTok), CandidatesTokenCount: int32(outTok), TotalTokenCount: int32(totalTok)},
	}
}

func convertOpenAIToolCalls(tcs []oaiCompatToolCall) []*genai.Part {
	parts := make([]*genai.Part, 0, len(tcs))
	for i, tc := range tcs {
		argsMap := map[string]any{}
		if strings.TrimSpace(tc.Function.Arguments) != "" {
			_ = json.Unmarshal([]byte(tc.Function.Arguments), &argsMap)
		}
		parts = append(parts, &genai.Part{FunctionCall: &genai.FunctionCall{ID: firstNonEmpty(tc.ID, fmt.Sprintf("call_%s_%d", tc.Function.Name, i+1)), Name: tc.Function.Name, Args: argsMap}})
	}
	return parts
}

func mapOpenAIFinishReason(reason string) genai.FinishReason {
	if reason == "length" {
		return genai.FinishReasonMaxTokens
	}
	if reason == "content_filter" {
		return genai.FinishReasonSafety
	}
	return genai.FinishReasonStop
}

func firstNonEmpty(vals ...string) string {
	for _, v := range vals {
		if v != "" {
			return v
		}
	}
	return ""
}
