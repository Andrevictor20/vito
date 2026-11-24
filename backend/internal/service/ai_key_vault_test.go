package service_test

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

func TestAIKeyVault_SealOpenAndBinding(t *testing.T) {
	vault := service.NewAIKeyVault("0123456789abcdef0123456789abcdef")
	secret := "sk-ant-api03-very-secret-key-9876"

	ct, err := vault.Seal("user-1", domain.ProviderKeyAnthropic, secret)
	if err != nil {
		t.Fatalf("Seal falhou: %v", err)
	}
	if ct == "" || ct == secret {
		t.Fatalf("ciphertext inválido: %q", ct)
	}

	pt, err := vault.Open("user-1", domain.ProviderKeyAnthropic, ct)
	if err != nil {
		t.Fatalf("Open falhou: %v", err)
	}
	if pt != secret {
		t.Fatalf("esperava %q, obteve %q", secret, pt)
	}

	// Context binding: outro usuário ou outro provedor deve falhar na decifragem.
	if _, err := vault.Open("user-2", domain.ProviderKeyAnthropic, ct); err == nil {
		t.Fatal("esperava erro ao abrir ciphertext de outro usuário")
	}
	if _, err := vault.Open("user-1", domain.ProviderKeyOpenAI, ct); err == nil {
		t.Fatal("esperava erro ao abrir ciphertext para outro provedor")
	}

	if got := service.Last4(secret); got != "9876" {
		t.Fatalf("Last4 esperado '9876', veio %q", got)
	}
}

func TestValidateProviderKeyFormat(t *testing.T) {
	tests := []struct {
		name     string
		provider domain.ProviderKey
		key      string
		url      string
		wantErr  string
	}{
		{"empty standard", domain.ProviderKeyAnthropic, "   ", "", "Preencha a chave."},
		{"empty custom url", domain.ProviderKeyCustom, "secret", "", "Preencha o endereço e a chave."},
		{"empty custom key", domain.ProviderKeyCustom, "", "http://192.168.0.20:11434/v1", "Preencha o endereço e a chave."},
		{"custom missing scheme", domain.ProviderKeyCustom, "local-key", "192.168.0.20:11434/v1", "O endereço precisa começar com http:// ou https://."},
		{"claude wrong prefix", domain.ProviderKeyAnthropic, "gsk_abc123", "", "Esta chave não parece ser do Claude. Ela deve começar com sk-ant-."},
		{"google wrong prefix", domain.ProviderKeyGoogle, "sk-abc123", "", "Esta chave não parece ser do Gemini. Ela deve começar com AIza."},
		{"groq wrong prefix", domain.ProviderKeyGroq, "sk-abc123", "", "Esta chave não parece ser do Groq. Ela deve começar com gsk_."},
		{"openrouter wrong prefix", domain.ProviderKeyOpenRouter, "sk-abc123", "", "Esta chave não parece ser do OpenRouter. Ela deve começar com sk-or-."},
		{"openai rejects sk-ant-", domain.ProviderKeyOpenAI, "sk-ant-123", "", "Esta chave parece ser de outro provedor."},
		{"openai rejects sk-or-", domain.ProviderKeyOpenAI, "sk-or-123", "", "Esta chave parece ser de outro provedor."},
		{"openai wrong prefix", domain.ProviderKeyOpenAI, "AIza123", "", "Esta chave não parece ser do OpenAI. Ela deve começar com sk-."},
		{"valid anthropic", domain.ProviderKeyAnthropic, "sk-ant-1234", "", ""},
		{"valid google", domain.ProviderKeyGoogle, "AIzaSy1234", "", ""},
		{"valid google aq", domain.ProviderKeyGoogle, "AQ.Ab8RN6abcdef123456", "", ""},
		{"valid openai", domain.ProviderKeyOpenAI, "sk-proj-1234", "", ""},
		{"valid groq", domain.ProviderKeyGroq, "gsk_1234", "", ""},
		{"valid openrouter", domain.ProviderKeyOpenRouter, "sk-or-v1-1234", "", ""},
		{"valid custom", domain.ProviderKeyCustom, "ollama-key", "http://192.168.0.20:11434/v1", ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			err := service.ValidateProviderKeyFormat(tc.provider, tc.key, tc.url)
			if tc.wantErr == "" {
				if err != nil {
					t.Fatalf("não esperava erro, veio %v", err)
				}
				return
			}
			if err == nil || err.Error() != tc.wantErr {
				t.Fatalf("esperava erro %q, veio %v", tc.wantErr, err)
			}
		})
	}
}
