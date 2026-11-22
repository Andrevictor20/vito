package adkengine

import (
	"context"
	"fmt"
	"strings"

	"google.golang.org/adk/v2/model"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// ADKLLMFactory implementa service.LLMFactory instanciando os adaptadores adk/v2/model.LLM por provedor.
type ADKLLMFactory struct{}

// NewADKLLMFactory cria a fábrica de modelos BYOK do ADK.
func NewADKLLMFactory() *ADKLLMFactory {
	return &ADKLLMFactory{}
}

// BuildLLM instancia o model.LLM apropriado para o provedor BYOK especificado.
func (f *ADKLLMFactory) BuildLLM(ctx context.Context, spec service.LLMBuildSpec) (model.LLM, error) {
	switch spec.ProviderKey {
	case domain.ProviderKeyGoogle:
		var opts []GeminiBYOKOption
		if spec.BaseURL != "" {
			opts = append(opts, WithGeminiBaseURL(spec.BaseURL))
		}
		if spec.HTTPClient != nil {
			opts = append(opts, WithGeminiHTTPClient(spec.HTTPClient))
		}
		return NewGeminiBYOKLLM(ctx, spec.ModelID, spec.APIKey, opts...)

	case domain.ProviderKeyAnthropic:
		var opts []AnthropicOption
		if spec.BaseURL != "" {
			opts = append(opts, WithAnthropicBaseURL(spec.BaseURL))
		}
		if spec.HTTPClient != nil {
			opts = append(opts, WithAnthropicHTTPClient(spec.HTTPClient))
		}
		return NewAnthropicLLM(spec.ModelID, spec.APIKey, opts...), nil

	case domain.ProviderKeyOpenAI, domain.ProviderKeyGroq, domain.ProviderKeyOpenRouter, domain.ProviderKeyCustom:
		baseURL := strings.TrimSpace(spec.BaseURL)
		if baseURL == "" {
			baseURL = defaultOpenAICompatBaseURL(spec.ProviderKey)
		}
		opts := []OpenAICompatOption{
			WithOpenAISupportsReasoning(spec.SupportsReasoning),
			WithOpenAISupportsTools(spec.SupportsTools),
		}
		if spec.HTTPClient != nil {
			opts = append(opts, WithOpenAIHTTPClient(spec.HTTPClient))
		}
		return NewOpenAICompatLLM(string(spec.ProviderKey), spec.ModelID, baseURL, spec.APIKey, opts...), nil

	default:
		return nil, fmt.Errorf("provedor %q não suportado pela ADKLLMFactory", spec.ProviderKey)
	}
}

func defaultOpenAICompatBaseURL(key domain.ProviderKey) string {
	switch key {
	case domain.ProviderKeyOpenAI:
		return "https://api.openai.com/v1"
	case domain.ProviderKeyGroq:
		return "https://api.groq.com/openai/v1"
	case domain.ProviderKeyOpenRouter:
		return "https://openrouter.ai/api/v1"
	default:
		return ""
	}
}
