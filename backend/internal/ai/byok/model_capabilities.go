package byok

import "strings"

// ModelCapabilities define os metadados de capacidade de um modelo para roteamento e UI.
type ModelCapabilities struct {
	SupportsTools  bool
	SupportsVision bool
	Reasoning      bool
	QualityTier    int
	MaxContext     int
}

type modelCapabilityRule struct {
	prefix string
	caps   ModelCapabilities
}

// orderedCapabilityRules é avaliada em ordem do prefixo mais específico para o mais genérico.
var orderedCapabilityRules = []modelCapabilityRule{
	// Anthropic Claude
	{prefix: "claude-opus-4", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 200000}},
	{prefix: "claude-sonnet-4", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 200000}},
	{prefix: "claude-haiku-4", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 2, MaxContext: 200000}},
	{prefix: "claude-3-7-sonnet", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 200000}},
	{prefix: "claude-3.7-sonnet", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 200000}},
	{prefix: "claude-3-5-sonnet", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 3, MaxContext: 200000}},
	{prefix: "claude-3.5-sonnet", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 3, MaxContext: 200000}},
	{prefix: "claude-3-opus", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 3, MaxContext: 200000}},
	{prefix: "claude-3-5-haiku", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 200000}},
	{prefix: "claude-3.5-haiku", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 200000}},
	{prefix: "claude-3-haiku", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 200000}},
	{prefix: "claude-", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 3, MaxContext: 200000}},

	// Google Gemini
	{prefix: "gemini-3", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 1048576}},
	{prefix: "gemini-2.5-pro", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 1048576}},
	{prefix: "gemini-2.5-flash-lite", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 1048576}},
	{prefix: "gemini-2.5-flash", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 1048576}},
	{prefix: "gemini-2.0-flash-lite", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 1048576}},
	{prefix: "gemini-2.0-flash", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 3, MaxContext: 1048576}},
	{prefix: "gemini-1.5-pro", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 3, MaxContext: 1048576}},
	{prefix: "gemini-1.5-flash", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 1048576}},
	{prefix: "gemini-", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 1048576}},

	// OpenAI
	{prefix: "gpt-5", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 200000}},
	{prefix: "o4-mini", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 200000}},
	{prefix: "o3", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 200000}},
	{prefix: "o1", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: true, QualityTier: 3, MaxContext: 200000}},
	{prefix: "gpt-4.1-mini", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 128000}},
	{prefix: "gpt-4.1-nano", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 128000}},
	{prefix: "gpt-4.1", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 3, MaxContext: 128000}},
	{prefix: "gpt-4o-mini", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 128000}},
	{prefix: "gpt-4o", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 3, MaxContext: 128000}},
	{prefix: "gpt-4-turbo", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 3, MaxContext: 128000}},
	{prefix: "gpt-3.5", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: false, QualityTier: 1, MaxContext: 16385}},

	// Groq / Open-weights
	{prefix: "deepseek-r1", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: true, QualityTier: 3, MaxContext: 128000}},
	{prefix: "qwq-", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: true, QualityTier: 2, MaxContext: 131072}},
	{prefix: "qwen-qwq", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: true, QualityTier: 2, MaxContext: 131072}},
	{prefix: "qwen3", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: true, QualityTier: 2, MaxContext: 131072}},
	{prefix: "llama-4", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 131072}},
	{prefix: "llama-3.2-90b-vision", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 131072}},
	{prefix: "llama-3.2-11b-vision", caps: ModelCapabilities{SupportsTools: true, SupportsVision: true, Reasoning: false, QualityTier: 2, MaxContext: 131072}},
	{prefix: "llama-3.3-70b", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: false, QualityTier: 3, MaxContext: 131072}},
	{prefix: "llama-3.1-70b", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: false, QualityTier: 3, MaxContext: 131072}},
	{prefix: "llama-3.1-8b", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: false, QualityTier: 1, MaxContext: 32768}},
	{prefix: "llama3-8b", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: false, QualityTier: 1, MaxContext: 32768}},
	{prefix: "mixtral-8x7b", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: false, QualityTier: 1, MaxContext: 32768}},
	{prefix: "gemma2-9b", caps: ModelCapabilities{SupportsTools: true, SupportsVision: false, Reasoning: false, QualityTier: 1, MaxContext: 32768}},
}

// DefaultUnknownCapabilities retorna o fallback seguro de §3 para modelos desconhecidos.
func DefaultUnknownCapabilities() ModelCapabilities {
	return ModelCapabilities{
		SupportsTools:  true,
		SupportsVision: false,
		Reasoning:      false,
		QualityTier:    2,
		MaxContext:     32768,
	}
}

// LookupModelCapabilities resolve as capacidades conhecidas por prefixo de modelID.
func LookupModelCapabilities(providerKey, modelID string) ModelCapabilities {
	norm := strings.ToLower(strings.TrimSpace(modelID))
	norm = strings.TrimPrefix(norm, "models/")
	if idx := strings.LastIndex(norm, "/"); idx >= 0 {
		if matched, ok := matchCapabilityPrefix(norm); ok {
			return matched
		}
		norm = norm[idx+1:]
	}
	if matched, ok := matchCapabilityPrefix(norm); ok {
		return matched
	}
	_ = providerKey
	return DefaultUnknownCapabilities()
}

func matchCapabilityPrefix(normalizedModelID string) (ModelCapabilities, bool) {
	for _, rule := range orderedCapabilityRules {
		if strings.HasPrefix(normalizedModelID, rule.prefix) {
			return rule.caps, true
		}
	}
	return ModelCapabilities{}, false
}
