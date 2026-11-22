package ai

import (
	"strings"
	"testing"
)

func TestRedactSecrets(t *testing.T) {
	tests := []struct {
		name   string
		input  string
		secret string
	}{
		{
			name:   "Anthropic key",
			input:  "falha ao chamar Anthropic com chave sk-ant-api03-secretToken123456",
			secret: "sk-ant-api03-secretToken123456",
		},
		{
			name:   "OpenRouter key",
			input:  "erro openrouter key=sk-or-v1-abc123def456ghi789",
			secret: "sk-or-v1-abc123def456ghi789",
		},
		{
			name:   "OpenAI key",
			input:  "openai rejected sk-proj-superSecretKeyValue998877",
			secret: "sk-proj-superSecretKeyValue998877",
		},
		{
			name:   "Groq key",
			input:  "groq gsk_SecretGroqTokenABC123456789 failed",
			secret: "gsk_SecretGroqTokenABC123456789",
		},
		{
			name:   "Google AIza key",
			input:  "GET https://generativelanguage.googleapis.com/v1beta/models?key=AIzaSyDummySecretValue1234567890",
			secret: "AIzaSyDummySecretValue1234567890",
		},
		{
			name:   "Authorization Bearer header",
			input:  "header Authorization: Bearer my-custom-gateway-secret-token",
			secret: "my-custom-gateway-secret-token",
		},
		{
			name:   "x-api-key header",
			input:  "request x-api-key: custom-secret-api-key-value",
			secret: "custom-secret-api-key-value",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			redacted := RedactSecrets(tc.input)
			if strings.Contains(redacted, tc.secret) {
				t.Fatalf("segredo %q vazou na saída: %q", tc.secret, redacted)
			}
			if !strings.Contains(redacted, "[REDACTED]") {
				t.Fatalf("esperava marcador [REDACTED] em %q", redacted)
			}
		})
	}

	normal := "Resposta normal do Vito sobre agenda às 14h"
	if got := RedactSecrets(normal); got != normal {
		t.Fatalf("texto comum não deveria ser alterado: %q", got)
	}
}
