package voice

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
)

// TTSService é o contrato de síntese de fala (texto → áudio).
type TTSService interface {
	Synthesize(ctx context.Context, text string, voice string) ([]byte, string, error)
}

// TTSSynthesizer é o provedor injetável de síntese de áudio.
type TTSSynthesizer interface {
	Synthesize(text string, voice string) ([]byte, string, error)
}

// maxTTSChars é o limite de caracteres por requisição de síntese de áudio.
const maxTTSChars = 2000

// edgeTTSService implementa TTSService com cache em disco e limites de segurança.
type edgeTTSService struct {
	synth        TTSSynthesizer
	cacheDir     string
	defaultVoice string
}

// NewTTSService cria um serviço de TTS com o sintetizador, diretório de cache e voz default.
func NewTTSService(synth TTSSynthesizer, cacheDir string, defaultVoice string) *edgeTTSService {
	if defaultVoice == "" {
		defaultVoice = "pt-BR-AntonioNeural"
	}
	return &edgeTTSService{
		synth:        synth,
		cacheDir:     cacheDir,
		defaultVoice: defaultVoice,
	}
}

// Synthesize sintetiza texto em áudio. Usa o cache em disco quando disponível;
// caso contrário chama o sintetizador injetado. Falhas do sintetizador são
// propagadas (fallback silencioso fica a cargo do chamador/Android).
func (s *edgeTTSService) Synthesize(ctx context.Context, text string, voice string) ([]byte, string, error) {
	if strings.TrimSpace(text) == "" {
		return nil, "", errors.New("texto não pode ser vazio")
	}
	if len(text) > maxTTSChars {
		return nil, "", errors.New("texto excede o limite de 2000 caracteres para síntese de áudio")
	}

	if voice == "" {
		voice = s.defaultVoice
	}

	// Tenta ler do cache em disco.
	if cached, ok := s.readCache(voice, text); ok {
		return cached, detectAudioMime(cached), nil
	}

	// Chama o sintetizador injetado.
	audio, mime, err := s.synth.Synthesize(text, voice)
	if err != nil {
		return nil, "", err
	}

	// Grava no cache (falha de gravação não impede a devolução do áudio).
	_ = s.writeCache(voice, text, audio)

	return audio, mime, nil
}

// StripMarkdownForSpeech remove símbolos de formatação markdown para síntese limpa de voz.
func StripMarkdownForSpeech(text string) string {
	return cleanTextForSpeech(text)
}

func detectAudioMime(data []byte) string {
	if len(data) >= 4 && string(data[:4]) == "RIFF" {
		return "audio/wav"
	}
	return "audio/mpeg"
}

// cacheKey gera o nome padrão .mp3 do arquivo de cache a partir do SHA-256 de "(voice:text)".
func (s *edgeTTSService) cacheKey(voice string, text string) string {
	return s.cacheKeyWithExt(voice, text, ".mp3")
}

func (s *edgeTTSService) cacheKeyWithExt(voice string, text string, ext string) string {
	sum := sha256.Sum256([]byte(voice + ":" + text))
	return hex.EncodeToString(sum[:]) + ext
}

func (s *edgeTTSService) cachePath(voice string, text string) string {
	return filepath.Join(s.cacheDir, s.cacheKey(voice, text))
}

func (s *edgeTTSService) readCache(voice string, text string) ([]byte, bool) {
	if s.cacheDir == "" {
		return nil, false
	}
	for _, ext := range []string{".wav", ".mp3"} {
		path := filepath.Join(s.cacheDir, s.cacheKeyWithExt(voice, text, ext))
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		data, readErr := io.ReadAll(f)
		_ = f.Close()
		if readErr == nil {
			return data, true
		}
	}
	return nil, false
}

func (s *edgeTTSService) writeCache(voice string, text string, audio []byte) error {
	if s.cacheDir == "" {
		return nil
	}
	if err := os.MkdirAll(s.cacheDir, 0o755); err != nil {
		return err
	}
	ext := ".mp3"
	if detectAudioMime(audio) == "audio/wav" {
		ext = ".wav"
	}
	path := filepath.Join(s.cacheDir, s.cacheKeyWithExt(voice, text, ext))
	return os.WriteFile(path, audio, 0o644)
}
