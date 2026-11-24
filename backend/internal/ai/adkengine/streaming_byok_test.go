package adkengine

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"
)

func TestAC04_StreamingEmitsPartialDeltasAllProviders(t *testing.T) {
	t.Run("OpenAICompat_SSE_Partial", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = fmt.Fprint(w, "data: {\"model\":\"gpt-4o-mini\",\"choices\":[{\"delta\":{\"content\":\"Olá \"}}]}\n\n")
			_, _ = fmt.Fprint(w, "data: {\"model\":\"gpt-4o-mini\",\"choices\":[{\"delta\":{\"content\":\"Vito!\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":10,\"completion_tokens\":2}}\n\n")
			_, _ = fmt.Fprint(w, "data: [DONE]\n\n")
		}))
		defer srv.Close()

		llm := NewOpenAICompatLLM("openai", "gpt-4o-mini", srv.URL, "sk-test")
		req := &model.LLMRequest{Contents: []*genai.Content{genai.NewContentFromText("oi", genai.RoleUser)}}
		var partials []string
		var finalText string
		for resp, err := range llm.GenerateContent(context.Background(), req, true) {
			if err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if resp.Partial && resp.Content != nil && len(resp.Content.Parts) > 0 {
				partials = append(partials, resp.Content.Parts[0].Text)
			} else if !resp.Partial && resp.Content != nil && len(resp.Content.Parts) > 0 {
				finalText = resp.Content.Parts[0].Text
			}
		}
		if len(partials) != 2 || partials[0] != "Olá " || partials[1] != "Vito!" {
			t.Fatalf("esperava 2 deltas parciais ['Olá ', 'Vito!'], obteve %+v", partials)
		}
		if finalText != "Olá Vito!" {
			t.Fatalf("esperava texto final consolidado 'Olá Vito!', obteve %q", finalText)
		}
	})

	t.Run("Anthropic_SSE_Partial", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/event-stream")
			_, _ = fmt.Fprint(w, "event: message_start\ndata: {\"type\":\"message_start\",\"message\":{\"model\":\"claude-3-7-sonnet\",\"usage\":{\"input_tokens\":12}}}\n\n")
			_, _ = fmt.Fprint(w, "event: content_block_start\ndata: {\"type\":\"content_block_start\",\"index\":0,\"content_block\":{\"type\":\"text\"}}\n\n")
			_, _ = fmt.Fprint(w, "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Oi \"}}\n\n")
			_, _ = fmt.Fprint(w, "event: content_block_delta\ndata: {\"type\":\"content_block_delta\",\"index\":0,\"delta\":{\"type\":\"text_delta\",\"text\":\"Claude!\"}}\n\n")
			_, _ = fmt.Fprint(w, "event: message_delta\ndata: {\"type\":\"message_delta\",\"delta\":{\"stop_reason\":\"end_turn\"},\"usage\":{\"output_tokens\":3}}\n\n")
		}))
		defer srv.Close()

		llm := NewAnthropicLLM("claude-3-7-sonnet", "sk-ant-test", WithAnthropicBaseURL(srv.URL))
		req := &model.LLMRequest{Contents: []*genai.Content{genai.NewContentFromText("oi", genai.RoleUser)}}
		var partials []string
		for resp, err := range llm.GenerateContent(context.Background(), req, true) {
			if err != nil {
				t.Fatalf("erro inesperado: %v", err)
			}
			if resp.Partial && resp.Content != nil && len(resp.Content.Parts) > 0 {
				partials = append(partials, resp.Content.Parts[0].Text)
			}
		}
		if len(partials) != 2 || partials[0] != "Oi " || partials[1] != "Claude!" {
			t.Fatalf("esperava 2 deltas parciais Anthropic, obteve %+v", partials)
		}
	})
}
