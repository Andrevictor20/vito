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

type geminiGoogleSearch struct{}

type geminiTool struct {
	GoogleSearch *geminiGoogleSearch `json:"google_search,omitempty"`
}

type geminiRequest struct {
	SystemInstruction *geminiContent  `json:"systemInstruction,omitempty"`
	Contents          []geminiContent `json:"contents"`
	Tools             []geminiTool    `json:"tools,omitempty"`
	GenerationConfig  struct {
		ResponseMimeType string `json:"responseMimeType,omitempty"`
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

// EvaluateTriggerWithSearch realiza pesquisa na web via Google Search Grounding e resume a vigília.
func (p *GeminiProvider) EvaluateTriggerWithSearch(ctx context.Context, title, query string) (string, string, error) {
	if p.apiKey == "" {
		return "", "", errors.New("chave de api do gemini não configurada")
	}

	base := p.baseURL
	if base == "" {
		base = "https://generativelanguage.googleapis.com"
	}

	promptText := fmt.Sprintf("Você é o secretário executivo Vito. Realize uma pesquisa atualizada e forneça um relatório conciso, executivo e factual sobre o tema de vigília: '%s' (Consulta solicitada: '%s'). Destaque dados recentes, cotações, notícias ou status relevante. NUNCA use emojis. Mantenha tom executivo e formal.", title, query)

	reqBody := geminiRequest{
		Contents: []geminiContent{
			{Role: "user", Parts: []geminiPart{{Text: promptText}}},
		},
		Tools: []geminiTool{
			{GoogleSearch: &geminiGoogleSearch{}},
		},
	}

	jsonBytes, err := json.Marshal(reqBody)
	if err != nil {
		return "", "", err
	}

	url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", base, p.model, p.apiKey)
	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(jsonBytes))
	if err != nil {
		return "", "", err
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(req)
	if err != nil {
		return "", "", err
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", err
	}

	if resp.StatusCode != http.StatusOK {
		return "", "", fmt.Errorf("gemini api error (status %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var geminiResp geminiResponse
	if err := json.Unmarshal(bodyBytes, &geminiResp); err != nil {
		return "", "", err
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", "", errors.New("resposta vazia retornada na pesquisa do gemini")
	}

	resultText := strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
	payload := fmt.Sprintf(`{"status":"searched","query":"%s","time":"%s"}`, query, time.Now().UTC().Format(time.RFC3339))
	return resultText, payload, nil
}

// TestEvaluateTrigger avalia a condição do disparador consultando fatos atualizados na web via Google Search.
func (p *GeminiProvider) TestEvaluateTrigger(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
	if p.apiKey == "" {
		return nil, errors.New("chave de api do gemini não configurada")
	}

	base := p.baseURL
	if base == "" {
		base = "https://generativelanguage.googleapis.com"
	}

	now := time.Now()
	nowStr := now.Format("02/01/2006 às 15:04")
	currentMonthYear := now.Format("01/2006")

	var realtimeFeed string
	searchQuery := t.Query
	if strings.TrimSpace(searchQuery) == "" {
		searchQuery = t.Title
	}
	if items, err := FetchGoogleNews(ctx, searchQuery, 6, p.httpClient); err == nil && len(items) > 0 {
		realtimeFeed = FormatNewsFeed(items)
	} else if items, err := FetchGoogleNews(ctx, t.Title, 6, p.httpClient); err == nil && len(items) > 0 {
		realtimeFeed = FormatNewsFeed(items)
	}

	realtimeBlock := ""
	if realtimeFeed != "" {
		realtimeBlock = fmt.Sprintf("\nNOTÍCIAS FACTUAIS COLETADAS EM TEMPO REAL NA WEB (GOOGLE NOTÍCIAS):\n%s\n", realtimeFeed)
	}

	promptText := fmt.Sprintf(`Você é o motor de inteligência e vigília proativa do assistente executivo Vito.
Avalie em tempo real este radar de monitoramento consultando dados atualizados da web:
- TÍTULO: %s
- CONSULTA / VIGÍLIA: %s
- CATEGORIA: %s
- DATA/HORA DE REFERÊNCIA: %s (Mês/Ano Atual: %s)
%s
DIRETRIZES DE ATUALIDADE E RIGOR TEMPORAL:
1. ATENÇÃO MÁXIMA AO CALENDÁRIO: Estamos em %s. As notícias DEVEM ser deste mês corrente ou das últimas horas/dias.
2. É TERMINANTEMENTE PROIBIDO trazer notícias de meses passados (como maio, junho, etc.). Se buscar na web, restrinja expressamente as buscas a notícias recentes do mês atual (%s).
3. Se houver notícias coletadas em tempo real fornecidas acima, utilize-as OBRIGATORIAMENTE como a principal fonte factual para o "current_data" e "summary".

Diretrizes de Conteúdo (estilo Google Notícias — o que ACONTECEU de novo, não um panorama):
1. "current_data": Feed de notícias recentes, do mais novo para o mais antigo. Formato OBRIGATÓRIO, 3 a 6 itens, um por linha:
   "— DD/MM · Manchete factual curta: detalhe concreto em 1 frase (placar, número, decisão, nome)."
   * Priorize o que ocorreu nos últimos 7 dias: resultados de jogos com placar e competição, anúncios, mudanças de preço, decisões.
   * Ao final, opcionalmente 1 linha "Próximo: DD/MM HH:MM · evento" com o próximo compromisso relevante (apenas o próximo, nunca a agenda inteira).
   * PROIBIDO: introduções institucionais ("O Clube X, equipe de..."), contexto histórico, tabelas completas, listas de calendário futuro, parágrafos longos. Máximo ~120 palavras.
2. "summary": Manchete da notícia mais importante e recente em 1 frase (ex: "Flamengo vence o Bahia por 2 a 1 e mantém a liderança do Brasileirão").
3. REGRA ANTI-SLOP ESTRITA: NUNCA use metalinguagem de IA (expressamente proibido falar "A condição para o alerta foi atendida", "Identifiquei que", "Conforme monitorado", "A regra foi acionada"). Entregue apenas fatos com data.

Responda ESTRITAMENTE em formato JSON puro (sem marcações markdown extras):
{
  "condition_met": boolean,
  "current_data": string,
  "summary": string,
  "simulated_notification": string
}`, t.Title, t.Query, t.Category, nowStr, currentMonthYear, realtimeBlock, currentMonthYear, currentMonthYear)

	// Modelos prioritários com fallback resiliente para Grounding e geração
	modelsToTry := []string{p.model}
	candidates := []string{"gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-flash-latest"}
	for _, cand := range candidates {
		found := false
		for _, m := range modelsToTry {
			if m == cand {
				found = true
				break
			}
		}
		if !found {
			modelsToTry = append(modelsToTry, cand)
		}
	}

	var rawText string
	var lastErr error

	// 1. Tentar com busca na web (Grounding Google Search)
	for _, m := range modelsToTry {
		reqBody := geminiRequest{
			Contents: []geminiContent{
				{Role: "user", Parts: []geminiPart{{Text: promptText}}},
			},
			Tools: []geminiTool{
				{GoogleSearch: &geminiGoogleSearch{}},
			},
		}

		jsonBytes, err := json.Marshal(reqBody)
		if err != nil {
			lastErr = err
			continue
		}

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
				rawText = strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
				if rawText != "" {
					break
				}
			}
		} else {
			lastErr = fmt.Errorf("gemini search api status %d: %s", resp.StatusCode, string(bodyBytes))
		}
	}

	// 2. Fallback resiliente: se a cota do Google Search estiver esgotada (429) ou indisponível,
	// efetua a síntese inteligente sem a tool de busca para não travar a vigília em fallback estático
	if rawText == "" {
		for _, m := range modelsToTry {
			reqBody := geminiRequest{
				Contents: []geminiContent{
					{Role: "user", Parts: []geminiPart{{Text: promptText}}},
				},
			}

			jsonBytes, err := json.Marshal(reqBody)
			if err != nil {
				lastErr = err
				continue
			}

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
					rawText = strings.TrimSpace(geminiResp.Candidates[0].Content.Parts[0].Text)
					if rawText != "" {
						break
					}
				}
			} else {
				lastErr = fmt.Errorf("gemini fallback api status %d: %s", resp.StatusCode, string(bodyBytes))
			}
		}
	}

	if rawText == "" {
		return nil, fmt.Errorf("falha ao avaliar vigília com gemini: %w", lastErr)
	}

	type testEvalResult struct {
		ConditionMet          bool   `json:"condition_met"`
		CurrentData           string `json:"current_data"`
		Summary               string `json:"summary"`
		SimulatedNotification string `json:"simulated_notification"`
	}

	var eval testEvalResult
	cleanJSON := rawText
	if start := strings.Index(cleanJSON, "{"); start != -1 {
		if end := strings.LastIndex(cleanJSON, "}"); end != -1 && end > start {
			cleanJSON = cleanJSON[start : end+1]
		}
	}

	if err := json.Unmarshal([]byte(cleanJSON), &eval); err != nil {
		return &domain.TriggerTestResult{
			TriggerID:             t.ID,
			Title:                 t.Title,
			Query:                 t.Query,
			ConditionMet:          false,
			CurrentData:           rawText,
			Summary:               "Consulta realizada com sucesso. Condições avaliadas.",
			SimulatedNotification: fmt.Sprintf("Alerta Vito: Vigília de '%s' atualizada.", t.Title),
			TestedAt:              time.Now().UTC(),
		}, nil
	}

	return &domain.TriggerTestResult{
		TriggerID:             t.ID,
		Title:                 t.Title,
		Query:                 t.Query,
		ConditionMet:          eval.ConditionMet,
		CurrentData:           eval.CurrentData,
		Summary:               eval.Summary,
		SimulatedNotification: eval.SimulatedNotification,
		TestedAt:              time.Now().UTC(),
	}, nil
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

	modelsToTry := []string{p.model, "gemini-flash-latest", "gemini-2.5-flash"}
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

