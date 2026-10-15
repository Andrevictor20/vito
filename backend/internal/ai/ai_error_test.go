package ai_test

import (
	"errors"
	"testing"

	"github.com/andrevmp/vito/backend/internal/ai"
)

func TestClassifyAIError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want ai.AIErrorClass
	}{
		{"quota 429", errors.New("gemini api error (status 429): quota exceeded"), ai.AIErrorQuota},
		{"rate limit", errors.New("Rate limit reached, retry later"), ai.AIErrorQuota},
		{"auth 401", errors.New("api error (status 401): invalid api key"), ai.AIErrorAuth},
		{"model not found", errors.New(`api error (status 404): {"code":"model_not_found"}`), ai.AIErrorAuth},
		{"sem chave", errors.New("chave de api do gemini não configurada"), ai.AIErrorAuth},
		{"timeout deadline", errors.New("Post https://x: context deadline exceeded"), ai.AIErrorTimeout},
		{"dial tcp", errors.New("dial tcp: lookup timeout"), ai.AIErrorTimeout},
		{"parse json", errors.New("falha ao interpretar json: invalid character"), ai.AIErrorParse},
		{"resposta vazia", errors.New("resposta vazia do provedor"), ai.AIErrorParse},
		{"desconhecido", errors.New("algo estranho aconteceu"), ai.AIErrorUnknown},
		{"nil", nil, ai.AIErrorUnknown},
	}
	for _, c := range cases {
		if got := ai.ClassifyAIError(c.err); got != c.want {
			t.Errorf("%s: classifiquei %q, queria %q", c.name, got, c.want)
		}
	}
}

func TestFriendlyAIMessage(t *testing.T) {
	if got := ai.FriendlyAIMessage(ai.AIErrorQuota); !containsWord(got, "sobrecarregada") {
		t.Errorf("quota deveria falar em sobrecarga, veio %q", got)
	}
	if got := ai.FriendlyAIMessage(ai.AIErrorTimeout); !containsWord(got, "demorou") {
		t.Errorf("timeout deveria falar em demora, veio %q", got)
	}
	for _, c := range []ai.AIErrorClass{ai.AIErrorQuota, ai.AIErrorAuth, ai.AIErrorTimeout, ai.AIErrorParse, ai.AIErrorUnknown} {
		got := ai.FriendlyAIMessage(c)
		if containsWord(got, "sk-") || containsWord(got, "key=") {
			t.Errorf("mensagem nunca deve vazar segredo: %q", got)
		}
		if !containsWord(got, "Nada foi criado") {
			t.Errorf("mensagem deve preservar garantia de nada-criado: %q", got)
		}
	}
}

func containsWord(s, w string) bool {
	return len(s) >= len(w) && (func() bool {
		for i := 0; i+len(w) <= len(s); i++ {
			if s[i:i+len(w)] == w {
				return true
			}
		}
		return false
	})()
}
