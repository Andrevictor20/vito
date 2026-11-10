package ai_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
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

func TestGeminiAgentProvider_PreservesThoughtSignature(t *testing.T) {
	var capturedBody string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"candidates": [{
				"content": {
					"parts": [{
						"functionCall": {
							"name": "web_and_vertical_search",
							"args": {"query": "worlds lol"}
						},
						"thoughtSignature": "sig-gemini-25-test"
					}],
					"role": "model"
				}
			}]
		}`)
	}))
	defer ts.Close()

	provider := ai.NewGeminiAgentProviderForTest("test-key", "gemini-2.5-flash", ts.URL, ts.Client())
	req := ai.AgentChatRequest{
		Messages: []ai.TurnMessage{
			{Role: ai.RoleUser, Content: "Notícias de Worlds"},
		},
		Tools: []ai.ToolDefinition{
			{Name: "web_and_vertical_search", Description: "Busca web"},
		},
	}

	resp, err := provider.Chat(context.Background(), req)
	if err != nil {
		t.Fatalf("falha no Chat: %v", err)
	}

	if len(resp.ToolCalls) != 1 {
		t.Fatalf("esperava 1 tool call, obteve %d", len(resp.ToolCalls))
	}
	if resp.ToolCalls[0].ThoughtSignature != "sig-gemini-25-test" {
		t.Fatalf("esperava ThoughtSignature 'sig-gemini-25-test', obteve %q", resp.ToolCalls[0].ThoughtSignature)
	}

	// Agora testa se ao reenviar RoleAssistant com ThoughtSignature, o payload enviado ao servidor preserva a assinatura
	ts2 := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		buf := make([]byte, r.ContentLength)
		_, _ = r.Body.Read(buf)
		capturedBody = string(buf)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"candidates": [{
				"content": {
					"parts": [{"text": "Notícias encontradas com sucesso."}],
					"role": "model"
				}
			}]
		}`)
	}))
	defer ts2.Close()

	provider2 := ai.NewGeminiAgentProviderForTest("test-key", "gemini-2.5-flash", ts2.URL, ts2.Client())
	req2 := ai.AgentChatRequest{
		Messages: []ai.TurnMessage{
			{Role: ai.RoleUser, Content: "Notícias de Worlds"},
			{
				Role: ai.RoleAssistant,
				ToolCalls: []ai.ToolCall{
					{
						ID:               "call_1",
						Name:             "web_and_vertical_search",
						Arguments:        []byte(`{"query":"worlds lol"}`),
						ThoughtSignature: "sig-gemini-25-test",
					},
				},
			},
			{
				Role:       ai.RoleTool,
				Name:       "web_and_vertical_search",
				ToolCallID: "call_1",
				Content:    "T1 venceu a semifinal",
			},
		},
	}

	_, err = provider2.Chat(context.Background(), req2)
	if err != nil {
		t.Fatalf("falha no Chat passo 2: %v", err)
	}

	if capturedBody == "" || !containsStr(capturedBody, "sig-gemini-25-test") {
		t.Errorf("corpo da requisição deve conter 'thoughtSignature': %s", capturedBody)
	}
}

func TestGeminiAgentProvider_RetriesOn400AcrossChain(t *testing.T) {
	attempt := 0
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempt++
		if attempt == 1 {
			// Primeiro modelo rejeita com 400 INVALID_ARGUMENT (ex: flag incompatível)
			w.WriteHeader(http.StatusBadRequest)
			fmt.Fprintln(w, `{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}`)
			return
		}
		// Segundo modelo da cadeia aceita e responde com sucesso
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"candidates": [{
				"content": {
					"parts": [{"text": "Resposta recuperada via modelo de fallback."}],
					"role": "model"
				}
			}]
		}`)
	}))
	defer ts.Close()

	provider := ai.NewGeminiAgentProviderForTest("test-key", "gemini-2.5-flash", ts.URL, ts.Client())
	req := ai.AgentChatRequest{
		Messages: []ai.TurnMessage{{Role: ai.RoleUser, Content: "Pergunta"}},
	}

	resp, err := provider.Chat(context.Background(), req)
	if err != nil {
		t.Fatalf("esperava recuperação no modelo seguinte em erro 400, obteve erro: %v", err)
	}

	if resp.Text != "Resposta recuperada via modelo de fallback." {
		t.Errorf("resposta inesperada: %q", resp.Text)
	}
}

func TestGeminiAgentProvider_Chat_VoiceChannelTokenConfig(t *testing.T) {
	var capturedBody []byte
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedBody, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{
			"candidates": [{
				"content": {
					"parts": [{"text": "Resposta de voz clara e objetiva."}],
					"role": "model"
				},
				"finishReason": "STOP"
			}]
		}`)
	}))
	defer ts.Close()

	provider := ai.NewGeminiAgentProviderForTest("test-key", "gemini-2.5-flash", ts.URL, ts.Client())
	req := ai.AgentChatRequest{
		Channel: "voice",
		Messages: []ai.TurnMessage{
			{Role: ai.RoleUser, Content: "O que tem na minha agenda?"},
		},
	}

	_, err := provider.Chat(context.Background(), req)
	if err != nil {
		t.Fatalf("falha no chat de voz: %v", err)
	}

	var parsed struct {
		GenerationConfig struct {
			MaxOutputTokens int `json:"maxOutputTokens"`
		} `json:"generationConfig"`
	}
	if err := json.Unmarshal(capturedBody, &parsed); err != nil {
		t.Fatalf("falha ao decodificar corpo enviado: %v", err)
	}

	if parsed.GenerationConfig.MaxOutputTokens != 350 {
		t.Errorf("esperava MaxOutputTokens=350 para canal voice, obteve %d", parsed.GenerationConfig.MaxOutputTokens)
	}
}

func containsStr(s, sub string) bool {
	return len(s) >= len(sub) && (s == sub || len(s) > 0 && containsSub(s, sub))
}

func containsSub(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
