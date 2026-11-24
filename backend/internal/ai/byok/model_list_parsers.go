package byok

import (
	"encoding/json"
	"fmt"
	"slices"
	"strings"
)

// ParsedModel representa um modelo normalizado retornado pelo endpoint /models de um provedor.
type ParsedModel struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Note           string `json:"note"`
	SupportsTools  bool   `json:"supports_tools"`
	SupportsVision bool   `json:"supports_vision"`
	Reasoning      bool   `json:"reasoning"`
	QualityTier    int    `json:"quality_tier"`
	MaxContext     int    `json:"max_context"`
}

// VerifyEndpoint retorna a URL exata de verificação (sem gasto de tokens) por provedor (§2).
func VerifyEndpoint(providerKey, baseURL string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(providerKey)) {
	case "anthropic":
		return "https://api.anthropic.com/v1/models", nil
	case "google":
		return "https://generativelanguage.googleapis.com/v1beta/models", nil
	case "openai":
		return "https://api.openai.com/v1/models", nil
	case "groq":
		return "https://api.groq.com/openai/v1/models", nil
	case "openrouter":
		return "https://openrouter.ai/api/v1/models", nil
	case "custom":
		trimmed := strings.TrimRight(strings.TrimSpace(baseURL), "/")
		if trimmed == "" {
			return "", fmt.Errorf("base_url é obrigatório para provedor custom")
		}
		if strings.HasSuffix(strings.ToLower(trimmed), "/models") {
			return trimmed, nil
		}
		return trimmed + "/models", nil
	default:
		return "", fmt.Errorf("provedor %q não suportado", providerKey)
	}
}

// ParseProviderModels interpreta o JSON de /models do provedor especificado, filtrando modelos não-chat.
func ParseProviderModels(providerKey string, body []byte) ([]ParsedModel, error) {
	switch strings.ToLower(strings.TrimSpace(providerKey)) {
	case "anthropic":
		return parseAnthropicModels(body)
	case "google":
		return parseGoogleModels(body)
	case "openrouter":
		return parseOpenRouterModels(body)
	case "openai", "groq", "custom":
		return parseOpenAICompatModels(strings.ToLower(strings.TrimSpace(providerKey)), body)
	default:
		return nil, fmt.Errorf("provedor %q não suportado para parsing de modelos", providerKey)
	}
}

func parseAnthropicModels(body []byte) ([]ParsedModel, error) {
	var payload struct {
		Data []struct {
			ID          string `json:"id"`
			DisplayName string `json:"display_name"`
			Type        string `json:"type"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("erro ao decodificar modelos Anthropic: %w", err)
	}

	out := make([]ParsedModel, 0, len(payload.Data))
	for _, item := range payload.Data {
		id := strings.TrimSpace(item.ID)
		if id == "" || isNonChatModelID(id) {
			continue
		}
		caps := inferParsedModelCapabilities("anthropic", id)
		if strings.TrimSpace(item.DisplayName) != "" {
			caps.Name = strings.TrimSpace(item.DisplayName)
		}
		out = append(out, caps)
	}
	return out, nil
}

func parseGoogleModels(body []byte) ([]ParsedModel, error) {
	var payload struct {
		Models []struct {
			Name                       string   `json:"name"`
			DisplayName                string   `json:"displayName"`
			Description                string   `json:"description"`
			InputTokenLimit            int      `json:"inputTokenLimit"`
			SupportedGenerationMethods []string `json:"supportedGenerationMethods"`
		} `json:"models"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("erro ao decodificar modelos Google: %w", err)
	}

	out := make([]ParsedModel, 0, len(payload.Models))
	for _, item := range payload.Models {
		if len(item.SupportedGenerationMethods) > 0 && !slices.Contains(item.SupportedGenerationMethods, "generateContent") {
			continue
		}
		id := strings.TrimPrefix(strings.TrimSpace(item.Name), "models/")
		if id == "" || isNonChatModelID(id) {
			continue
		}
		caps := inferParsedModelCapabilities("google", id)
		if strings.TrimSpace(item.DisplayName) != "" {
			caps.Name = strings.TrimSpace(item.DisplayName)
		}
		if item.InputTokenLimit > 0 {
			caps.MaxContext = item.InputTokenLimit
		}
		out = append(out, caps)
	}
	return out, nil
}

func parseOpenAICompatModels(providerKey string, body []byte) ([]ParsedModel, error) {
	var payload struct {
		Data []struct {
			ID            string `json:"id"`
			Name          string `json:"name"`
			ContextWindow int    `json:"context_window"`
			ContextLength int    `json:"context_length"`
			MaxModelLen   int    `json:"max_model_len"`
			Active        *bool  `json:"active"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("erro ao decodificar modelos %s: %w", providerKey, err)
	}

	out := make([]ParsedModel, 0, len(payload.Data))
	for _, item := range payload.Data {
		if item.Active != nil && !*item.Active {
			continue
		}
		id := strings.TrimSpace(item.ID)
		if id == "" || isNonChatModelID(id) {
			continue
		}
		caps := inferParsedModelCapabilities(providerKey, id)
		if strings.TrimSpace(item.Name) != "" {
			caps.Name = strings.TrimSpace(item.Name)
		}
		if ctxLen := firstPositive(item.ContextWindow, item.ContextLength, item.MaxModelLen); ctxLen > 0 {
			caps.MaxContext = ctxLen
		}
		out = append(out, caps)
	}
	return out, nil
}

func parseOpenRouterModels(body []byte) ([]ParsedModel, error) {
	var payload struct {
		Data []struct {
			ID            string `json:"id"`
			Name          string `json:"name"`
			ContextLength int    `json:"context_length"`
			Architecture  struct {
				Modality         string   `json:"modality"`
				InputModalities  []string `json:"input_modalities"`
				OutputModalities []string `json:"output_modalities"`
			} `json:"architecture"`
			SupportedParameters []string `json:"supported_parameters"`
		} `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("erro ao decodificar modelos OpenRouter: %w", err)
	}

	out := make([]ParsedModel, 0, len(payload.Data))
	for _, item := range payload.Data {
		id := strings.TrimSpace(item.ID)
		if id == "" || isNonChatModelID(id) {
			continue
		}
		if len(item.Architecture.OutputModalities) > 0 && !slices.Contains(item.Architecture.OutputModalities, "text") {
			continue
		}

		caps := inferParsedModelCapabilities("openrouter", id)
		if strings.TrimSpace(item.Name) != "" {
			caps.Name = strings.TrimSpace(item.Name)
		}
		if item.ContextLength > 0 {
			caps.MaxContext = item.ContextLength
		}
		if len(item.SupportedParameters) > 0 {
			caps.SupportsTools = slices.Contains(item.SupportedParameters, "tools")
			caps.Reasoning = slices.Contains(item.SupportedParameters, "reasoning") ||
				slices.Contains(item.SupportedParameters, "include_reasoning")
		}
		if len(item.Architecture.InputModalities) > 0 {
			caps.SupportsVision = slices.Contains(item.Architecture.InputModalities, "image")
		} else if strings.Contains(strings.ToLower(item.Architecture.Modality), "image") {
			caps.SupportsVision = true
		}
		out = append(out, caps)
	}
	return out, nil
}

func isNonChatModelID(modelID string) bool {
	lower := strings.ToLower(strings.TrimSpace(modelID))
	if lower == "" {
		return true
	}
	blockedSubstrings := []string{
		"embedding", "embed-", "-embed", "text-embedding",
		"whisper", "distil-whisper", "transcribe",
		"tts", "-audio", "audio-", "realtime", "speech",
		"dall-e", "imagen", "sora", "veo-", "flux", "stable-diffusion", "sdxl",
		"moderation", "llama-guard", "shieldgemma", "aqa",
		"babbage-002", "davinci-002",
	}
	for _, sub := range blockedSubstrings {
		if strings.Contains(lower, sub) {
			return true
		}
	}
	return false
}

func inferParsedModelCapabilities(providerKey, modelID string) ParsedModel {
	caps := LookupModelCapabilities(providerKey, modelID)
	lower := strings.ToLower(modelID)
	m := ParsedModel{
		ID:             modelID,
		Name:           modelID,
		SupportsTools:  caps.SupportsTools,
		SupportsVision: caps.SupportsVision,
		Reasoning:      caps.Reasoning,
		QualityTier:    caps.QualityTier,
		MaxContext:     caps.MaxContext,
	}
	switch providerKey {
	case "anthropic":
		if strings.Contains(lower, "haiku") {
			m.Note = "Rápido e econômico"
		} else if strings.Contains(lower, "opus") {
			m.Note = "Máxima capacidade"
		} else {
			m.Note = "Equilibrado para tarefas e código"
		}
	case "google":
		if strings.Contains(lower, "lite") {
			m.Note = "Ultra rápido"
		} else if strings.Contains(lower, "pro") {
			m.Note = "Raciocínio avançado"
		} else {
			m.Note = "Rápido e multimodal"
		}
	case "openai":
		if strings.Contains(lower, "mini") || strings.Contains(lower, "nano") {
			m.Note = "Compacto e econômico"
		} else if m.Reasoning {
			m.Note = "Raciocínio profundo"
		} else {
			m.Note = "Uso geral"
		}
	case "groq":
		m.Note = "Inferência ultrarrápida"
	}
	return m
}

func firstPositive(vals ...int) int {
	for _, v := range vals {
		if v > 0 {
			return v
		}
	}
	return 0
}
