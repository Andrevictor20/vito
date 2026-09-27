package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"
)

type GeminiProvider struct {
	apiKey     string
	model      string
	httpClient *http.Client
}

func NewGeminiProvider(apiKey, model string) *GeminiProvider {
	if model == "" {
		model = "gemini-2.5-flash"
	}
	return &GeminiProvider{
		apiKey: apiKey,
		model:  model,
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

func (p *GeminiProvider) Name() string {
	return "Google AI Studio (" + p.model + ")"
}

type geminiPart struct {
	Text       string            `json:"text,omitempty"`
	InlineData *geminiInlineData `json:"inlineData,omitempty"`
}

type geminiInlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"` // base64
}

type geminiContent struct {
	Role  string       `json:"role"`
	Parts []geminiPart `json:"parts"`
}

type geminiRequest struct {
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
	GenerationConfig  struct {
		ResponseMimeType string `json:"responseMimeType"`
	} `json:"generationConfig"`
}

type geminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	Error *struct {
		Message string `json:"message"`
		Code    int    `json:"code"`
	} `json:"error,omitempty"`
}

func (p *GeminiProvider) ParseIntent(ctx context.Context, input UserInput) (*ParsedIntent, error) {
	if p.apiKey == "" {
		return nil, errors.New("chave de api do gemini não configurada")
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s", p.model, p.apiKey)

	systemPrompt := BuildSystemPrompt(input.Now, input.Timezone, input.ContextMemories...)

	var userParts []geminiPart
	if input.Text != "" {
		userParts = append(userParts, geminiPart{Text: input.Text})
	}
	if input.AudioB64 != "" {
		mime := input.AudioMime
		if mime == "" {
			mime = "audio/mp4"
		}
		userParts = append(userParts, geminiPart{
			InlineData: &geminiInlineData{MimeType: mime, Data: input.AudioB64},
		})
	}
	if input.ImageB64 != "" {
		mime := input.ImageMime
		if mime == "" {
			mime = "image/jpeg"
		}
		userParts = append(userParts, geminiPart{
			InlineData: &geminiInlineData{MimeType: mime, Data: input.ImageB64},
		})
	}

	if len(userParts) == 0 {
		return nil, errors.New("nenhum conteúdo de texto, áudio ou imagem fornecido")
	}

	reqBody := geminiRequest{
		SystemInstruction: &geminiContent{
			Role:  "system",
			Parts: []geminiPart{{Text: systemPrompt}},
		},
		Contents: []geminiContent{
			{Role: "user", Parts: userParts},
		},
	}
	reqBody.GenerationConfig.ResponseMimeType = "application/json"

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

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
		return nil, fmt.Errorf("gemini api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var geminiResp geminiResponse
	if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil {
		return nil, err
	}

	if geminiResp.Error != nil {
		return nil, fmt.Errorf("gemini error: %s", geminiResp.Error.Message)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return nil, errors.New("resposta vazia retornada pelo gemini")
	}

	rawJSON := geminiResp.Candidates[0].Content.Parts[0].Text
	var intent ParsedIntent
	if err := json.Unmarshal([]byte(rawJSON), &intent); err != nil {
		return nil, fmt.Errorf("falha ao interpretar json da ia: %w (raw: %s)", err, rawJSON)
	}

	return &intent, nil
}
