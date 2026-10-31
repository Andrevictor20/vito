package ai_test

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestOpenAICompatAgentProvider_Chat(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"choices": [{
				"message": {
					"role": "assistant",
					"content": "Olá! Em que posso ajudar?",
					"tool_calls": [{
						"id": "call-1",
						"type": "function",
						"function": {
							"name": "calendar_manager",
							"arguments": "{\"operation\":\"list_events\"}"
						}
					}]
				}
			}],
			"usage": {
				"prompt_tokens": 15,
				"completion_tokens": 20
			}
		}`)
	}))
	defer ts.Close()

	provider := ai.NewOpenAICompatAgentProvider(
		"test-provider",
		"test-model",
		ts.URL,
		"test-key",
		2,
		true,
		false,
		4096,
	)

	req := ai.AgentChatRequest{
		SystemPrompt: "Você é o Vito.",
		Messages: []ai.TurnMessage{
			{Role: ai.RoleUser, Content: "Listar compromissos"},
		},
	}

	resp, err := provider.Chat(context.Background(), req)
	if err != nil {
		t.Fatalf("falha no Chat: %v", err)
	}

	if resp.Text != "Olá! Em que posso ajudar?" {
		t.Errorf("texto inesperado: %q", resp.Text)
	}
	if len(resp.ToolCalls) != 1 || resp.ToolCalls[0].Name != "calendar_manager" {
		t.Errorf("tool call inesperada: %+v", resp.ToolCalls)
	}
	if resp.TokensIn != 15 || resp.TokensOut != 20 {
		t.Errorf("tokens incorretos: in=%d, out=%d", resp.TokensIn, resp.TokensOut)
	}
}

func TestOpenAICompatAgentProvider_StreamChat(t *testing.T) {
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/event-stream")
		flusher, _ := w.(http.Flusher)

		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"Olá \"}}]}\n\n")
		flusher.Flush()
		fmt.Fprint(w, "data: {\"choices\":[{\"delta\":{\"content\":\"mundo!\"}}]}\n\n")
		flusher.Flush()
		fmt.Fprint(w, "data: [DONE]\n\n")
		flusher.Flush()
	}))
	defer ts.Close()

	provider := ai.NewOpenAICompatAgentProvider(
		"test-provider",
		"test-model",
		ts.URL,
		"test-key",
		3,
		true,
		false,
		4096,
	)

	var collected string
	onDelta := func(delta ai.StreamDelta) error {
		collected += delta.TextDelta
		return nil
	}

	resp, err := provider.StreamChat(context.Background(), ai.AgentChatRequest{}, onDelta)
	if err != nil {
		t.Fatalf("falha no StreamChat: %v", err)
	}

	if resp.Text != "Olá mundo!" || collected != "Olá mundo!" {
		t.Errorf("texto esperado 'Olá mundo!', obteve resp=%q collected=%q", resp.Text, collected)
	}
}
