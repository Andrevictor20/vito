package byok

import "testing"

func TestVerifyEndpoint(t *testing.T) {
	tests := []struct {
		provider string
		baseURL  string
		want     string
		wantErr  bool
	}{
		{"anthropic", "", "https://api.anthropic.com/v1/models", false},
		{"google", "", "https://generativelanguage.googleapis.com/v1beta/models", false},
		{"openai", "", "https://api.openai.com/v1/models", false},
		{"groq", "", "https://api.groq.com/openai/v1/models", false},
		{"openrouter", "", "https://openrouter.ai/api/v1/models", false},
		{"custom", "http://192.168.0.20:11434/v1/", "http://192.168.0.20:11434/v1/models", false},
		{"custom", "http://192.168.0.20:11434/v1/models", "http://192.168.0.20:11434/v1/models", false},
		{"custom", "", "", true},
		{"unknown", "", "", true},
	}

	for _, tc := range tests {
		got, err := VerifyEndpoint(tc.provider, tc.baseURL)
		if tc.wantErr {
			if err == nil {
				t.Errorf("VerifyEndpoint(%q, %q) esperava erro, obteve %q", tc.provider, tc.baseURL, got)
			}
			continue
		}
		if err != nil {
			t.Errorf("VerifyEndpoint(%q, %q) erro inesperado: %v", tc.provider, tc.baseURL, err)
			continue
		}
		if got != tc.want {
			t.Errorf("VerifyEndpoint(%q, %q) = %q, want %q", tc.provider, tc.baseURL, got, tc.want)
		}
	}
}

func TestParseProviderModels_Anthropic(t *testing.T) {
	body := []byte(`{
		"data": [
			{"id": "claude-sonnet-4-20250514", "display_name": "Claude Sonnet 4", "type": "model"},
			{"id": "claude-3-5-haiku-20241022", "display_name": "Claude 3.5 Haiku", "type": "model"}
		]
	}`)

	models, err := ParseProviderModels("anthropic", body)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if len(models) != 2 {
		t.Fatalf("esperava 2 modelos, obteve %d", len(models))
	}
	if models[0].ID != "claude-sonnet-4-20250514" || models[0].Name != "Claude Sonnet 4" {
		t.Errorf("modelo[0] inesperado: %+v", models[0])
	}
	if !models[0].Reasoning || !models[0].SupportsTools || !models[0].SupportsVision || models[0].MaxContext != 200000 {
		t.Errorf("capacidades inesperadas para Sonnet 4: %+v", models[0])
	}
	if models[1].Reasoning {
		t.Errorf("Haiku 3.5 não deve ter reasoning=true: %+v", models[1])
	}
}

func TestParseProviderModels_Google(t *testing.T) {
	body := []byte(`{
		"models": [
			{
				"name": "models/gemini-2.5-flash",
				"displayName": "Gemini 2.5 Flash",
				"inputTokenLimit": 1048576,
				"supportedGenerationMethods": ["generateContent", "countTokens"]
			},
			{
				"name": "models/text-embedding-004",
				"displayName": "Text Embedding 004",
				"inputTokenLimit": 2048,
				"supportedGenerationMethods": ["embedContent"]
			},
			{
				"name": "models/imagen-3.0-generate-002",
				"displayName": "Imagen 3",
				"supportedGenerationMethods": ["generateContent"]
			}
		]
	}`)

	models, err := ParseProviderModels("google", body)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if len(models) != 1 {
		t.Fatalf("esperava 1 modelo após filtro, obteve %d (%+v)", len(models), models)
	}
	if models[0].ID != "gemini-2.5-flash" || !models[0].Reasoning || models[0].MaxContext != 1048576 {
		t.Errorf("modelo Google inesperado: %+v", models[0])
	}
}

func TestParseProviderModels_OpenAIAndGroqAndCustom(t *testing.T) {
	openAIBody := []byte(`{
		"data": [
			{"id": "gpt-4o"},
			{"id": "o3-mini"},
			{"id": "text-embedding-3-large"},
			{"id": "dall-e-3"},
			{"id": "whisper-1"},
			{"id": "tts-1-hd"},
			{"id": "omni-moderation-latest"},
			{"id": "gpt-4o-realtime-preview"}
		]
	}`)
	oaiModels, err := ParseProviderModels("openai", openAIBody)
	if err != nil {
		t.Fatalf("erro openai: %v", err)
	}
	if len(oaiModels) != 2 {
		t.Fatalf("esperava 2 modelos OpenAI chat, obteve %d (%+v)", len(oaiModels), oaiModels)
	}
	if !oaiModels[1].Reasoning || oaiModels[1].ID != "o3-mini" {
		t.Errorf("esperava o3-mini com reasoning=true: %+v", oaiModels[1])
	}

	groqBody := []byte(`{
		"data": [
			{"id": "llama-3.3-70b-versatile", "context_window": 131072, "active": true},
			{"id": "whisper-large-v3-turbo", "context_window": 448, "active": true},
			{"id": "playai-tts", "context_window": 8192, "active": true},
			{"id": "llama-guard-3-8b", "context_window": 8192, "active": true},
			{"id": "openai/gpt-oss-safeguard-20b", "context_window": 131072, "active": true},
			{"id": "meta-llama/llama-prompt-guard-2-22m", "context_window": 512, "active": true},
			{"id": "meta-llama/llama-prompt-guard-2-86m", "context_window": 512, "active": true},
			{"id": "canopylabs/orpheus-v1-english", "context_window": 4000, "active": true},
			{"id": "canopylabs/orpheus-arabic-saudi", "context_window": 4000, "active": true},
			{"id": "deprecated-model", "context_window": 8192, "active": false}
		]
	}`)
	groqModels, err := ParseProviderModels("groq", groqBody)
	if err != nil {
		t.Fatalf("erro groq: %v", err)
	}
	if len(groqModels) != 1 || groqModels[0].ID != "llama-3.3-70b-versatile" {
		t.Fatalf("modelos Groq inesperados: %+v", groqModels)
	}
	if !IsNonChatModelID("openai/gpt-oss-safeguard-20b") || !IsNonChatModelID("canopylabs/orpheus-v1-english") {
		t.Fatalf("esperava IsNonChatModelID=true para safeguard e orpheus")
	}

	customBody := []byte(`{
		"data": [
			{"id": "qwen2.5-coder:14b"},
			{"id": "nomic-embed-text:latest"}
		]
	}`)
	customModels, err := ParseProviderModels("custom", customBody)
	if err != nil {
		t.Fatalf("erro custom: %v", err)
	}
	if len(customModels) != 1 {
		t.Fatalf("esperava 1 modelo custom, obteve %d", len(customModels))
	}
	m := customModels[0]
	if !m.SupportsTools || m.Reasoning || m.QualityTier != 2 || m.MaxContext != 32768 {
		t.Errorf("padrão de modelo desconhecido §3 incorreto: %+v", m)
	}
}

func TestParseProviderModels_OpenRouter(t *testing.T) {
	body := []byte(`{
		"data": [
			{
				"id": "anthropic/claude-sonnet-4",
				"name": "Anthropic: Claude Sonnet 4",
				"context_length": 200000,
				"architecture": {
					"modality": "text+image->text",
					"input_modalities": ["text", "image"],
					"output_modalities": ["text"]
				},
				"supported_parameters": ["tools", "reasoning", "temperature"]
			},
			{
				"id": "meta-llama/llama-3.1-8b-instruct",
				"name": "Llama 3.1 8B",
				"context_length": 131072,
				"architecture": {
					"modality": "text->text",
					"input_modalities": ["text"],
					"output_modalities": ["text"]
				},
				"supported_parameters": ["temperature"]
			},
			{
				"id": "black-forest-labs/flux-1.1-pro",
				"name": "FLUX 1.1 Pro",
				"architecture": {
					"modality": "text->image",
					"input_modalities": ["text"],
					"output_modalities": ["image"]
				}
			}
		]
	}`)

	models, err := ParseProviderModels("openrouter", body)
	if err != nil {
		t.Fatalf("erro openrouter: %v", err)
	}
	if len(models) != 2 {
		t.Fatalf("esperava 2 modelos OpenRouter, obteve %d (%+v)", len(models), models)
	}
	if !models[0].SupportsTools || !models[0].SupportsVision || !models[0].Reasoning || models[0].MaxContext != 200000 {
		t.Errorf("capacidades OpenRouter[0] incorretas: %+v", models[0])
	}
	if models[1].SupportsTools || models[1].SupportsVision || models[1].Reasoning {
		t.Errorf("capacidades OpenRouter[1] deveriam respeitar supported_parameters/modalities: %+v", models[1])
	}
}
