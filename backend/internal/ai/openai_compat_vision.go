package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// openAIVisionContent é uma parte do conteúdo multimodal no formato OpenAI.
type openAIVisionContent struct {
	Type     string          `json:"type"`
	Text     string          `json:"text,omitempty"`
	ImageURL *openAIImageURL `json:"image_url,omitempty"`
}

// openAIImageURL carrega a imagem como data URL.
type openAIImageURL struct {
	URL string `json:"url"`
}

// openAIVisionMessage é uma mensagem com conteúdo multimodal.
type openAIVisionMessage struct {
	Role    string                `json:"role"`
	Content []openAIVisionContent `json:"content"`
}

// openAIVisionRequest é o corpo multimodal da API compatível com OpenAI.
type openAIVisionRequest struct {
	Model          string                `json:"model"`
	Messages       []openAIVisionMessage `json:"messages"`
	ResponseFormat *struct {
		Type string `json:"type"`
	} `json:"response_format,omitempty"`
	// MaxTokens é obrigatório para o OpenRouter: sem ele a cobrança é calculada
	// pelo teto do modelo e a API responde HTTP 402 ("requires more credits").
	MaxTokens int `json:"max_tokens,omitempty"`
}

// openAIVisionMaxTokens limita a geração multimodal (resposta + descrição da imagem).
const openAIVisionMaxTokens = 2000

// buildVisionMessages monta as mensagens multimodais (texto + imagem).
func buildVisionMessages(systemPrompt, userText, imageB64, imageMime string) []openAIVisionMessage {
	mime := strings.TrimSpace(imageMime)
	if mime == "" {
		mime = "image/jpeg"
	}
	contents := []openAIVisionContent{}
	if userText != "" {
		contents = append(contents, openAIVisionContent{Type: "text", Text: userText})
	}
	contents = append(contents, openAIVisionContent{
		Type:     "image_url",
		ImageURL: &openAIImageURL{URL: "data:" + mime + ";base64," + imageB64},
	})
	return []openAIVisionMessage{
		{Role: "system", Content: []openAIVisionContent{{Type: "text", Text: systemPrompt}}},
		{Role: "user", Content: contents},
	}
}

// parseVisionIntent executa a chamada multimodal e converte a resposta em intent.
//
// Falha explícita quando o modelo não devolve JSON interpretável — é preferível
// erro honesto a resposta vazia que o app mostraria como "não consegui ler".
func (p *OpenAICompatProvider) parseVisionIntent(ctx context.Context, systemPrompt, userText, imageB64, imageMime string) (*ParsedIntent, error) {
	reqBody := openAIVisionRequest{
		Model:    p.model,
		Messages: buildVisionMessages(systemPrompt, userText, imageB64, imageMime),
		ResponseFormat: &struct {
			Type string `json:"type"`
		}{Type: "json_object"},
		MaxTokens: openAIVisionMaxTokens,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "vito-assistant/1.0")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var chatResp openAIChatResponse
	if err := json.Unmarshal(bodyBytes, &chatResp); err != nil {
		return nil, err
	}
	if chatResp.Error != nil {
		return nil, fmt.Errorf("%s", chatResp.Error.Message)
	}
	if len(chatResp.Choices) == 0 {
		return nil, fmt.Errorf("resposta vazia do provedor de visão %s", p.model)
	}

	var intent ParsedIntent
	if err := UnmarshalIntent(chatResp.Choices[0].Message.Content, &intent); err != nil {
		return nil, fmt.Errorf("falha ao interpretar json do provedor de visão: %w", err)
	}
	return &intent, nil
}
