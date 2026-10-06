package ai

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestGeminiProvider_Capabilities(t *testing.T) {
	p := NewGeminiProvider("fake-key", "")
	if !p.SupportsVision() {
		t.Errorf("esperado SupportsVision=true")
	}
	if !p.SupportsAudio() {
		t.Errorf("esperado SupportsAudio=true")
	}
	if p.model != "gemini-2.5-flash" {
		t.Errorf("esperado modelo default gemini-2.5-flash, obteve %s", p.model)
	}
}

func TestGeminiProvider_ParseIntent_SinglePart(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"candidates": [
				{
					"content": {
						"parts": [
							{
								"text": "{\"action\":\"general_chat\",\"message\":\"Olá, imagem processada!\"}"
							}
						]
					}
				}
			]
		}`))
	}))
	defer server.Close()

	p := &GeminiProvider{
		apiKey:     "test-key",
		model:      "gemini-2.5-flash",
		baseURL:    server.URL,
		httpClient: server.Client(),
	}

	intent, err := p.ParseIntent(context.Background(), UserInput{
		Text:     "Analise esta foto",
		ImageB64: "aW1n",
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if intent.Action != ActionGeneralChat {
		t.Errorf("ação esperada %s, obteve %s", ActionGeneralChat, intent.Action)
	}
	if intent.Message != "Olá, imagem processada!" {
		t.Errorf("mensagem inesperada: %s", intent.Message)
	}
}

func TestGeminiProvider_ParseIntent_MultiplePartsWithThinking(t *testing.T) {
	// Simula resposta do Gemini onde a primeira part é thought e a segunda é o JSON
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"candidates": [
				{
					"content": {
						"parts": [
							{
								"text": "Pensando sobre a imagem: vejo um recibo de almoço no valor de 45 reais."
							},
							{
								"text": "{\"action\":\"create_todo\",\"message\":\"Tarefa criada para pagar almoço\",\"todo\":{\"title\":\"Pagar almoço\"}}"
							}
						]
					}
				}
			]
		}`))
	}))
	defer server.Close()

	p := &GeminiProvider{
		apiKey:     "test-key",
		model:      "gemini-2.5-flash",
		baseURL:    server.URL,
		httpClient: server.Client(),
	}

	intent, err := p.ParseIntent(context.Background(), UserInput{
		Text:     "Extraia os dados",
		ImageB64: "aW1n",
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if intent.Action != ActionCreateTodo {
		t.Errorf("ação esperada %s, obteve %s", ActionCreateTodo, intent.Action)
	}
	if intent.Todo == nil || intent.Todo.Title != "Pagar almoço" {
		t.Errorf("todo esperado com título 'Pagar almoço', obteve %+v", intent.Todo)
	}
}

func TestGeminiProvider_ParseIntent_ModelFallbackOn503(t *testing.T) {
	attempts := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempts++
		if attempts == 1 {
			// Primeira tentativa com gemini-flash-latest dá 503
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":{"code":503,"message":"This model is currently experiencing high demand"}}`))
			return
		}
		// Segunda tentativa (fallback para gemini-2.5-flash) dá 200
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"candidates": [
				{
					"content": {
						"parts": [
							{
								"text": "{\"action\":\"general_chat\",\"message\":\"Recuperado com fallback!\"}"
							}
						]
					}
				}
			]
		}`))
	}))
	defer server.Close()

	p := &GeminiProvider{
		apiKey:     "test-key",
		model:      "gemini-flash-latest",
		baseURL:    server.URL,
		httpClient: server.Client(),
	}

	intent, err := p.ParseIntent(context.Background(), UserInput{
		Text:     "Teste fallback",
		ImageB64: "aW1n",
	})
	if err != nil {
		t.Fatalf("esperado sucesso via fallback, obteve erro: %v", err)
	}
	if intent.Message != "Recuperado com fallback!" {
		t.Errorf("mensagem esperada 'Recuperado com fallback!', obteve %s", intent.Message)
	}
	if attempts < 2 {
		t.Errorf("esperava pelo menos 2 tentativas, obteve %d", attempts)
	}
}
