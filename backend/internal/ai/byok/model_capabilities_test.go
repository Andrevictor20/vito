package byok

import "testing"

func TestModelCapabilities_KnownAndUnknown(t *testing.T) {
	cases := []struct {
		provider string
		modelID  string
		tools    bool
		vision   bool
		reason   bool
		tier     int
		minCtx   int
	}{
		{"anthropic", "claude-sonnet-4-20250514", true, true, true, 3, 200000},
		{"anthropic", "claude-3-5-haiku-latest", true, true, false, 2, 200000},
		{"google", "models/gemini-2.5-flash", true, true, true, 3, 1000000},
		{"google", "gemini-2.0-flash-lite", true, true, false, 2, 1000000},
		{"openai", "gpt-4o", true, true, false, 3, 128000},
		{"openai", "o3-mini", true, true, true, 3, 200000},
		{"groq", "llama-3.1-8b-instant", true, false, false, 1, 32768},
		{"openrouter", "deepseek/deepseek-r1", true, false, true, 3, 128000},
		{"custom", "my-local-qwen-finetune", true, false, false, 2, 32768},
	}

	for _, tc := range cases {
		t.Run(tc.provider+":"+tc.modelID, func(t *testing.T) {
			caps := LookupModelCapabilities(tc.provider, tc.modelID)
			if caps.SupportsTools != tc.tools ||
				caps.SupportsVision != tc.vision ||
				caps.Reasoning != tc.reason ||
				caps.QualityTier != tc.tier ||
				caps.MaxContext < tc.minCtx {
				t.Fatalf("capacidades inesperadas para %s: %+v", tc.modelID, caps)
			}
		})
	}

	unknown := LookupModelCapabilities("custom", "completely-unknown-model-xyz")
	if !unknown.SupportsTools || unknown.Reasoning || unknown.QualityTier != 2 || unknown.MaxContext != 32768 {
		t.Fatalf("fallback de modelo desconhecido fora da especificação §3: %+v", unknown)
	}
}
