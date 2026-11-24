package adkengine

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
)

// ADKImageDescriber implementa ai.ImageDescriber sobre model.LLM do Google ADK v2.
type ADKImageDescriber struct {
	llm model.LLM
}

// NewADKImageDescriber cria um descritor de imagens usando qualquer model.LLM ADK v2 (OpenRouter, Gemini, etc.).
func NewADKImageDescriber(llm model.LLM) *ADKImageDescriber {
	return &ADKImageDescriber{llm: llm}
}

// NewOpenRouterADKImageDescriber cria um ai.ImageDescriber via OpenAICompatLLM (OpenRouter).
func NewOpenRouterADKImageDescriber(apiKey, modelID string) ai.ImageDescriber {
	if strings.TrimSpace(apiKey) == "" {
		return nil
	}
	if strings.TrimSpace(modelID) == "" {
		modelID = "google/gemini-2.5-flash"
	}
	llm := NewOpenAICompatLLM(
		"openrouter",
		modelID,
		"https://openrouter.ai/api/v1/chat/completions",
		apiKey,
		WithOpenAISupportsTools(false),
		WithOpenAISupportsReasoning(false),
	)
	return NewADKImageDescriber(llm)
}

func (d *ADKImageDescriber) DescribeImage(ctx context.Context, imageB64, imageMime, prompt string) (string, error) {
	if d == nil || d.llm == nil {
		return "", fmt.Errorf("ADKImageDescriber não configurado")
	}
	raw, err := base64.StdEncoding.DecodeString(strings.TrimSpace(imageB64))
	if err != nil {
		return "", fmt.Errorf("imagem base64 inválida: %w", err)
	}
	if strings.TrimSpace(imageMime) == "" {
		imageMime = "image/jpeg"
	}
	if strings.TrimSpace(prompt) == "" {
		prompt = "Descreva esta imagem em português de forma clara e objetiva."
	}
	req := &model.LLMRequest{
		Model: d.llm.Name(),
		Contents: []*genai.Content{
			{
				Role: genai.RoleUser,
				Parts: []*genai.Part{
					{Text: prompt},
					{InlineData: &genai.Blob{Data: raw, MIMEType: imageMime}},
				},
			},
		},
	}
	var sb strings.Builder
	for resp, genErr := range d.llm.GenerateContent(ctx, req, false) {
		if genErr != nil {
			return "", genErr
		}
		if resp == nil || resp.Content == nil {
			continue
		}
		for _, p := range resp.Content.Parts {
			if p != nil && !p.Thought && p.Text != "" {
				sb.WriteString(p.Text)
			}
		}
	}
	return strings.TrimSpace(sb.String()), nil
}
