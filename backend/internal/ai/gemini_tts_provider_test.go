package ai

import (
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMapVoiceToGemini(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{"pt-BR-AntonioNeural", "Puck"},
		{"antonio", "Puck"},
		{"masculino", "Puck"},
		{"homem", "Puck"},
		{"pt-BR-FranciscaNeural", "Kore"},
		{"francisca", "Kore"},
		{"feminino", "Kore"},
		{"mulher", "Kore"},
		{"alloy", "Puck"},
		{"nova", "Kore"},
		{"kore", "Kore"},
		{"aoede", "Aoede"},
		{"fenrir", "Fenrir"},
		{"charon", "Charon"},
		{"", "Puck"},
		{"unknown-voice", "Puck"},
	}

	for _, c := range cases {
		got := MapVoiceToGemini(c.input)
		if got != c.expected {
			t.Errorf("MapVoiceToGemini(%q) = %q; want %q", c.input, got, c.expected)
		}
	}
}

func TestPCMToWAV(t *testing.T) {
	// 4 bytes of dummy PCM (2 samples of 16-bit mono)
	pcm := []byte{0x00, 0x01, 0x02, 0x03}
	wav := PCMToWAV(pcm, 24000, 1, 16)

	if len(wav) != 44+len(pcm) {
		t.Fatalf("WAV len = %d; want %d", len(wav), 44+len(pcm))
	}

	if string(wav[0:4]) != "RIFF" {
		t.Errorf("Header RIFF mismatch: %s", string(wav[0:4]))
	}
	if string(wav[8:12]) != "WAVE" {
		t.Errorf("Header WAVE mismatch: %s", string(wav[8:12]))
	}
	if string(wav[12:16]) != "fmt " {
		t.Errorf("Header fmt mismatch: %s", string(wav[12:16]))
	}

	sampleRate := binary.LittleEndian.Uint32(wav[24:28])
	if sampleRate != 24000 {
		t.Errorf("Sample rate = %d; want 24000", sampleRate)
	}

	audioFormat := binary.LittleEndian.Uint16(wav[20:22])
	if audioFormat != 1 {
		t.Errorf("AudioFormat = %d; want 1 (PCM)", audioFormat)
	}

	channels := binary.LittleEndian.Uint16(wav[22:24])
	if channels != 1 {
		t.Errorf("Channels = %d; want 1 (Mono)", channels)
	}

	dataSize := binary.LittleEndian.Uint32(wav[40:44])
	if dataSize != uint32(len(pcm)) {
		t.Errorf("Data size = %d; want %d", dataSize, len(pcm))
	}
}

func TestGeminiTTSProvider_Synthesize_Success(t *testing.T) {
	// Simula resposta de áudio PCM da API do Gemini
	dummyPCM := []byte{0x10, 0x20, 0x30, 0x40}
	encodedPCM := base64.StdEncoding.EncodeToString(dummyPCM)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("Método inesperado: %s", r.Method)
		}
		if r.URL.Query().Get("key") != "test-api-key" {
			t.Errorf("Chave de API ausente ou incorreta")
		}

		resp := geminiTTSResponse{}
		resp.Candidates = make([]struct {
			Content struct {
				Parts []struct {
					InlineData *struct {
						MimeType string `json:"mimeType"`
						Data     string `json:"data"`
					} `json:"inlineData,omitempty"`
				} `json:"parts"`
			} `json:"content"`
		}, 1)
		resp.Candidates[0].Content.Parts = make([]struct {
			InlineData *struct {
				MimeType string `json:"mimeType"`
				Data     string `json:"data"`
			} `json:"inlineData,omitempty"`
		}, 1)
		resp.Candidates[0].Content.Parts[0].InlineData = &struct {
			MimeType string `json:"mimeType"`
			Data     string `json:"data"`
		}{
			MimeType: "audio/pcm;rate=24000",
			Data:     encodedPCM,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	provider := NewGeminiTTSProvider("test-api-key", "gemini-2.5-flash")
	provider.baseURL = server.URL
	provider.httpClient = server.Client()

	audio, mime, err := provider.Synthesize("Olá, tudo bem com você?", "pt-BR-AntonioNeural")
	if err != nil {
		t.Fatalf("Synthesize falhou: %v", err)
	}

	if mime != "audio/wav" {
		t.Errorf("Mime = %q; want audio/wav", mime)
	}
	if len(audio) != 44+len(dummyPCM) {
		t.Errorf("Tamanho do áudio = %d; want %d", len(audio), 44+len(dummyPCM))
	}
	if string(audio[0:4]) != "RIFF" {
		t.Errorf("Áudio não possui cabeçalho RIFF WAV")
	}
}

func TestGeminiTTSProvider_Synthesize_ModelFallback(t *testing.T) {
	attempt := 0
	dummyPCM := []byte{0x01, 0x02}
	encodedPCM := base64.StdEncoding.EncodeToString(dummyPCM)

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		attempt++
		if attempt == 1 {
			// Primeiro modelo dá 429 Too Many Requests
			w.WriteHeader(http.StatusTooManyRequests)
			_, _ = w.Write([]byte(`{"error": "rate limit exceeded"}`))
			return
		}

		// Segundo modelo responde 200 OK
		resp := geminiTTSResponse{}
		resp.Candidates = make([]struct {
			Content struct {
				Parts []struct {
					InlineData *struct {
						MimeType string `json:"mimeType"`
						Data     string `json:"data"`
					} `json:"inlineData,omitempty"`
				} `json:"parts"`
			} `json:"content"`
		}, 1)
		resp.Candidates[0].Content.Parts = make([]struct {
			InlineData *struct {
				MimeType string `json:"mimeType"`
				Data     string `json:"data"`
			} `json:"inlineData,omitempty"`
		}, 1)
		resp.Candidates[0].Content.Parts[0].InlineData = &struct {
			MimeType string `json:"mimeType"`
			Data     string `json:"data"`
		}{
			MimeType: "audio/wav",
			Data:     encodedPCM,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	provider := NewGeminiTTSProvider("test-api-key", "primary-failing-model")
	provider.baseURL = server.URL
	provider.httpClient = server.Client()

	audio, mime, err := provider.Synthesize("Teste de fallback de modelo", "Puck")
	if err != nil {
		t.Fatalf("Esperava sucesso no fallback, mas falhou: %v", err)
	}

	if mime != "audio/wav" {
		t.Errorf("Mime = %q; want audio/wav", mime)
	}
	if len(audio) == 0 {
		t.Errorf("Áudio retornado vazio")
	}
	if attempt < 2 {
		t.Errorf("Esperava pelo menos 2 tentativas, obteve %d", attempt)
	}
}

func TestGeminiTTSProvider_Synthesize_MissingKey(t *testing.T) {
	provider := NewGeminiTTSProvider("", "gemini-2.5-flash")
	_, _, err := provider.Synthesize("Texto teste", "Puck")
	if err == nil {
		t.Fatal("Esperava erro por chave vazia, obteve nil")
	}
}

type geminiMockSynthesizer struct {
	shouldFail bool
	audio      []byte
	mime       string
}

func (m *geminiMockSynthesizer) Synthesize(text string, voice string) ([]byte, string, error) {
	if m.shouldFail {
		return nil, "", errors.New("falha induzida no mock")
	}
	return m.audio, m.mime, nil
}

func TestCascadeTTSSynthesizer(t *testing.T) {
	primary := &geminiMockSynthesizer{shouldFail: false, audio: []byte("gemini-audio"), mime: "audio/wav"}
	fallback := &geminiMockSynthesizer{shouldFail: false, audio: []byte("fallback-audio"), mime: "audio/mpeg"}

	cascade := NewCascadeTTSSynthesizer(primary, fallback)

	// Caso 1: primário funciona
	audio, mime, err := cascade.Synthesize("texto", "Puck")
	if err != nil {
		t.Fatalf("Erro inesperado: %v", err)
	}
	if string(audio) != "gemini-audio" || mime != "audio/wav" {
		t.Errorf("Primário não foi utilizado")
	}

	// Caso 2: primário falha, fallback assume
	primary.shouldFail = true
	audio, mime, err = cascade.Synthesize("texto", "Puck")
	if err != nil {
		t.Fatalf("Erro no fallback: %v", err)
	}
	if string(audio) != "fallback-audio" || mime != "audio/mpeg" {
		t.Errorf("Fallback não foi utilizado")
	}

	// Caso 3: ambos falham
	fallback.shouldFail = true
	_, _, err = cascade.Synthesize("texto", "Puck")
	if err == nil {
		t.Fatal("Esperava erro quando ambos falham")
	}
}

func TestNeuralHTTPTTSSynthesizer_Synthesize(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("tl") != "pt-BR" {
			t.Errorf("esperava tl=pt-BR, obteve %q", r.URL.Query().Get("tl"))
		}
		w.Header().Set("Content-Type", "audio/mpeg")
		_, _ = w.Write([]byte("ID3-neural-mp3-frame"))
	}))
	defer server.Close()

	synth := NewNeuralHTTPTTSSynthesizer()
	synth.baseURL = server.URL
	synth.httpClient = server.Client()

	audio, mime, err := synth.Synthesize("**Olá!** Sua reunião foi marcada para as 15h.", "Puck")
	if err != nil {
		t.Fatalf("NeuralHTTPTTSSynthesizer falhou: %v", err)
	}
	if mime != "audio/mpeg" {
		t.Errorf("esperava mime audio/mpeg, obteve %q", mime)
	}
	if len(audio) == 0 {
		t.Errorf("esperava bytes de áudio não vazios")
	}
}
