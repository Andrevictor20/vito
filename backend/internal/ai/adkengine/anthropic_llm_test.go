package adkengine

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestAnthropicLLM_SyncWithToolsAndThinking(t *testing.T) {
	var gotAPIKey, gotVersion string
	var gotPayload map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAPIKey = r.Header.Get("x-api-key")
		gotVersion = r.Header.Get("anthropic-version")
		if r.URL.Path != "/v1/messages" {
			t.Errorf("path inesperado: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&gotPayload); err != nil {
			t.Fatalf("erro ao decodificar request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{
			"id": "msg_1",
			"model": "claude-sonnet-4-20250514",
			"stop_reason": "tool_use",
			"content": [
				{"type": "thinking", "thinking": "Vou verificar a agenda primeiro.", "signature": "sig_abc"},
				{"type": "text", "text": "Consultando sua agenda."},
				{"type": "tool_use", "id": "toolu_01", "name": "list_events", "input": {"day": "2026-11-22"}}
			],
			"usage": {"input_tokens": 120, "output_tokens": 45}
		}`)
	}))
	defer srv.Close()

	llm := NewAnthropicLLM("claude-sonnet-4-20250514", "sk-ant-test-key-123456", WithAnthropicBaseURL(srv.URL))
	if llm.Name() != "claude-sonnet-4-20250514" {
		t.Fatalf("Name() = %s", llm.Name())
	}

	temp := float32(0.4)
	meta := &TurnExecutionMeta{Effort: "high"}
	ctx := WithTurnExecutionMeta(context.Background(), meta)
	req := &model.LLMRequest{
		Config: &genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{genai.NewPartFromText("Você é o Vito.")},
			},
			Temperature: &temp,
			Tools: []*genai.Tool{{
				FunctionDeclarations: []*genai.FunctionDeclaration{{
					Name:        "list_events",
					Description: "Lista eventos do dia",
					ParametersJsonSchema: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"day": map[string]any{"type": "string"},
						},
					},
				}},
			}},
		},
		Contents: []*genai.Content{
			genai.NewContentFromText("O que tenho amanhã?", genai.RoleUser),
			{
				Role: genai.RoleModel,
				Parts: []*genai.Part{
					{Text: "Raciocínio anterior", Thought: true, ThoughtSignature: []byte("sig_prev")},
					{FunctionCall: &genai.FunctionCall{ID: "toolu_00", Name: "get_today", Args: map[string]any{}}},
				},
			},
			{
				Role: genai.RoleUser,
				Parts: []*genai.Part{
					{FunctionResponse: &genai.FunctionResponse{ID: "toolu_00", Name: "get_today", Response: map[string]any{"result": "2026-11-21"}}},
				},
			},
		},
	}

	var resps []*model.LLMResponse
	for resp, err := range llm.GenerateContent(ctx, req, false) {
		if err != nil {
			t.Fatalf("GenerateContent erro: %v", err)
		}
		resps = append(resps, resp)
	}
	if len(resps) != 1 {
		t.Fatalf("esperava 1 resposta síncrona, obteve %d", len(resps))
	}

	if gotAPIKey != "sk-ant-test-key-123456" || gotVersion != "2023-06-01" {
		t.Errorf("headers inválidos: apiKey=%q version=%q", gotAPIKey, gotVersion)
	}
	thinkingObj, ok := gotPayload["thinking"].(map[string]any)
	if !ok || thinkingObj["type"] != "enabled" || int(thinkingObj["budget_tokens"].(float64)) != 16000 {
		t.Errorf("thinking config inesperado: %+v", gotPayload["thinking"])
	}
	if _, hasTemp := gotPayload["temperature"]; hasTemp {
		t.Errorf("temperature deve ser omitida quando extended thinking está ativo")
	}

	r := resps[0]
	if !r.TurnComplete || r.Content == nil || len(r.Content.Parts) != 3 {
		t.Fatalf("resposta inesperada: %+v", r)
	}
	if !r.Content.Parts[0].Thought || string(r.Content.Parts[0].ThoughtSignature) != "sig_abc" {
		t.Errorf("bloco thinking inesperado: %+v", r.Content.Parts[0])
	}
	if r.Content.Parts[1].Text != "Consultando sua agenda." {
		t.Errorf("texto inesperado: %q", r.Content.Parts[1].Text)
	}
	if r.Content.Parts[2].FunctionCall == nil || r.Content.Parts[2].FunctionCall.Name != "list_events" {
		t.Errorf("tool_use inesperado: %+v", r.Content.Parts[2])
	}
	if meta.ProviderUsed != "anthropic" || meta.TokensIn != 120 || meta.TokensOut != 45 {
		t.Errorf("meta de execução inesperada: %+v", meta)
	}
}

func TestAnthropicLLM_StreamingSSE(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)
		events := []string{
			"event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"model\":\"claude-sonnet-4-20250514\",\"usage\":{\"input_tokens\":80,\"output_tokens\":1}}}\n\n",
			"event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"thinking\"}}\n\n",
			"event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"thinking_delta\",\"thinking\":\"Analisando...\"}}\n\n",
			"event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"signature_delta\",\"signature\":\"sig_xyz\"}}\n\n",
			"event: content_block_stop\ndata: {\"type\":\"content_block_stop\",\"index\":0}\n\n",
			"event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":1,\"content_block\":{\"type\":\"text\"}}\n\n",
			"event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":1,\"delta\":{\"type\":\"text_delta\",\"text\":\"Tudo \"}}\n\n",
			"event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":1,\"delta\":{\"type\":\"text_delta\",\"text\":\"certo!\"}}\n\n",
			"event: content_block_stop\ndata: {\"type\":\"content_block_stop\",\"index\":1}\n\n",
			"event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":2,\"content_block\":{\"type\":\"tool_use\",\"id\":\"toolu_99\",\"name\":\"create_task\"}}\n\n",
			"event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":2,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"{\\\"title\\\":\"}}\n\n",
			"event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":2,\"delta\":{\"type\":\"input_json_delta\",\"partial_json\":\"\\\"Pagar luz\\\"}\"}}\n\n",
			"event: content_block_stop\ndata: {\"type\":\"content_block_stop\",\"index\":2}\n\n",
			"event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"tool_use\"},\"usage\":{\"output_tokens\":33}}\n\n",
			"event: message_stop\ndata: {\"type\":\"message_stop\"}\n\n",
		}
		for _, ev := range events {
			_, _ = fmt.Fprint(w, ev)
			if flusher != nil {
				flusher.Flush()
			}
		}
	}))
	defer srv.Close()

	var deltas []ai.StreamDelta
	meta := &TurnExecutionMeta{
		OnDelta: func(d ai.StreamDelta) error {
			deltas = append(deltas, d)
			return nil
		},
	}
	ctx := WithTurnExecutionMeta(context.Background(), meta)
	llm := NewAnthropicLLM("claude-sonnet-4-20250514", "sk-ant-test-key-123456", WithAnthropicBaseURL(srv.URL))
	req := &model.LLMRequest{
		Contents: []*genai.Content{genai.NewContentFromText("Crie uma tarefa", genai.RoleUser)},
	}

	var partials, finals []*model.LLMResponse
	for resp, err := range llm.GenerateContent(ctx, req, true) {
		if err != nil {
			t.Fatalf("erro streaming: %v", err)
		}
		if resp.Partial {
			partials = append(partials, resp)
		} else {
			finals = append(finals, resp)
		}
	}

	if len(partials) != 3 {
		t.Fatalf("esperava 3 parciais (1 thinking + 2 text), obteve %d", len(partials))
	}
	if len(deltas) != 3 {
		t.Fatalf("esperava 3 deltas no OnDelta, obteve %d", len(deltas))
	}
	if len(finals) != 1 || !finals[0].TurnComplete {
		t.Fatalf("esperava 1 resposta final completa, obteve %+v", finals)
	}
	parts := finals[0].Content.Parts
	if len(parts) != 3 || !parts[0].Thought || parts[1].Text != "Tudo certo!" || parts[2].FunctionCall == nil {
		t.Fatalf("partes finais inesperadas: %+v", parts)
	}
	if parts[2].FunctionCall.Args["title"] != "Pagar luz" {
		t.Errorf("argumentos de tool_use inválidos: %+v", parts[2].FunctionCall.Args)
	}
}

func TestAnthropicLLM_HTTPErrorsRedacted(t *testing.T) {
	for _, code := range []int{http.StatusUnauthorized, http.StatusTooManyRequests} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(code)
			_, _ = fmt.Fprintf(w, `{"error":{"message":"invalid x-api-key: sk-ant-secret999999"}}`)
		}))

		llm := NewAnthropicLLM("claude-sonnet-4-20250514", "sk-ant-secret999999", WithAnthropicBaseURL(srv.URL))
		req := &model.LLMRequest{Contents: []*genai.Content{genai.NewContentFromText("Oi", genai.RoleUser)}}

		var gotErr error
		for _, err := range llm.GenerateContent(context.Background(), req, false) {
			gotErr = err
		}
		srv.Close()

		var httpErr *ProviderHTTPError
		if !errors.As(gotErr, &httpErr) {
			t.Fatalf("esperava *ProviderHTTPError para status %d, obteve %v", code, gotErr)
		}
		if httpErr.StatusCode != code {
			t.Errorf("StatusCode = %d, want %d", httpErr.StatusCode, code)
		}
		if strings.Contains(httpErr.Error(), "sk-ant-secret999999") {
			t.Errorf("erro vazou chave secreta: %s", httpErr.Error())
		}
	}
}
