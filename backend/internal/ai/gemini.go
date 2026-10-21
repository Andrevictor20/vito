package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
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
			// A janela real é dada pelo contexto da tentativa (attemptTimeoutFor);
			// este teto só evita conexões penduradas. Medido em produção: análise de
			// imagem levou 57s a 62s, contra 2-6s do texto.
			Timeout: 60 * time.Second,
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

type geminiGoogleSearch struct{}

type geminiTool struct {
	GoogleSearch *geminiGoogleSearch `json:"google_search,omitempty"`
}

// geminiThinkingConfig controla o "thinking" do Gemini 2.5.
//
// Por padrão o 2.5 Flash raciocina antes de responder (thinking dinâmico), o que
// multiplica a latência de uma resposta de chat (19s medidos em produção) sem
// ganho para um assistente que deve responder em segundos. No chat o thinking é
// desligado; a avaliação de radares, que roda em background, mantém o padrão.
//
// O parâmetro só é aceito pela família 2.5: enviar para gemini-3.5-flash-lite
// devolve HTTP 400.
type geminiThinkingConfig struct {
	ThinkingBudget int `json:"thinkingBudget"`
}

// thinkingConfigFor devolve a configuração de thinking aceita pelo modelo.
func thinkingConfigFor(model string) *geminiThinkingConfig {
	if strings.Contains(model, "2.5") {
		return &geminiThinkingConfig{ThinkingBudget: 0}
	}
	return nil
}

// geminiModelChain devolve a cadeia de modelos a testar, em ordem de preferência.
//
// Cada modelo tem sua própria cota no Google AI Studio: em 21/10/2026 o
// gemini-2.5-flash respondia HTTP 429 (cota free tier esgotada) enquanto o
// gemini-3.5-flash-lite respondia normalmente. Uma cadeia de UM único modelo
// (o caso do 2.5-flash, que era o padrão) matava a análise de imagem sem
// nenhuma alternativa.
func geminiModelChain(primary string) []string {
	candidates := []string{
		primary,
		"gemini-2.5-flash",
		"gemini-3.5-flash-lite",
		"gemini-flash-latest",
		"gemini-3.8-flash",
	}
	chain := make([]string, 0, len(candidates))
	seen := make(map[string]bool, len(candidates))
	for _, model := range candidates {
		model = strings.TrimSpace(model)
		if model == "" || seen[model] {
			continue
		}
		seen[model] = true
		chain = append(chain, model)
	}
	return chain
}

// isRetryableModelStatus indica erros que valem trocar de modelo.
//
// 429 (cota), 5xx (capacidade) e 404 (modelo indisponível) são transitórios no
// lado do Google: outro modelo do mesmo provedor normalmente responde.
func isRetryableModelStatus(code int) bool {
	switch code {
	case http.StatusTooManyRequests,
		http.StatusNotFound,
		http.StatusInternalServerError,
		http.StatusBadGateway,
		http.StatusServiceUnavailable,
		http.StatusGatewayTimeout:
		return true
	}
	return false
}

type geminiRequest struct {
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
	Tools             []geminiTool    `json:"tools,omitempty"`
	GenerationConfig  struct {
		ResponseMimeType string                `json:"responseMimeType,omitempty"`
		ThinkingConfig   *geminiThinkingConfig `json:"thinkingConfig,omitempty"`
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

	promptText := input.Text
	if promptText == "" {
		if input.AudioB64 != "" {
			promptText = "Ouça atentamente esta mensagem de áudio do usuário e processe a solicitação gerando o JSON estruturado."
		} else if input.ImageB64 != "" {
			promptText = "Analise atentamente esta imagem e processe a solicitação gerando o JSON estruturado."
		}
	}

	var userParts []geminiPart
	if promptText != "" {
		userParts = append(userParts, geminiPart{Text: SanitizeUntrustedInput(promptText)})
	}
	if input.AudioB64 != "" {
		mime := input.AudioMime
		if mime == "" || mime == "audio/m4a" || mime == "audio/x-m4a" {
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

	// Cadeia de modelos: cada um tem cota própria no Google AI Studio.
	modelsToTry := geminiModelChain(p.model)

	var lastErr error
	for _, modelName := range modelsToTry {
		// O `thinkingConfig` só é aceito pela família 2.5 — enviar para os demais
		// devolve HTTP 400 e mataria a tentativa.
		reqBody.GenerationConfig.ThinkingConfig = thinkingConfigFor(modelName)

		jsonBytes, err := json.Marshal(reqBody)
		if err != nil {
			return nil, err
		}

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

		// Erros transitórios (cota, capacidade, modelo fora do ar) → próximo modelo.
		if resp.StatusCode != http.StatusOK && isRetryableModelStatus(resp.StatusCode) {
			lastErr = fmt.Errorf("gemini api error (status %d, modelo %s): %s", resp.StatusCode, modelName, string(bodyBytes))
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

// EvaluateTrigger implementa TriggerEvaluatorProvider para o Gemini.
func (p *GeminiProvider) EvaluateTrigger(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	return p.TestEvaluateTrigger(ctx, t)
}

// GenerateText implementa TextGeneratorProvider para o Gemini.
func (p *GeminiProvider) GenerateText(ctx context.Context, systemPrompt, userPrompt string) (string, error) {
	if p.apiKey == "" {
		return "", errors.New("chave de api do gemini não configurada")
	}

	base := p.baseURL
	if base == "" {
		base = "https://generativelanguage.googleapis.com"
	}

	reqBody := geminiRequest{
		SystemInstruction: &geminiContent{
			Role:  "system",
			Parts: []geminiPart{{Text: systemPrompt}},
		},
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: userPrompt}}},
		},
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	modelsToTry := geminiModelChain(p.model)
	var lastErr error

	for _, m := range modelsToTry {
		url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", base, m, p.apiKey)
		req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
		if err != nil {
			lastErr = err
			continue
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := p.httpClient.Do(req)
		if err != nil {
			lastErr = err
			continue
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode == http.StatusOK {
			var geminiResp geminiResponse
			if err := json.Unmarshal(bodyBytes, &geminiResp); err == nil && len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
				txt := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
				if txt != "" {
					return txt, nil
				}
			}
		} else {
			lastErr = fmt.Errorf("gemini api error (status %d): %s", resp.StatusCode, string(bodyBytes))
		}
	}

	return "", fmt.Errorf("gemini falhou em sintetizar texto: %w", lastErr)
}
