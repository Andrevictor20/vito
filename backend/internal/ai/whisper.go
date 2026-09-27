package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"time"
)

// AudioTranscriber define a interface para transcrição de áudio em texto.
type AudioTranscriber interface {
	Transcribe(ctx context.Context, audioReader io.Reader, filename string) (string, error)
}

// GroqWhisperTranscriber implementa transcrição usando a API Whisper da Groq.
type GroqWhisperTranscriber struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

// NewGroqWhisper instancia o transcritor Whisper apontando para a Groq Cloud.
func NewGroqWhisper(apiKey string) *GroqWhisperTranscriber {
	return NewGroqWhisperWithBaseURL(apiKey, "https://api.groq.com/openai/v1")
}

// NewGroqWhisperWithBaseURL permite injetar baseURL customizada (para testes e proxies).
func NewGroqWhisperWithBaseURL(apiKey, baseURL string) *GroqWhisperTranscriber {
	return &GroqWhisperTranscriber{
		apiKey:  apiKey,
		baseURL: baseURL,
		client: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

type whisperResponse struct {
	Text  string `json:"text"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

// Transcribe envia o arquivo de áudio para a Groq Whisper e retorna o texto transcrito.
func (g *GroqWhisperTranscriber) Transcribe(ctx context.Context, audioReader io.Reader, filename string) (string, error) {
	if g.apiKey == "" {
		return "", fmt.Errorf("groq api key não configurada para transcrição de áudio")
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Campo 'file'
	part, err := writer.CreateFormFile("file", filename)
	if err != nil {
		return "", fmt.Errorf("falha ao criar form file multipart: %w", err)
	}
	if _, err := io.Copy(part, audioReader); err != nil {
		return "", fmt.Errorf("falha ao copiar bytes do áudio: %w", err)
	}

	// Campo 'model'
	if err := writer.WriteField("model", "whisper-large-v3"); err != nil {
		return "", fmt.Errorf("falha ao definir model: %w", err)
	}

	// Campo 'language' (pt para otimizar precisão e latência no português)
	if err := writer.WriteField("language", "pt"); err != nil {
		return "", fmt.Errorf("falha ao definir language: %w", err)
	}

	// Campo 'response_format'
	if err := writer.WriteField("response_format", "json"); err != nil {
		return "", fmt.Errorf("falha ao definir response_format: %w", err)
	}

	if err := writer.Close(); err != nil {
		return "", fmt.Errorf("falha ao fechar multipart writer: %w", err)
	}

	endpoint := fmt.Sprintf("%s/audio/transcriptions", g.baseURL)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, body)
	if err != nil {
		return "", fmt.Errorf("falha ao criar requisição http: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", g.apiKey))
	req.Header.Set("Content-Type", writer.FormDataContentType())

	resp, err := g.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("falha na chamada HTTP ao Whisper: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("falha ao ler resposta do Whisper: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("groq whisper api retornou status %d: %s", resp.StatusCode, string(respBytes))
	}

	var wResp whisperResponse
	if err := json.Unmarshal(respBytes, &wResp); err != nil {
		return "", fmt.Errorf("falha ao decodificar JSON do Whisper: %w", err)
	}

	if wResp.Error != nil && wResp.Error.Message != "" {
		return "", fmt.Errorf("erro da api whisper: %s", wResp.Error.Message)
	}

	return wResp.Text, nil
}
