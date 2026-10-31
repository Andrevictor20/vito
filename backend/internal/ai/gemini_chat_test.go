package ai_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestGeminiAgentProvider_Chat(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("esperava método POST, obteve %s", r.Method)
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"candidates": [{
				"content": {
					"parts": [{"text": "Olá! Sou o Vito assistente com Gemini."}],
					"role": "model"
				},
				"finishReason": "STOP"
			}],
			"usageMetadata": {
				"promptTokenCount": 12,
				"candidatesTokenCount": 18,
				"totalTokenCount": 30
			}
		}`)
	}))
	defer ts.Close()

	provider := ai.NewGeminiAgentProviderForTest("test-key", "gemini-2.5-flash", ts.URL, ts.Client())

	if provider.QualityTier() != 3 {
		t.Errorf("esperava QualityTier 3, obteve %d", provider.QualityTier())
	}
	if !provider.SupportsTools() || !provider.SupportsVision() {
		t.Errorf("esperava SupportsTools e SupportsVision verdadeiros")
	}

	req := ai.AgentChatRequest{
		SystemPrompt: "Você é o Vito.",
		Messages: []ai.TurnMessage{
			{Role: ai.RoleUser, Content: "Quem é você?"},
		},
	}

	resp, err := provider.Chat(context.Background(), req)
	if err != nil {
		t.Fatalf("falha inesperada no Chat: %v", err)
	}

	if resp.Text != "Olá! Sou o Vito assistente com Gemini." {
		t.Errorf("texto incorreto: %q", resp.Text)
	}
	if resp.TokensIn != 12 || resp.TokensOut != 18 {
		t.Errorf("tokens incorretos: in=%d, out=%d", resp.TokensIn, resp.TokensOut)
	}
}

func TestGeminiAgentProvider_Chat_FunctionCalling(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"candidates": [{
				"content": {
					"parts": [{
						"functionCall": {
							"name": "calendar_manager",
							"args": {
								"operation": "list_events",
								"params": {"date": "2026-10-31"}
							}
						}
					}],
					"role": "model"
				}
			}],
			"usageMetadata": {
				"promptTokenCount": 25,
				"candidatesTokenCount": 15
			}
		}`)
	}))
	defer ts.Close()

	provider := ai.NewGeminiAgentProviderForTest("test-key", "gemini-2.5-flash", ts.URL, ts.Client())

	req := ai.AgentChatRequest{
		Messages: []ai.TurnMessage{
			{Role: ai.RoleUser, Content: "Quais são meus compromissos de hoje?"},
		},
		Tools: []ai.ToolDefinition{
			{
				Name:        "calendar_manager",
				Description: "Gerencia eventos de calendário",
			},
		},
	}

	resp, err := provider.Chat(context.Background(), req)
	if err != nil {
		t.Fatalf("falha no Chat com Function Calling: %v", err)
	}

	if len(resp.ToolCalls) != 1 {
		t.Fatalf("esperava 1 tool call, obteve %d", len(resp.ToolCalls))
	}
	tc := resp.ToolCalls[0]
	if tc.Name != "calendar_manager" {
		t.Errorf("nome da tool incorreto: %q", tc.Name)
	}
	if string(tc.Arguments) == "" {
		t.Errorf("arguments da tool call vazio")
	}
}

func TestGeminiAgentProvider_StreamChat(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)

		fmt.Fprint(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"Streaming \"}]}}]}\n\n")
		flusher.Flush()
		fmt.Fprint(w, "data: {\"candidates\":[{\"content\":{\"parts\":[{\"text\":\"com Gemini!\"}]}}],\"usageMetadata\":{\"promptTokenCount\":10,\"candidatesTokenCount\":6}}\n\n")
		flusher.Flush()
		fmt.Fprint(w, "data: [DONE]\n\n")
		flusher.Flush()
	}))
	defer ts.Close()

	provider := ai.NewGeminiAgentProviderForTest("test-key", "gemini-2.5-flash", ts.URL, ts.Client())

	var collected string
	var finalDone bool
	onDelta := func(delta ai.StreamDelta) error {
		collected += delta.TextDelta
		if delta.Done {
			finalDone = true
		}
		return nil
	}

	req := ai.AgentChatRequest{
		Messages: []ai.TurnMessage{
			{Role: ai.RoleUser, Content: "Diga streaming"},
		},
	}

	resp, err := provider.StreamChat(context.Background(), req, onDelta)
	if err != nil {
		t.Fatalf("falha no StreamChat: %v", err)
	}

	if collected != "Streaming com Gemini!" {
		t.Errorf("texto coletado no stream divergente: %q", collected)
	}
	if !finalDone {
		t.Errorf("esperava finalDone true")
	}
	if resp.TokensIn != 10 || resp.TokensOut != 6 {
		t.Errorf("tokens finais divergentes: in=%d, out=%d", resp.TokensIn, resp.TokensOut)
	}
}

func TestGeminiAgentProvider_ErrorResponse(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTooManyRequests)
		fmt.Fprintln(w, `{"error":{"code":429,"message":"Resource exhausted"}}`)
	}))
	defer ts.Close()

	provider := ai.NewGeminiAgentProviderForTest("test-key", "gemini-2.5-flash", ts.URL, ts.Client())
	req := ai.AgentChatRequest{
		Messages: []ai.TurnMessage{{Role: ai.RoleUser, Content: "Teste de erro"}},
	}

	_, err := provider.Chat(context.Background(), req)
	if err == nil {
		t.Fatal("esperava erro ao receber HTTP 429")
	}
}
