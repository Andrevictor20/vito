package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"strings"
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

	audioBytes, err := io.ReadAll(audioReader)
	if err != nil {
		return "", fmt.Errorf("falha ao ler bytes do áudio: %w", err)
	}

	if filename == "" {
		filename = "audio.m4a"
	}

	mimeType := "audio/m4a"
	if strings.HasSuffix(filename, ".wav") {
		mimeType = "audio/wav"
	} else if strings.HasSuffix(filename, ".mp3") {
		mimeType = "audio/mpeg"
	} else if strings.HasSuffix(filename, ".ogg") {
		mimeType = "audio/ogg"
	}

	modelsToTry := []string{"whisper-large-v3", "whisper-large-v3-turbo"}
	var lastErr error

	for _, modelName := range modelsToTry {
		body := &bytes.Buffer{}
		writer := multipart.NewWriter(body)

		// Header MIME explícito para o arquivo de áudio
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="file"; filename="%s"`, filename))
		h.Set("Content-Type", mimeType)

		part, err := writer.CreatePart(h)
		if err != nil {
			return "", fmt.Errorf("falha ao criar part multipart: %w", err)
		}
		if _, err := io.Copy(part, bytes.NewReader(audioBytes)); err != nil {
			return "", fmt.Errorf("falha ao copiar bytes do áudio: %w", err)
		}

		if err := writer.WriteField("model", modelName); err != nil {
			return "", fmt.Errorf("falha ao definir model: %w", err)
		}
		if err := writer.WriteField("language", "pt"); err != nil {
			return "", fmt.Errorf("falha ao definir language: %w", err)
		}
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

		req.Header.Set("User-Agent", "vito-assistant/1.0")
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", g.apiKey))
		req.Header.Set("Content-Type", writer.FormDataContentType())

		resp, err := g.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("falha na chamada HTTP ao Whisper (%s): %w", modelName, err)
			continue
		}

		respBytes, err := io.ReadAll(resp.Body)
		_ = resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("falha ao ler resposta do Whisper: %w", err)
			continue
		}

		// Se der sobrecarga ou indisponibilidade, tenta o próximo modelo
		if resp.StatusCode == http.StatusServiceUnavailable || resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusInternalServerError {
			lastErr = fmt.Errorf("groq whisper api retornou status %d: %s", resp.StatusCode, string(respBytes))
			continue
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

	return "", fmt.Errorf("falha em todos os modelos Whisper da Groq: %w", lastErr)
}
