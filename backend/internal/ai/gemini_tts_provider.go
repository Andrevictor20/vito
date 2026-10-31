package ai

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// GeminiTTSProvider sintetiza texto em áudio usando a API oficial do Gemini no Google AI Studio.
type GeminiTTSProvider struct {
	apiKey     string
	model      string
	baseURL    string
	httpClient *http.Client
}

// NewGeminiTTSProvider inicializa o provedor de voz do Gemini.
func NewGeminiTTSProvider(apiKey, model string) *GeminiTTSProvider {
	if model == "" || model == "gemini-2.5-flash" || model == "gemini-2.0-flash" || model == "gemini-1.5-flash" {
		model = "gemini-2.5-flash-preview-tts"
	}
	return &GeminiTTSProvider{
		apiKey:  apiKey,
		model:   model,
		baseURL: "https://generativelanguage.googleapis.com",
		httpClient: &http.Client{
			Timeout: 20 * time.Second,
		},
	}
}

type geminiTTSPart struct {
	Text string `json:"text,omitempty"`
}

type geminiTTSContent struct {
	Parts []geminiTTSPart `json:"parts"`
}

type geminiTTSPrebuiltVoiceConfig struct {
	VoiceName string `json:"voiceName"`
}

type geminiTTSVoiceConfig struct {
	PrebuiltVoiceConfig geminiTTSPrebuiltVoiceConfig `json:"prebuiltVoiceConfig"`
}

type geminiTTSSpeechConfig struct {
	VoiceConfig geminiTTSVoiceConfig `json:"voiceConfig"`
}

type geminiTTSGenConfig struct {
	ResponseModalities []string               `json:"responseModalities"`
	SpeechConfig       *geminiTTSSpeechConfig `json:"speechConfig,omitempty"`
}

type geminiTTSRequest struct {
	Contents         []geminiTTSContent `json:"contents"`
	GenerationConfig geminiTTSGenConfig `json:"generationConfig"`
}

type geminiTTSResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				InlineData *struct {
					MimeType string `json:"mimeType"`
					Data     string `json:"data"` // base64
				} `json:"inlineData,omitempty"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

var (
	markdownSymbolsRegex = regexp.MustCompile(`[*_~` + "`" + `#>\[\]\(\)]+`)
	extraSpacesRegex     = regexp.MustCompile(`\s+`)
	rateRegex            = regexp.MustCompile(`rate=(\d+)`)
)

// cleanTextForSpeech limpa marcações markdown para que a voz soe fluida e humana.
func cleanTextForSpeech(text string) string {
	cleaned := markdownSymbolsRegex.ReplaceAllString(text, " ")
	cleaned = extraSpacesRegex.ReplaceAllString(cleaned, " ")
	return strings.TrimSpace(cleaned)
}

// MapVoiceToGemini mapeia nomes de vozes do Edge-TTS, OpenAI ou genéricas para as vozes nativas do Gemini.
func MapVoiceToGemini(voice string) string {
	v := strings.ToLower(strings.TrimSpace(voice))
	switch v {
	case "kore", "female", "feminino", "francisca", "pt-br-franciscaneural", "shimmer", "fable", "nova", "mulher":
		return "Kore"
	case "aoede":
		return "Aoede"
	case "charon":
		return "Charon"
	case "fenrir":
		return "Fenrir"
	case "puck", "male", "masculino", "antonio", "pt-br-antonioneural", "alloy", "echo", "onyx", "homem":
		return "Puck"
	default:
		if strings.Contains(v, "fem") || strings.Contains(v, "kore") || strings.Contains(v, "mulher") {
			return "Kore"
		}
		return "Puck"
	}
}

// Synthesize executa a chamada ao Gemini com fallback de modelos para sintetizar fala natural.
func (p *GeminiTTSProvider) Synthesize(text string, voice string) ([]byte, string, error) {
	if strings.TrimSpace(p.apiKey) == "" {
		return nil, "", errors.New("gemini api key não configurada para síntese de voz")
	}

	cleanText := cleanTextForSpeech(text)
	if cleanText == "" {
		return nil, "", errors.New("texto para síntese de voz vazio após sanitização")
	}

	geminiVoice := MapVoiceToGemini(voice)

	// Modelos oficiais do Google AI Studio dedicados a síntese de áudio (TTS)
	models := []string{
		"gemini-2.5-flash-preview-tts",
		"gemini-2.5-pro-preview-tts",
	}
	if p.model != "" && p.model != "gemini-2.5-flash-preview-tts" && p.model != "gemini-2.5-flash" && p.model != "gemini-2.0-flash" && p.model != "gemini-1.5-flash" {
		models = append([]string{p.model}, models...)
	}

	var lastErr error
	for _, m := range models {
		m = strings.TrimSpace(m)
		if m == "" {
			continue
		}

		audioBytes, mime, err := p.synthesizeWithModel(cleanText, geminiVoice, m)
		if err == nil && len(audioBytes) > 0 {
			return audioBytes, mime, nil
		}
		lastErr = err
	}

	return nil, "", fmt.Errorf("falha ao sintetizar voz no Gemini: %w", lastErr)
}

func (p *GeminiTTSProvider) synthesizeWithModel(text string, voice string, model string) ([]byte, string, error) {
	reqBody := geminiTTSRequest{
		Contents: []geminiTTSContent{
			{
				Parts: []geminiTTSPart{
					{Text: text},
				},
			},
		},
		GenerationConfig: geminiTTSGenConfig{
			ResponseModalities: []string{"AUDIO"},
			SpeechConfig: &geminiTTSSpeechConfig{
				VoiceConfig: geminiTTSVoiceConfig{
					PrebuiltVoiceConfig: geminiTTSPrebuiltVoiceConfig{
						VoiceName: voice,
					},
				},
			},
		},
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, "", err
	}

	url := fmt.Sprintf("%s/v1beta/models/%s:generateContent?key=%s", p.baseURL, model, p.apiKey)
	httpReq, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, "", err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := p.httpClient.Do(httpReq)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respData, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		return nil, "", fmt.Errorf("gemini tts status %d (%s): %s", resp.StatusCode, model, string(respData))
	}

	var res geminiTTSResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, "", fmt.Errorf("erro ao decodificar resposta json de áudio: %w", err)
	}

	for _, cand := range res.Candidates {
		for _, part := range cand.Content.Parts {
			if part.InlineData != nil && len(part.InlineData.Data) > 0 {
				rawAudio, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
				if err != nil {
					return nil, "", fmt.Errorf("erro ao decodificar base64 de áudio: %w", err)
				}

				mime := strings.ToLower(part.InlineData.MimeType)
				// Se for áudio PCM bruto, encapsula com cabeçalho RIFF WAV 44-byte
				if strings.Contains(mime, "pcm") || (!strings.HasPrefix(string(rawAudio[:min(4, len(rawAudio))]), "RIFF") && !strings.HasPrefix(string(rawAudio[:min(3, len(rawAudio))]), "ID3")) {
					sampleRate := uint32(24000)
					if matches := rateRegex.FindStringSubmatch(mime); len(matches) > 1 {
						if parsed, err := strconv.Atoi(matches[1]); err == nil && parsed > 0 {
							sampleRate = uint32(parsed)
						}
					}
					wav := PCMToWAV(normalizePCMPeak(rawAudio), sampleRate, 1, 16)
					return wav, "audio/wav", nil
				}

				if strings.Contains(mime, "wav") {
					return rawAudio, "audio/wav", nil
				}
				return rawAudio, "audio/mpeg", nil
			}
		}
	}

	return nil, "", errors.New("nenhum dado de áudio inline retornado pelo Gemini")
}

// normalizePCMPeak normaliza o volume de amostras PCM 16-bit little-endian para pico de -1.0 dBFS (~29000).
func normalizePCMPeak(pcm []byte) []byte {
	if len(pcm) < 2 {
		return pcm
	}
	numSamples := len(pcm) / 2
	var maxAbs int16
	for i := 0; i < numSamples; i++ {
		sample := int16(binary.LittleEndian.Uint16(pcm[i*2 : i*2+2]))
		absVal := sample
		if absVal < 0 {
			if absVal == -32768 {
				absVal = 32767
			} else {
				absVal = -absVal
			}
		}
		if absVal > maxAbs {
			maxAbs = absVal
		}
	}

	if maxAbs < 400 || maxAbs >= 28000 {
		return pcm
	}

	gain := float64(29000) / float64(maxAbs)
	if gain > 2.5 {
		gain = 2.5
	}

	normalized := make([]byte, len(pcm))
	for i := 0; i < numSamples; i++ {
		sample := int16(binary.LittleEndian.Uint16(pcm[i*2 : i*2+2]))
		amplified := int(float64(sample) * gain)
		if amplified > 32767 {
			amplified = 32767
		} else if amplified < -32768 {
			amplified = -32768
		}
		binary.LittleEndian.PutUint16(normalized[i*2:i*2+2], uint16(int16(amplified)))
	}
	return normalized
}

// PCMToWAV converte bytes PCM brutos (16-bit LE) em um arquivo WAV padrão com cabeçalho RIFF de 44 bytes.
func PCMToWAV(pcm []byte, sampleRate uint32, channels uint16, bitsPerSample uint16) []byte {
	totalDataLen := uint32(len(pcm))
	totalFileLen := totalDataLen + 36
	byteRate := sampleRate * uint32(channels) * uint32(bitsPerSample) / 8
	blockAlign := channels * bitsPerSample / 8

	buf := make([]byte, 44+len(pcm))
	// RIFF descriptor
	copy(buf[0:4], "RIFF")
	binary.LittleEndian.PutUint32(buf[4:8], totalFileLen)
	copy(buf[8:12], "WAVE")
	// fmt subchunk
	copy(buf[12:16], "fmt ")
	binary.LittleEndian.PutUint32(buf[16:20], 16) // Subchunk1Size para PCM
	binary.LittleEndian.PutUint16(buf[20:22], 1)  // AudioFormat 1 = PCM
	binary.LittleEndian.PutUint16(buf[22:24], channels)
	binary.LittleEndian.PutUint32(buf[24:28], sampleRate)
	binary.LittleEndian.PutUint32(buf[28:32], byteRate)
	binary.LittleEndian.PutUint16(buf[32:34], blockAlign)
	binary.LittleEndian.PutUint16(buf[34:36], bitsPerSample)
	// data subchunk
	copy(buf[36:40], "data")
	binary.LittleEndian.PutUint32(buf[40:44], totalDataLen)
	copy(buf[44:], pcm)
	return buf
}

// CascadeTTSSynthesizer gerencia múltiplos provedores de TTS com fallback em cascata.
type CascadeTTSSynthesizer struct {
	primary  TTSSynthesizer
	fallback TTSSynthesizer
}

// NewCascadeTTSSynthesizer cria um sintetizador com primário (Gemini) e fallback (Edge-TTS / NoOp).
func NewCascadeTTSSynthesizer(primary TTSSynthesizer, fallback TTSSynthesizer) *CascadeTTSSynthesizer {
	return &CascadeTTSSynthesizer{
		primary:  primary,
		fallback: fallback,
	}
}

// Synthesize tenta sintetizar pelo primário e chaveia para o fallback se houver erro.
func (c *CascadeTTSSynthesizer) Synthesize(text string, voice string) ([]byte, string, error) {
	if c.primary != nil {
		audio, mime, err := c.primary.Synthesize(text, voice)
		if err == nil && len(audio) > 0 {
			return audio, mime, nil
		}
	}
	if c.fallback != nil {
		return c.fallback.Synthesize(text, voice)
	}
	return nil, "", errors.New("nenhum sintetizador de voz disponível")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
