package adkengine

import (
	"context"
	"encoding/json"
	"testing"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"
)

func TestAC03_ToolCallLowercaseJSONAndResponseSchema(t *testing.T) {
	llm := NewOpenAICompatLLM("openai", "gpt-4o-mini", "https://api.openai.com/v1", "sk-test")
	req := &model.LLMRequest{
		Model: "gpt-4o-mini",
		Config: &genai.GenerateContentConfig{
			ResponseMIMEType: "application/json",
			ResponseSchema: &genai.Schema{
				Type: genai.TypeObject,
				Properties: map[string]*genai.Schema{
					"summary": {Type: genai.TypeString},
				},
			},
		},
		Contents: []*genai.Content{
			{
				Role: genai.RoleModel,
				Parts: []*genai.Part{
					{
						FunctionCall: &genai.FunctionCall{
							ID:   "call_123",
							Name: "calendar_list_events",
							Args: map[string]any{"start_time": "2026-11-24"},
						},
					},
				},
			},
			{
				Role: genai.RoleUser,
				Parts: []*genai.Part{
					{
						FunctionResponse: &genai.FunctionResponse{
							ID:       "call_123",
							Name:     "calendar_list_events",
							Response: map[string]any{"summary_for_llm": "Sem eventos."},
						},
					},
				},
			},
		},
	}

	payload := llm.buildRequestPayload(context.Background(), req, false)
	rawBytes, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal falhou: %v", err)
	}

	var decoded map[string]any
	if err := json.Unmarshal(rawBytes, &decoded); err != nil {
		t.Fatalf("json.Unmarshal falhou: %v", err)
	}

	rf, ok := decoded["response_format"].(map[string]any)
	if !ok || rf["type"] != "json_schema" {
		t.Fatalf("esperava response_format.type=json_schema, obteve %+v", decoded["response_format"])
	}

	msgs, ok := decoded["messages"].([]any)
	if !ok || len(msgs) == 0 {
		t.Fatalf("esperava messages no payload")
	}
	assistantMsg := msgs[0].(map[string]any)
	tcs := assistantMsg["tool_calls"].([]any)
	tc := tcs[0].(map[string]any)
	if tc["id"] != "call_123" || tc["type"] != "function" {
		t.Fatalf("esperava chaves minúsculas 'id' e 'type' em tool_calls, obteve %+v", tc)
	}
	fn := tc["function"].(map[string]any)
	if fn["name"] != "calendar_list_events" || fn["arguments"] == nil {
		t.Fatalf("esperava chaves minúsculas 'name' e 'arguments' em function, obteve %+v", fn)
	}
}
