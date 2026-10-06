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
	baseURL    string
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
			Timeout: 45 * time.Second,
		},
	}
}

func (p *GeminiProvider) Name() string {
	return "Google AI Studio (" + p.model + ")"
}

func (p *GeminiProvider) SupportsVision() bool {
	return true
}

func (p *GeminiProvider) SupportsAudio() bool {
	return true
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

	base := p.baseURL
	if base == "" {
		base = "https://generativelanguage.googleapis.com"
	}

	systemPrompt := BuildSystemPromptFromInput(input)

	var userParts []geminiPart
	if input.Text != "" {
		userParts = append(userParts, geminiPart{Text: SanitizeUntrustedInput(input.Text)})
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

	// Lista de modelos a testar: modelo atual + fallback seguro gemini-2.5-flash
	modelsToTry := []string{p.model}
	if p.model != "gemini-2.5-flash" {
		modelsToTry = append(modelsToTry, "gemini-2.5-flash")
	}

	var lastErr error
	for _, modelName := range modelsToTry {
		url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", base, modelName, p.apiKey)

		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := p.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		// Se o modelo responder 503 (sobrecarga) ou 404 (descontinuado) e houver próximo, tenta o próximo
		if (resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode == http.StatusNotFound) && len(modelsToTry) > 1 {
			lastErr = fmt.Errorf("gemini api error (status %d): %s", resp.StatusCode, string(bodyBytes))
			continue
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

		// Extrai a parte que contém JSON, prevendo parts de raciocínio/pensamento
		var rawJSON string
		for _, part := range geminiResp.Candidates[0].Content.Parts {
			txt := part.Text
			if len(txt) > 0 && (bytes.Contains([]byte(txt), []byte("{")) || bytes.Contains([]byte(txt), []byte("```"))) {
				rawJSON = txt
				break
			}
		}
		if rawJSON == "" && len(geminiResp.Candidates[0].Content.Parts) > 0 {
			rawJSON = geminiResp.Candidates[0].Content.Parts[0].Text
		}

		var intent ParsedIntent
		if err := UnmarshalIntent(rawJSON, &intent); err != nil {
			return nil, fmt.Errorf("falha ao interpretar json do gemini: %w", err)
		}

		return &intent, nil
	}

	return nil, fmt.Errorf("falha em todas as tentativas do gemini: %w", lastErr)
}
