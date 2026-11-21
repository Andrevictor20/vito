package adkengine

import (
	"context"
	"encoding/json"
	"fmt"
	"iter"
	"strings"
	"sync"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
)

type turnContextKey struct{}

// TurnExecutionMeta armazena metadados de roteamento, streaming e estado por requisição no contexto Go.
type TurnExecutionMeta struct {
	UserID       string
	ThreadID     string
	TurnID       string
	Channel      string
	FocusMode    string
	Effort       string
	OnDelta      func(ai.StreamDelta) error
	Mu           sync.Mutex
	ProviderUsed string
	ModelUsed    string
	TokensIn     int
	TokensOut    int
	FallbackUsed bool
}

// WithTurnExecutionMeta anexa metadados do turno ao context.Context.
func WithTurnExecutionMeta(ctx context.Context, meta *TurnExecutionMeta) context.Context {
	return context.WithValue(ctx, turnContextKey{}, meta)
}

// TurnExecutionMetaFromContext recupera os metadados do turno do context.Context.
func TurnExecutionMetaFromContext(ctx context.Context) *TurnExecutionMeta {
	if ctx == nil {
		return nil
	}
	if v, ok := ctx.Value(turnContextKey{}).(*TurnExecutionMeta); ok {
		return v
	}
	return nil
}

// RoutedLLM implementa google.golang.org/adk/v2/model.LLM integrando o ModelRouter
// (Sticky Thread + failover automático via SelectFallbackProviders) e provedores Gemini/OpenAI-compat.
type RoutedLLM struct {
	router       *ai.ModelRouter
	defaultModel string
}

// NewRoutedLLM cria uma instância de model.LLM conectada ao ModelRouter do Vito.
func NewRoutedLLM(router *ai.ModelRouter) *RoutedLLM {
	return &RoutedLLM{
		router:       router,
		defaultModel: "gemini-2.5-flash",
	}
}

// Name retorna o identificador do modelo padrão para o ADK.
func (r *RoutedLLM) Name() string {
	return r.defaultModel
}

// GenerateContent executa a chamada ao modelo selecionado com failover transparente (COG-02).
func (r *RoutedLLM) GenerateContent(ctx context.Context, req *model.LLMRequest, stream bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {
		if r.router == nil {
			yield(nil, fmt.Errorf("ModelRouter não configurado no RoutedLLM"))
			return
		}

		meta := TurnExecutionMetaFromContext(ctx)
		agentReq := convertADKToAgentChatRequest(req, meta)

		provider, err := r.router.SelectProvider(ctx, agentReq)
		if err != nil {
			yield(nil, fmt.Errorf("falha ao selecionar provedor no RoutedLLM: %w", err))
			return
		}

		chosenProvider := provider
		var onDelta func(ai.StreamDelta) error
		if meta != nil && meta.OnDelta != nil {
			onDelta = meta.OnDelta
		}

		var stepResp *ai.AgentChatResponse
		var stepErr error

		if stream && onDelta != nil {
			stepResp, stepErr = provider.StreamChat(ctx, agentReq, func(d ai.StreamDelta) error {
				if d.TextDelta != "" {
					partial := &model.LLMResponse{
						Partial: true,
						Content: &genai.Content{
							Role:  genai.RoleModel,
							Parts: []*genai.Part{{Text: d.TextDelta}},
						},
					}
					_ = onDelta(d)
					if !yield(partial, nil) {
						return context.Canceled
					}
				}
				return nil
			})
		} else {
			stepResp, stepErr = provider.Chat(ctx, agentReq)
			if stepErr == nil && stepResp != nil && onDelta != nil && stepResp.Text != "" && len(stepResp.ToolCalls) == 0 {
				_ = onDelta(ai.StreamDelta{TextDelta: stepResp.Text})
			}
		}

		// COG-02: Failover automático via SelectFallbackProviders no mesmo passo do runner.Runner
		if stepErr != nil {
			fallbacks := r.router.SelectFallbackProviders(ctx, agentReq, provider.Name())
			for _, fb := range fallbacks {
				if stream && onDelta != nil {
					stepResp, stepErr = fb.StreamChat(ctx, agentReq, func(d ai.StreamDelta) error {
						if d.TextDelta != "" {
							partial := &model.LLMResponse{
								Partial: true,
								Content: &genai.Content{
									Role:  genai.RoleModel,
									Parts: []*genai.Part{{Text: d.TextDelta}},
								},
							}
							_ = onDelta(d)
							if !yield(partial, nil) {
								return context.Canceled
							}
						}
						return nil
					})
				} else {
					stepResp, stepErr = fb.Chat(ctx, agentReq)
					if stepErr == nil && stepResp != nil && onDelta != nil && stepResp.Text != "" && len(stepResp.ToolCalls) == 0 {
						_ = onDelta(ai.StreamDelta{TextDelta: stepResp.Text})
					}
				}
				if stepErr == nil && stepResp != nil {
					chosenProvider = fb
					if meta != nil {
						meta.Mu.Lock()
						meta.FallbackUsed = true
						meta.Mu.Unlock()
					}
					break
				}
			}
		}

		if stepErr != nil {
			yield(nil, fmt.Errorf("erro na chamada ao provedor de IA (%s): %w", chosenProvider.Name(), stepErr))
			return
		}

		if meta != nil && stepResp != nil {
			meta.Mu.Lock()
			meta.ProviderUsed = chosenProvider.Name()
			meta.ModelUsed = chosenProvider.ModelName()
			meta.TokensIn += stepResp.TokensIn
			meta.TokensOut += stepResp.TokensOut
			meta.Mu.Unlock()
		}

		llmResp := convertAgentChatToADKResponse(stepResp)
		yield(llmResp, nil)
	}
}

func convertADKToAgentChatRequest(req *model.LLMRequest, meta *TurnExecutionMeta) ai.AgentChatRequest {
	var out ai.AgentChatRequest
	if meta != nil {
		out.ThreadID = meta.ThreadID
		out.UserID = meta.UserID
		out.Channel = meta.Channel
	}
	out.Task = ai.TaskToolUse

	if req.Config != nil {
		if req.Config.SystemInstruction != nil {
			var sysParts []string
			for _, p := range req.Config.SystemInstruction.Parts {
				if p != nil && p.Text != "" {
					sysParts = append(sysParts, p.Text)
				}
			}
			out.SystemPrompt = strings.Join(sysParts, "\n\n")
		}
		if req.Config.MaxOutputTokens > 0 {
			out.MaxTokens = int(req.Config.MaxOutputTokens)
		}
		if req.Config.Temperature != nil {
			t := float64(*req.Config.Temperature)
			out.Temperature = &t
		}
		for _, gt := range req.Config.Tools {
			if gt == nil {
				continue
			}
			for _, fd := range gt.FunctionDeclarations {
				if fd == nil {
					continue
				}
				var rawSchema json.RawMessage
				if fd.ParametersJsonSchema != nil {
					b, _ := json.Marshal(fd.ParametersJsonSchema)
					rawSchema = b
				} else if fd.Parameters != nil {
					b, _ := json.Marshal(fd.Parameters)
					rawSchema = b
				}
				if len(rawSchema) == 0 {
					rawSchema = json.RawMessage(`{"type":"object"}`)
				}
				out.Tools = append(out.Tools, ai.ToolDefinition{
					Name:        fd.Name,
					Description: fd.Description,
					Parameters:  rawSchema,
				})
			}
		}
	}

	for _, c := range req.Contents {
		if c == nil {
			continue
		}
		switch c.Role {
		case genai.RoleModel, "assistant":
			msg := ai.TurnMessage{Role: ai.RoleAssistant}
			for _, p := range c.Parts {
				if p == nil {
					continue
				}
				if p.Thought {
					msg.Thought += p.Text
				} else if p.Text != "" {
					msg.Content += p.Text
				}
				if p.FunctionCall != nil {
					argsBytes, _ := json.Marshal(p.FunctionCall.Args)
					if len(argsBytes) == 0 || string(argsBytes) == "null" {
						argsBytes = []byte("{}")
					}
					msg.ToolCalls = append(msg.ToolCalls, ai.ToolCall{
						ID:               p.FunctionCall.ID,
						Name:             p.FunctionCall.Name,
						Arguments:        argsBytes,
						ThoughtSignature: string(p.ThoughtSignature),
					})
				}
			}
			out.Messages = append(out.Messages, msg)

		default: // user or function responses
			var textParts []string
			var imgBytes []byte
			var imgMime string
			for _, p := range c.Parts {
				if p == nil {
					continue
				}
				if p.FunctionResponse != nil {
					contentStr := ""
					if resMap := p.FunctionResponse.Response; resMap != nil {
						if s, ok := resMap["summary_for_llm"].(string); ok && s != "" {
							contentStr = s
						} else if s, ok := resMap["result"].(string); ok && s != "" {
							contentStr = s
						} else if errStr, ok := resMap["error"].(string); ok && errStr != "" {
							contentStr = "Erro: " + errStr
						} else {
							b, _ := json.Marshal(resMap)
							contentStr = string(b)
						}
					}
					out.Messages = append(out.Messages, ai.TurnMessage{
						Role:       ai.RoleTool,
						ToolCallID: p.FunctionResponse.ID,
						Name:       p.FunctionResponse.Name,
						Content:    contentStr,
					})
					continue
				}
				if p.Text != "" {
					textParts = append(textParts, p.Text)
				}
				if p.InlineData != nil && len(p.InlineData.Data) > 0 {
					imgBytes = p.InlineData.Data
					imgMime = p.InlineData.MIMEType
				}
			}
			if len(textParts) > 0 || len(imgBytes) > 0 {
				out.Messages = append(out.Messages, ai.TurnMessage{
					Role:       ai.RoleUser,
					Content:    strings.Join(textParts, "\n"),
					ImageBytes: imgBytes,
					ImageMIME:  imgMime,
				})
			}
		}
	}

	return out
}

func convertAgentChatToADKResponse(resp *ai.AgentChatResponse) *model.LLMResponse {
	if resp == nil {
		return &model.LLMResponse{TurnComplete: true}
	}
	var parts []*genai.Part
	if resp.Thought != "" {
		parts = append(parts, &genai.Part{
			Text:    resp.Thought,
			Thought: true,
		})
	}
	for _, r := range resp.Reasoning {
		if r != "" && r != resp.Thought {
			parts = append(parts, &genai.Part{
				Text:    r,
				Thought: true,
			})
		}
	}
	if resp.Text != "" {
		parts = append(parts, &genai.Part{
			Text: resp.Text,
		})
	}
	for i, tc := range resp.ToolCalls {
		var argsMap map[string]any
		if len(tc.Arguments) > 0 {
			_ = json.Unmarshal(tc.Arguments, &argsMap)
		}
		if argsMap == nil {
			argsMap = make(map[string]any)
		}
		callID := tc.ID
		if callID == "" {
			callID = fmt.Sprintf("call_%s_%d", tc.Name, i+1)
		}
		part := &genai.Part{
			FunctionCall: &genai.FunctionCall{
				ID:   callID,
				Name: tc.Name,
				Args: argsMap,
			},
		}
		if tc.ThoughtSignature != "" {
			part.ThoughtSignature = []byte(tc.ThoughtSignature)
		}
		parts = append(parts, part)
	}

	return &model.LLMResponse{
		ModelVersion: resp.ModelName,
		TurnComplete: true,
		Content: &genai.Content{
			Role:  genai.RoleModel,
			Parts: parts,
		},
		UsageMetadata: &genai.GenerateContentResponseUsageMetadata{
			PromptTokenCount:     int32(resp.TokensIn),
			CandidatesTokenCount: int32(resp.TokensOut),
			TotalTokenCount:      int32(resp.TokensIn + resp.TokensOut),
		},
	}
}
