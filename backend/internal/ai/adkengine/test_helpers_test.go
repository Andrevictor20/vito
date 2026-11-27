package adkengine_test

import (
	"context"
	"encoding/json"
	"fmt"
	"iter"
	"sync"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
)

type scriptedModelResponse struct {
	Text         string
	Thought      string
	Reasoning    []string
	ToolCalls    []ai.ToolCall
	TokensIn     int
	TokensOut    int
	StreamChunks bool
}

type fakeADKLLM struct {
	mu           sync.Mutex
	model        string
	failErr      error
	responses    []scriptedModelResponse
	callIdx      int
	capturedReqs []*model.LLMRequest
}

func (f *fakeADKLLM) Name() string {
	if f.model != "" {
		return f.model
	}
	return "gemini-2.5-flash"
}

func (f *fakeADKLLM) GenerateContent(_ context.Context, req *model.LLMRequest, stream bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {
		f.mu.Lock()
		f.capturedReqs = append(f.capturedReqs, req)
		failErr := f.failErr
		resp := scriptedModelResponse{Text: "Resposta padrão ADK"}
		if f.callIdx < len(f.responses) {
			resp = f.responses[f.callIdx]
			f.callIdx++
		}
		f.mu.Unlock()

		if failErr != nil {
			yield(nil, failErr)
			return
		}

		if stream && (resp.StreamChunks || (resp.Text != "" && len(resp.ToolCalls) == 0)) {
			if resp.Thought != "" {
				if !yield(&model.LLMResponse{
					Partial: true,
					Content: &genai.Content{
						Role:  genai.RoleModel,
						Parts: []*genai.Part{{Text: resp.Thought, Thought: true}},
					},
				}, nil) {
					return
				}
			}
			for _, tc := range resp.ToolCalls {
				part := buildFunctionCallPart(tc, 0)
				if !yield(&model.LLMResponse{
					Partial: true,
					Content: &genai.Content{
						Role:  genai.RoleModel,
						Parts: []*genai.Part{part},
					},
				}, nil) {
					return
				}
			}
			if resp.Text != "" {
				if !yield(&model.LLMResponse{
					Partial: true,
					Content: &genai.Content{
						Role:  genai.RoleModel,
						Parts: []*genai.Part{{Text: resp.Text}},
					},
				}, nil) {
					return
				}
			}
		}

		yield(buildFinalModelResponse(f.Name(), resp), nil)
	}
}

func buildFunctionCallPart(tc ai.ToolCall, idx int) *genai.Part {
	var argsMap map[string]any
	if len(tc.Arguments) > 0 {
		_ = json.Unmarshal(tc.Arguments, &argsMap)
	}
	if argsMap == nil {
		argsMap = make(map[string]any)
	}
	callID := tc.ID
	if callID == "" {
		callID = fmt.Sprintf("call_%s_%d", tc.Name, idx+1)
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
	return part
}

func buildFinalModelResponse(modelName string, resp scriptedModelResponse) *model.LLMResponse {
	var parts []*genai.Part
	if resp.Thought != "" {
		parts = append(parts, &genai.Part{Text: resp.Thought, Thought: true})
	}
	for _, r := range resp.Reasoning {
		if r != "" && r != resp.Thought {
			parts = append(parts, &genai.Part{Text: r, Thought: true})
		}
	}
	if resp.Text != "" {
		parts = append(parts, &genai.Part{Text: resp.Text})
	}
	for i, tc := range resp.ToolCalls {
		parts = append(parts, buildFunctionCallPart(tc, i))
	}
	return &model.LLMResponse{
		ModelVersion: modelName,
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

func testServerPool(displayName, modelID string, llm model.LLM) []adkengine.ServerPoolEntry {
	return []adkengine.ServerPoolEntry{
		{
			ProviderKey: "gemini",
			DisplayName: displayName,
			ModelID:     modelID,
			Tier:        3,
			LLM:         llm,
		},
	}
}
