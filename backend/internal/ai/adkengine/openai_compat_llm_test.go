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

func TestOpenAICompatLLM_SyncToolCallsAndReasoningEffort(t *testing.T) {
	var gotAuth string
	var gotPayload map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuth = r.Header.Get("Authorization")
		if r.URL.Path != "/v1/chat/completions" {
			t.Errorf("path inesperado: %s", r.URL.Path)
		}
		if err := json.NewDecoder(r.Body).Decode(&gotPayload); err != nil {
			t.Fatalf("erro ao decodificar request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{
			"model": "o3-mini",
			"choices": [{
				"finish_reason": "tool_calls",
				"message": {
					"role": "assistant",
					"reasoning_content": "Preciso buscar os lançamentos.",
					"content": "Verificando...",
					"tool_calls": [{
						"id": "call_fin_1",
						"type": "function",
						"function": {"name": "list_expenses", "arguments": "{\"month\":\"2026-11\"}"}
					}]
				}
			}],
			"usage": {"prompt_tokens": 90, "completion_tokens": 30, "total_tokens": 120}
		}`)
	}))
	defer srv.Close()

	llm := NewOpenAICompatLLM(
		"openai",
		"o3-mini",
		srv.URL+"/v1",
		"sk-test-openai-secret999",
		WithOpenAISupportsReasoning(true),
		WithOpenAIHTTPClient(srv.Client()),
	)
	meta := &TurnExecutionMeta{Effort: "high"}
	ctx := WithTurnExecutionMeta(context.Background(), meta)

	req := &model.LLMRequest{
		Config: &genai.GenerateContentConfig{
			SystemInstruction: &genai.Content{
				Parts: []*genai.Part{genai.NewPartFromText("Assistente financeiro")},
			},
			Tools: []*genai.Tool{{
				FunctionDeclarations: []*genai.FunctionDeclaration{{
					Name:        "list_expenses",
					Description: "Lista despesas",
				}},
			}},
		},
		Contents: []*genai.Content{
			genai.NewContentFromText("Quanto gastei?", genai.RoleUser),
			{
				Role:  genai.RoleUser,
				Parts: []*genai.Part{{FunctionResponse: &genai.FunctionResponse{ID: "call_0", Name: "ping", Response: map[string]any{"result": "ok"}}}},
			},
		},
	}

	var resps []*model.LLMResponse
	for resp, err := range llm.GenerateContent(ctx, req, false) {
		if err != nil {
			t.Fatalf("erro inesperado: %v", err)
		}
		resps = append(resps, resp)
	}
	if len(resps) != 1 {
		t.Fatalf("esperava 1 resposta, obteve %d", len(resps))
	}
	if gotAuth != "Bearer sk-test-openai-secret999" {
		t.Errorf("Authorization inesperado: %q", gotAuth)
	}
	if gotPayload["reasoning_effort"] != "high" {
		t.Errorf("reasoning_effort = %v, want high", gotPayload["reasoning_effort"])
	}
	parts := resps[0].Content.Parts
	if len(parts) != 3 || !parts[0].Thought || parts[1].Text != "Verificando..." || parts[2].FunctionCall.Name != "list_expenses" {
		t.Fatalf("partes inesperadas: %+v", parts)
	}
	if meta.TokensIn != 90 || meta.TokensOut != 30 {
		t.Errorf("tokens inesperados no meta: %+v", meta)
	}
}

func TestOpenAICompatLLM_OpenRouterReasoningObjectAndCustomOmitted(t *testing.T) {
	var payloads []map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var p map[string]any
		_ = json.NewDecoder(r.Body).Decode(&p)
		payloads = append(payloads, p)
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"model":"m","choices":[{"finish_reason":"stop","message":{"content":"ok"}}]}`)
	}))
	defer srv.Close()

	ctx := WithTurnExecutionMeta(context.Background(), &TurnExecutionMeta{Effort: "med"})
	req := &model.LLMRequest{Contents: []*genai.Content{genai.NewContentFromText("oi", genai.RoleUser)}}

	orLLM := NewOpenAICompatLLM("openrouter", "anthropic/claude-sonnet-4", srv.URL, "sk-or-abc123456", WithOpenAISupportsReasoning(true))
	for _, err := range orLLM.GenerateContent(ctx, req, false) {
		if err != nil {
			t.Fatal(err)
		}
	}
	customLLM := NewOpenAICompatLLM("custom", "llama3", srv.URL, "local", WithOpenAISupportsReasoning(true))
	for _, err := range customLLM.GenerateContent(ctx, req, false) {
		if err != nil {
			t.Fatal(err)
		}
	}

	rObj, ok := payloads[0]["reasoning"].(map[string]any)
	if !ok || rObj["effort"] != "medium" {
		t.Errorf("OpenRouter deveria enviar reasoning.effort=medium, obteve %+v", payloads[0])
	}
	if _, hasRE := payloads[1]["reasoning_effort"]; hasRE {
		t.Errorf("custom deveria omitir reasoning_effort (§3), obteve %+v", payloads[1])
	}
}

func TestOpenAICompatLLM_StreamingSSE(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)
		chunks := []string{
			"data: {\"model\":\"gpt-4o\",\"choices\":[{\"delta\":{\"reasoning_content\":\"Pensando...\"}}]}\n\n",
			"data: {\"model\":\"gpt-4o\",\"choices\":[{\"delta\":{\"content\":\"Olá \"}}]}\n\n",
			"data: {\"model\":\"gpt-4o\",\"choices\":[{\"delta\":{\"content\":\"André!\"}}]}\n\n",
			"data: {\"model\":\"gpt-4o\",\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"id\":\"call_1\",\"function\":{\"name\":\"get_time\",\"arguments\":\"{\\\"tz\\\":\"}}]}}]}\n\n",
			"data: {\"model\":\"gpt-4o\",\"choices\":[{\"delta\":{\"tool_calls\":[{\"index\":0,\"function\":{\"arguments\":\"\\\"SP\\\"}\"}}]},\"finish_reason\":\"tool_calls\"}],\"usage\":{\"prompt_tokens\":50,\"completion_tokens\":20}}\n\n",
			"data: [DONE]\n\n",
		}
		for _, c := range chunks {
			_, _ = fmt.Fprint(w, c)
			if flusher != nil {
				flusher.Flush()
			}
		}
	}))
	defer srv.Close()

	var deltas []ai.StreamDelta
	ctx := WithTurnExecutionMeta(context.Background(), &TurnExecutionMeta{
		OnDelta: func(d ai.StreamDelta) error {
			deltas = append(deltas, d)
			return nil
		},
	})
	llm := NewOpenAICompatLLM("openai", "gpt-4o", srv.URL, "sk-test-key-123456")
	req := &model.LLMRequest{Contents: []*genai.Content{genai.NewContentFromText("Que horas são?", genai.RoleUser)}}

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

	if len(partials) != 3 || len(deltas) != 3 {
		t.Fatalf("esperava 3 parciais e 3 deltas, obteve partials=%d deltas=%d", len(partials), len(deltas))
	}
	if len(finals) != 1 || !finals[0].TurnComplete {
		t.Fatalf("esperava 1 resposta final, obteve %+v", finals)
	}
	parts := finals[0].Content.Parts
	if len(parts) != 3 || !parts[0].Thought || parts[1].Text != "Olá André!" || parts[2].FunctionCall.Args["tz"] != "SP" {
		t.Fatalf("partes finais inválidas: %+v", parts)
	}
}

func TestOpenAICompatLLM_HTTPErrorsRedacted(t *testing.T) {
	for _, code := range []int{http.StatusUnauthorized, http.StatusTooManyRequests} {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(code)
			_, _ = fmt.Fprintf(w, `{"error":{"message":"Incorrect API key provided: gsk_secret_token_999"}}`)
		}))

		llm := NewOpenAICompatLLM("groq", "llama-3.3-70b-versatile", srv.URL, "gsk_secret_token_999")
		req := &model.LLMRequest{Contents: []*genai.Content{genai.NewContentFromText("Oi", genai.RoleUser)}}

		var gotErr error
		for _, err := range llm.GenerateContent(context.Background(), req, false) {
			gotErr = err
		}
		srv.Close()

		var httpErr *ProviderHTTPError
		if !errors.As(gotErr, &httpErr) {
			t.Fatalf("esperava *ProviderHTTPError para %d, obteve %v", code, gotErr)
		}
		if httpErr.StatusCode != code {
			t.Errorf("StatusCode = %d, want %d", httpErr.StatusCode, code)
		}
		if strings.Contains(httpErr.Error(), "gsk_secret_token_999") {
			t.Errorf("erro vazou chave secreta: %s", httpErr.Error())
		}
	}
}
