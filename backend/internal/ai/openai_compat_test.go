package ai_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

func TestOpenAICompatProvider_EvaluateTrigger(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"choices": [
				{
					"message": {
						"content": "{\"condition_met\":true,\"current_data\":\"Taxa Selic mantida em 10.5%\",\"summary\":\"O Copom manteve a taxa Selic conforme o esperado pelo mercado.\",\"simulated_notification\":\"Alerta Vito: Decisão do Copom sobre taxa Selic.\",\"confidence\":90,\"why_relevant\":\"Decisão atual do Copom diretamente ligada à vigília da Selic.\"}"
					}
				}
			]
		}`))
	}))
	defer server.Close()

	prov := ai.NewOpenAICompatProviderForTest("Groq Test", server.URL, "fake-key", "qwen/qwen3.8-27b", server.Client())

	trig := &domain.Trigger{
		ID:       "trig-selic",
		Title:    "Decisão Selic",
		Category: "financas",
		Query:    "taxa selic copom",
	}

	res, err := prov.EvaluateTrigger(context.Background(), trig)
	if err != nil {
		t.Fatalf("EvaluateTrigger falhou inesperadamente: %v", err)
	}

	if !res.ConditionMet {
		t.Errorf("Esperava ConditionMet=true, obteve false")
	}
	if res.Summary != "O Copom manteve a taxa Selic conforme o esperado pelo mercado." {
		t.Errorf("Summary inesperado: %s", res.Summary)
	}
	if res.CurrentData != "Taxa Selic mantida em 10.5%" {
		t.Errorf("CurrentData inesperado: %s", res.CurrentData)
	}
}

func TestOpenAICompatProvider_GenerateText(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{
			"choices": [
				{
					"message": {
						"content": "Hoje foi um dia de alta intensidade, com 4 reuniões e 3 tarefas concluídas."
					}
				}
			]
		}`))
	}))
	defer server.Close()

	prov := ai.NewOpenAICompatProviderForTest("OpenRouter Test", server.URL, "fake-key", "nvidia/nemotron", server.Client())

	text, err := prov.GenerateText(context.Background(), "Você é um assistente executivo.", "Sintetize o dia do usuário.")
	if err != nil {
		t.Fatalf("GenerateText falhou inesperadamente: %v", err)
	}

	if text != "Hoje foi um dia de alta intensidade, com 4 reuniões e 3 tarefas concluídas." {
		t.Errorf("Texto gerado inesperado: %s", text)
	}
}
