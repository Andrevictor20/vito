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

// describeMaxTokens limita a descrição em texto de uma imagem.
const describeMaxTokens = 800

// DescribeImage devolve a DESCRIÇÃO em texto de uma imagem.
//
// Usado pelo enriquecimento do histórico do WhatsApp: o Vito precisa saber o que
// a foto mostra para "ler" mensagens antigas. É o ramo de texto puro (sem o
// JSON de ação do ParseIntent).
//
// Este provedor é o elo de visão via OpenRouter: a cota do Google AI Studio
// (20 req/dia no free tier) é compartilhada por todos os modelos do Gemini e
// ficaria inviável para o histórico inteiro.
func (p *OpenAICompatProvider) DescribeImage(ctx context.Context, imageB64, imageMime, prompt string) (string, error) {
	if p.apiKey == "" {
		return "", fmt.Errorf("chave de api não configurada para %s", p.providerName)
	}
	if strings.TrimSpace(imageB64) == "" {
		return "", fmt.Errorf("imagem vazia para %s", p.providerName)
	}
	if !p.visionCapable {
		return "", fmt.Errorf("provedor %s não suporta leitura de imagens", p.providerName)
	}

	mime := strings.TrimSpace(imageMime)
	if mime == "" {
		mime = "image/jpeg"
	}
	question := strings.TrimSpace(prompt)
	if question == "" {
		question = "Descreva esta imagem em português, de forma objetiva, em até 3 frases."
	}

	reqBody := openAIVisionRequest{
		Model: p.model,
		Messages: []openAIVisionMessage{
			{Role: "system", Content: []openAIVisionContent{{Type: "text", Text: "Você descreve imagens com precisão e objetividade. Responda apenas com a descrição, em português."}}},
			{Role: "user", Content: []openAIVisionContent{
				{Type: "text", Text: question},
				{Type: "image_url", ImageURL: &openAIImageURL{URL: "data:" + mime + ";base64," + imageB64}},
			}},
		},
		MaxTokens: describeMaxTokens,
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", p.baseURL, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "vito-assistant/1.0")
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+p.apiKey)

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var chatResp openAIChatResponse
	if err := json.Unmarshal(bodyBytes, &chatResp); err != nil {
		return "", err
	}
	if chatResp.Error != nil {
		return "", fmt.Errorf("%s", chatResp.Error.Message)
	}
	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("resposta vazia do provedor de visão %s", p.model)
	}

	description := strings.TrimSpace(chatResp.Choices[0].Message.Content)
	if description == "" {
		return "", fmt.Errorf("descrição vazia do provedor de visão %s", p.model)
	}
	return description, nil
}
