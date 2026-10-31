package ai

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// modeloDoPath extrai o modelo do caminho "/v1beta/models/<modelo>:generateContent".
func modeloDoPath(p string) string {
	idx := strings.Index(p, "/models/")
	if idx < 0 {
		return ""
	}
	rest := p[idx+len("/models/"):]
	if i := strings.Index(rest, ":"); i >= 0 {
		rest = rest[:i]
	}
	return rest
}

// TestGeminiModelChain_ContemFallbacksVerificados trava a cadeia de modelos do Gemini.
//
// Contexto: em 21/10/2026 o modelo primário (gemini-2.5-flash) respondia HTTP 429
// (cota do free tier esgotada) e a cadeia antiga tinha UM único elemento quando o
// modelo configurado era exatamente o 2.5-flash — o que matava qualquer análise de
// imagem sem nenhuma alternativa.
func TestGeminiModelChain_ContemFallbacksVerificados(t *testing.T) {
	chain := geminiModelChain("gemini-2.5-flash")

	want := []string{
		"gemini-2.5-flash",
		"gemini-3-flash-preview",
		"gemini-3.5-flash-lite",
		"gemini-3.5-flash",
		"gemini-flash-latest",
	}
	for _, w := range want {
		found := false
		for _, m := range chain {
			if m == w {
				found = true
				break
			}
		}
		if !found {
			t.Errorf("cadeia de modelos deve conter %q, obteve %v", w, chain)
		}
	}

	seen := map[string]bool{}
	for _, m := range chain {
		if seen[m] {
			t.Errorf("modelo duplicado na cadeia: %s", m)
		}
		seen[m] = true
	}
}

// TestGeminiProvider_ParseIntent_FallbackOnQuota429 garante que a cota esgotada
// (HTTP 429) do modelo primário não derrube a análise: o provedor avança na cadeia.
func TestGeminiProvider_ParseIntent_FallbackOnQuota429(t *testing.T) {
	var modelos []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		modelo := modeloDoPath(r.URL.Path)
		modelos = append(modelos, modelo)
		if modelo == "gemini-2.5-flash" {
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error":{"code":429,"message":"quota exceeded"}}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"{\"action\":\"general_chat\",\"message\":\"li a imagem\"}"}]}}]}`))
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
		t.Fatalf("esperava sucesso via fallback de cota, obteve erro: %v", err)
	}
	if intent.Message != "li a imagem" {
		t.Errorf("mensagem inesperada: %s", intent.Message)
	}
	if len(modelos) < 2 {
		t.Fatalf("esperava ao menos 2 tentativas de modelo, obteve %d (%v)", len(modelos), modelos)
	}
	if modelos[0] != "gemini-2.5-flash" {
		t.Errorf("primeira tentativa deveria ser o modelo primário, obteve %s", modelos[0])
	}
	if modelos[1] == "gemini-2.5-flash" {
		t.Errorf("segunda tentativa repetiu o modelo primário: %v", modelos)
	}
}

// TestGeminiProvider_ParseIntent_FallbackOn503Unavailable garante o advance em
// indisponibilidade (503), já que o Google está sob picos de demanda.
func TestGeminiProvider_ParseIntent_FallbackOn503Unavailable(t *testing.T) {
	var modelos []string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		modelo := modeloDoPath(r.URL.Path)
		modelos = append(modelos, modelo)
		if modelo == "gemini-2.5-flash" {
			w.WriteHeader(http.StatusServiceUnavailable)
			_, _ = w.Write([]byte(`{"error":{"code":503,"message":"high demand"}}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"{\"action\":\"general_chat\",\"message\":\"ok\"}"}]}}]}`))
	}))
	defer server.Close()

	p := &GeminiProvider{
		apiKey:     "test-key",
		model:      "gemini-2.5-flash",
		baseURL:    server.URL,
		httpClient: server.Client(),
	}

	if _, err := p.ParseIntent(context.Background(), UserInput{Text: "oi", ImageB64: "aW1n"}); err != nil {
		t.Fatalf("esperava sucesso via fallback de 503, obteve erro: %v", err)
	}
	if len(modelos) < 2 {
		t.Errorf("esperava ao menos 2 tentativas, obteve %d (%v)", len(modelos), modelos)
	}
}

// TestGeminiProvider_ParseIntent_ThinkingConfigSomenteFamilia25
//
// O parâmetro thinkingConfig só é aceito pela família 2.5: enviar para
// gemini-3.5-flash-lite devolve HTTP 400 ("thinkingConfig" inválido).
func TestGeminiProvider_ParseIntent_ThinkingConfigSomenteFamilia25(t *testing.T) {
	var corpo []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		corpo, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"{\"action\":\"general_chat\",\"message\":\"ok\"}"}]}}]}`))
	}))
	defer server.Close()

	p := &GeminiProvider{
		apiKey:     "test-key",
		model:      "gemini-3.5-flash-lite",
		baseURL:    server.URL,
		httpClient: server.Client(),
	}

	if _, err := p.ParseIntent(context.Background(), UserInput{Text: "oi", ImageB64: "aW1n"}); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if strings.Contains(string(corpo), "thinkingConfig") {
		t.Errorf("modelo fora da família 2.5 não deve receber thinkingConfig")
	}
}

// TestGeminiProvider_ParseIntent_ThinkingConfigNaFamilia25 garante que a
// otimização de latência (thinking desligado) continua valendo no 2.5-flash.
func TestGeminiProvider_ParseIntent_ThinkingConfigNaFamilia25(t *testing.T) {
	var corpo []byte
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		corpo, _ = io.ReadAll(r.Body)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"candidates":[{"content":{"parts":[{"text":"{\"action\":\"general_chat\",\"message\":\"ok\"}"}]}}]}`))
	}))
	defer server.Close()

	p := &GeminiProvider{
		apiKey:     "test-key",
		model:      "gemini-2.5-flash",
		baseURL:    server.URL,
		httpClient: server.Client(),
	}

	if _, err := p.ParseIntent(context.Background(), UserInput{Text: "oi"}); err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if !strings.Contains(string(corpo), "thinkingConfig") {
		t.Error("modelo 2.5 deve receber thinkingConfig")
	}
	if !strings.Contains(string(corpo), "\"thinkingBudget\":0") {
		t.Error("esperava thinkingBudget 0 no corpo")
	}
}

// TestAttemptTimeout_MultimodalTemJanelaMaior trava a janela de tempo por modalidade.
//
// A latência real de uma análise de imagem medida em produção foi de 57s a 62s
// (contra 2-6s do texto). Com a janela de 15s a requisição era cancelada antes
// de o modelo responder — era essa a causa raiz da falha de imagem no app.
func TestAttemptTimeout_MultimodalTemJanelaMaior(t *testing.T) {
	texto := attemptTimeoutFor(UserInput{Text: "oi"})
	imagem := attemptTimeoutFor(UserInput{Text: "oi", ImageB64: "aW1n"})
	audio := attemptTimeoutFor(UserInput{Text: "oi", AudioB64: "YXVkaW8="})

	if texto != attemptTimeoutText {
		t.Errorf("timeout de texto esperado %s, obteve %s", attemptTimeoutText, texto)
	}
	if imagem <= attemptTimeoutText {
		t.Errorf("timeout de imagem (%s) deve ser maior que o de texto (%s)", imagem, attemptTimeoutText)
	}
	if audio <= attemptTimeoutText {
		t.Errorf("timeout de áudio (%s) deve ser maior que o de texto (%s)", audio, attemptTimeoutText)
	}
	if imagem > 90*time.Second {
		t.Errorf("timeout de imagem não pode passar de 90s (teto do túnel), obteve %s", imagem)
	}
}

// TestMediaTotalBudget_LimitaACascata garante que a cascata multimodal não
// ultrapasse o orçamento (o Cloudflare Tunnel corta requisições em ~100s).
func TestMediaTotalBudget_LimitaACascata(t *testing.T) {
	if mediaTotalBudget > 95*time.Second {
		t.Errorf("orçamento multimodal (%s) deve ficar abaixo de 95s", mediaTotalBudget)
	}
	if mediaTotalBudget < attemptTimeoutMedia {
		t.Errorf("orçamento (%s) deve permitir ao menos uma tentativa completa (%s)", mediaTotalBudget, attemptTimeoutMedia)
	}
}
