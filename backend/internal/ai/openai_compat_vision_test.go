package ai

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestOpenAICompatProvider_VisaoMontaDataURL valida o payload multimodal no
// formato OpenAI (image_url com data URL) usado pelo elo de visão via OpenRouter.
func TestOpenAICompatProvider_VisaoMontaDataURL(t *testing.T) {
	var corpo map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&corpo)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"action\":\"general_chat\",\"message\":\"li a imagem\"}"}}]}`))
	}))
	defer server.Close()

	p := NewOpenAICompatProviderForTest("OpenRouter Vision", server.URL, "key", "google/gemini-3.5-flash-lite", server.Client())
	p.visionCapable = true

	intent, err := p.ParseIntent(context.Background(), UserInput{
		Text:      "Descreva a imagem",
		ImageB64:  "aW1n",
		ImageMime: "image/png",
	})
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if intent.Message != "li a imagem" {
		t.Errorf("mensagem inesperada: %s", intent.Message)
	}

	mensagens, ok := corpo["messages"].([]any)
	if !ok || len(mensagens) != 2 {
		t.Fatalf("corpo sem mensagens (system + user): %v", corpo)
	}
	conteudo, ok := mensagens[1].(map[string]any)["content"].([]any)
	if !ok || len(conteudo) != 2 {
		t.Fatalf("conteúdo multimodal inesperado: %v", mensagens[1])
	}
	img, ok := conteudo[1].(map[string]any)["image_url"].(map[string]any)
	if !ok {
		t.Fatalf("esperava parte image_url, obteve: %v", conteudo[1])
	}
	url, _ := img["url"].(string)
	if !strings.HasPrefix(url, "data:image/png;base64,") {
		t.Errorf("esperava data URL com mime image/png, obteve: %s", url)
	}
	if !strings.HasSuffix(url, "aW1n") {
		t.Errorf("data URL deveria conter o base64 da imagem, obteve: %s", url)
	}
}

// TestOpenAICompatProvider_LimitaMaxTokens na visão.
//
// Sem max_tokens o OpenRouter calcula a cobrança pelo teto do modelo e devolve
// HTTP 402 ("requires more credits") — a visão morria antes de chamar o modelo.
func TestOpenAICompatProvider_LimitaMaxTokensNaVisao(t *testing.T) {
	var corpo map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&corpo)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"action\":\"general_chat\",\"message\":\"ok\"}"}}]}`))
	}))
	defer server.Close()

	p := NewOpenAICompatProviderForTest("OpenRouter Vision", server.URL, "key", "google/gemini-3.5-flash-lite", server.Client())
	p.visionCapable = true

	if _, err := p.ParseIntent(context.Background(), UserInput{Text: "x", ImageB64: "aW1n", ImageMime: "image/png"}); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	maxTokens, ok := corpo["max_tokens"].(float64)
	if !ok {
		t.Fatalf("corpo sem max_tokens: %v", corpo)
	}
	if maxTokens <= 0 || maxTokens > 8000 {
		t.Errorf("max_tokens deveria estar entre 1 e 8000, obteve %v", maxTokens)
	}
}

// TestOpenAICompatProvider_CapacidadeDeVisaoPorInstancia garante que só a
// instância marcada como visão receba imagens (Groq e Mistral não têm modelo
// de visão acessível — devolveram 404).
func TestOpenAICompatProvider_CapacidadeDeVisaoPorInstancia(t *testing.T) {
	if NewOpenRouterProvider("key", "google/gemini-3.5-flash-lite").SupportsVision() {
		t.Error("provedor de texto não deve declarar suporte a visão")
	}
	if !NewOpenRouterVisionProvider("key", "google/gemini-3.5-flash-lite").SupportsVision() {
		t.Error("provedor de visão deveria declarar suporte a visão")
	}
}
