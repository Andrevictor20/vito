package ai

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

// NeuralHTTPTTSSynthesizer provê síntese de fala neural gratuita em pt-BR via HTTP
// como contingência imediata caso a cota do Gemini TTS (429) seja excedida,
// evitando queda para o TextToSpeech robótico nativo do Android.
type NeuralHTTPTTSSynthesizer struct {
	httpClient *http.Client
	baseURL    string
}

// NewNeuralHTTPTTSSynthesizer cria o sintetizador neural HTTP de contingência.
func NewNeuralHTTPTTSSynthesizer() *NeuralHTTPTTSSynthesizer {
	return &NeuralHTTPTTSSynthesizer{
		baseURL: "https://translate.googleapis.com/translate_tts",
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Synthesize divide o texto em blocos de até 190 caracteres e concatena os frames MP3 neurais pt-BR.
func (s *NeuralHTTPTTSSynthesizer) Synthesize(text string, voice string) ([]byte, string, error) {
	clean := StripMarkdownForSpeech(text)
	if clean == "" {
		return nil, "", errors.New("texto vazio para síntese neural de contingência")
	}

	chunks := splitTextIntoSpeechChunks(clean, 185)
	var combined bytes.Buffer

	for _, chunk := range chunks {
		reqURL := fmt.Sprintf("%s?ie=UTF-8&client=tw-ob&tl=pt-BR&q=%s", s.baseURL, url.QueryEscape(chunk))
		req, err := http.NewRequest(http.MethodGet, reqURL, nil)
		if err != nil {
			return nil, "", err
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36")

		resp, err := s.httpClient.Do(req)
		if err != nil {
			return nil, "", err
		}
		data, readErr := io.ReadAll(io.LimitReader(resp.Body, 2*1024*1024))
		resp.Body.Close()
		if readErr != nil {
			return nil, "", readErr
		}
		if resp.StatusCode != http.StatusOK || len(data) == 0 {
			return nil, "", fmt.Errorf("neural fallback tts status %d", resp.StatusCode)
		}
		combined.Write(data)
	}

	if combined.Len() == 0 {
		return nil, "", errors.New("nenhum áudio retornado pelo fallback neural")
	}

	return combined.Bytes(), "audio/mpeg", nil
}

func splitTextIntoSpeechChunks(text string, maxLen int) []string {
	words := strings.Fields(text)
	if len(words) == 0 {
		return nil
	}
	var chunks []string
	var current strings.Builder
	for _, w := range words {
		if current.Len()+len(w)+1 > maxLen && current.Len() > 0 {
			chunks = append(chunks, strings.TrimSpace(current.String()))
			current.Reset()
		}
		if current.Len() > 0 {
			current.WriteByte(' ')
		}
		current.WriteString(w)
	}
	if current.Len() > 0 {
		chunks = append(chunks, strings.TrimSpace(current.String()))
	}
	return chunks
}
