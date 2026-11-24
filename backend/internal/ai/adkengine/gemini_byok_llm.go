package adkengine

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"iter"
	"net/http"
	"strings"

	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/model/gemini"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
)

// ProviderHTTPError representa uma falha HTTP retornada por um provedor externo com corpo redigido.
type ProviderHTTPError struct {
	Provider   string
	StatusCode int
	Body       string
}

func (e *ProviderHTTPError) Error() string {
	return fmt.Sprintf("provedor %s retornou HTTP %d: %s", e.Provider, e.StatusCode, e.Body)
}

func doProviderJSONPost(ctx context.Context, client *http.Client, provider, endpoint string, headers map[string]string, payload any) (io.ReadCloser, error) {
	bodyBytes, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("erro ao serializar requisição %s: %w", provider, err)
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("erro ao criar requisição %s: %w", provider, err)
	}
	httpReq.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		if strings.TrimSpace(k) != "" && v != "" {
			httpReq.Header.Set(k, v)
		}
	}
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("falha de rede %s: %s", provider, ai.RedactSecrets(err.Error()))
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		defer resp.Body.Close()
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 32*1024))
		return nil, &ProviderHTTPError{Provider: provider, StatusCode: resp.StatusCode, Body: ai.RedactSecrets(strings.TrimSpace(string(b)))}
	}
	return resp.Body, nil
}
func emitStreamPartial(_ *TurnExecutionMeta, yield func(*model.LLMResponse, error) bool, isThought bool, text string) bool {
	if text == "" {
		return true
	}
	return yield(&model.LLMResponse{Partial: true, Content: &genai.Content{Role: genai.RoleModel, Parts: []*genai.Part{{Text: text, Thought: isThought}}}}, nil)
}
func updateMetaFromResponse(meta *TurnExecutionMeta, provider, modelName string, resp *model.LLMResponse) {
	if meta == nil || resp == nil {
		return
	}
	meta.Mu.Lock()
	defer meta.Mu.Unlock()
	meta.ProviderUsed, meta.ModelUsed = provider, modelName
	if resp.UsageMetadata != nil {
		meta.TokensIn += int(resp.UsageMetadata.PromptTokenCount)
		meta.TokensOut += int(resp.UsageMetadata.CandidatesTokenCount)
	}
}
func extractSchemaJSON(fd *genai.FunctionDeclaration) json.RawMessage {
	if fd != nil {
		for _, c := range []any{fd.ParametersJsonSchema, fd.Parameters} {
			if b, err := json.Marshal(c); c != nil && err == nil && len(b) > 0 {
				return b
			}
		}
	}
	return json.RawMessage(`{"type":"object"}`)
}
func joinSystemInstruction(c *genai.Content) string {
	if c == nil {
		return ""
	}
	var sys []string
	for _, p := range c.Parts {
		if p != nil && p.Text != "" {
			sys = append(sys, p.Text)
		}
	}
	return strings.Join(sys, "\n\n")
}
func extractToolResultString(resMap map[string]any) (string, bool) {
	for _, key := range []string{"summary_for_llm", "result"} {
		if s, ok := resMap[key].(string); ok && s != "" {
			return s, false
		}
	}
	if errStr, ok := resMap["error"].(string); ok && errStr != "" {
		return "Erro: " + errStr, true
	}
	b, _ := json.Marshal(resMap)
	return string(b), false
}
func normalizeEffort(effort string) string {
	return map[string]string{"none": "none", "0": "none", "off": "none", "low": "low", "med": "medium", "medium": "medium", "high": "high"}[strings.ToLower(strings.TrimSpace(effort))]
}
func effectiveModelName(req *model.LLMRequest, fallback string) string {
	if req != nil && strings.TrimSpace(req.Model) != "" {
		return strings.TrimSpace(req.Model)
	}
	return fallback
}
// GeminiBYOKOption configura opções adicionais para o adaptador GeminiBYOKLLM.
type GeminiBYOKOption func(*genai.ClientConfig)
// WithGeminiHTTPClient injeta um *http.Client customizado no ClientConfig do GenAI.
func WithGeminiHTTPClient(client *http.Client) GeminiBYOKOption {
	return func(cfg *genai.ClientConfig) {
		if client != nil {
			cfg.HTTPClient = client
		}
	}
}
// WithGeminiBaseURL sobrescreve a URL base do SDK GenAI (útil para testes contra httptest.Server).
func WithGeminiBaseURL(baseURL string) GeminiBYOKOption {
	return func(cfg *genai.ClientConfig) {
		if b := strings.TrimRight(strings.TrimSpace(baseURL), "/"); b != "" {
			cfg.HTTPOptions.BaseURL = b
		}
	}
}
// GeminiBYOKLLM encapsula o adaptador oficial google.golang.org/adk/v2/model/gemini.NewModel.
type GeminiBYOKLLM struct {
	modelID string
	inner   model.LLM
}
// NewGeminiBYOKLLM instancia um model.LLM Gemini com a chave de API do usuário.
func NewGeminiBYOKLLM(ctx context.Context, modelID, apiKey string, opts ...GeminiBYOKOption) (*GeminiBYOKLLM, error) {
	cleanModel, cleanKey := strings.TrimSpace(modelID), strings.TrimSpace(apiKey)
	if cleanModel == "" || cleanKey == "" {
		return nil, errors.New("modelID e apiKey são obrigatórios para GeminiBYOKLLM")
	}
	cfg := &genai.ClientConfig{APIKey: cleanKey, Backend: genai.BackendGeminiAPI}
	for _, opt := range opts {
		if opt != nil {
			opt(cfg)
		}
	}
	inner, err := gemini.NewModel(ctx, cleanModel, cfg)
	if err != nil {
		return nil, err
	}
	return &GeminiBYOKLLM{modelID: cleanModel, inner: inner}, nil
}
// Name retorna o identificador do modelo Gemini configurado.
func (g *GeminiBYOKLLM) Name() string { return g.inner.Name() }
// GenerateContent delega ao modelo Gemini oficial do ADK v2 normalizando erros HTTP e telemetria.
func (g *GeminiBYOKLLM) GenerateContent(ctx context.Context, req *model.LLMRequest, stream bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {
		meta := TurnExecutionMetaFromContext(ctx)
		for resp, err := range g.inner.GenerateContent(ctx, req, stream) {
			if err != nil {
				var apiErr genai.APIError
				var apiErrPtr *genai.APIError
				if errors.As(err, &apiErr) && apiErr.Code > 0 {
					yield(nil, &ProviderHTTPError{Provider: "google", StatusCode: apiErr.Code, Body: ai.RedactSecrets(apiErr.Message)})
				} else if errors.As(err, &apiErrPtr) && apiErrPtr != nil && apiErrPtr.Code > 0 {
					yield(nil, &ProviderHTTPError{Provider: "google", StatusCode: apiErrPtr.Code, Body: ai.RedactSecrets(apiErrPtr.Message)})
				} else {
					yield(nil, errors.New(ai.RedactSecrets(err.Error())))
				}
				return
			}
			if resp != nil && !resp.Partial {
				updateMetaFromResponse(meta, "google", g.modelID, resp)
			}
			if !yield(resp, nil) {
				return
			}
		}
	}
}
