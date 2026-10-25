package ai

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const (
	testDefaultVoice = "pt-BR-AntonioNeural"
	testMaxText      = 2000
)

// mockSynthesizer implementa TTSSynthesizer injetável para testes.
// Não é um "blind mock": retorna valores fixos e expõe o número de chamadas
// para que o teste possa afirmar se o provedor Edge-TTS foi ou não invocado.
type mockSynthesizer struct {
	calls     int
	lastText  string
	lastVoice string
	audio     []byte
	mime      string
	err       error
}

func (m *mockSynthesizer) Synthesize(text, voice string) ([]byte, string, error) {
	m.calls++
	m.lastText = text
	m.lastVoice = voice
	return m.audio, m.mime, m.err
}

func TestTTSService_Synthesize_CacheHit(t *testing.T) {
	dir := t.TempDir()
	mock := &mockSynthesizer{audio: []byte("fake-audio-bytes"), mime: "audio/mpeg"}
	svc := NewTTSService(mock, dir, testDefaultVoice)

	text := "Olá, mundo"
	voice := testDefaultVoice

	audio1, mime1, err := svc.Synthesize(context.Background(), text, voice)
	if err != nil {
		t.Fatalf("primeira chamada não deveria falhar: %v", err)
	}
	if string(audio1) != "fake-audio-bytes" {
		t.Errorf("esperado áudio fixo, obtido %q", string(audio1))
	}
	if mime1 != "audio/mpeg" {
		t.Errorf("esperado mime audio/mpeg, obtido %q", mime1)
	}
	if mock.calls != 1 {
		t.Errorf("primeira chamada deve invocar o provedor (calls=1), obtido %d", mock.calls)
	}

	// Segunda chamada com mesma voz+texto: deve servir do cache.
	audio2, mime2, err := svc.Synthesize(context.Background(), text, voice)
	if err != nil {
		t.Fatalf("segunda chamada (cache) não deveria falhar: %v", err)
	}
	if string(audio2) != "fake-audio-bytes" {
		t.Errorf("cache deve retornar o mesmo áudio, obtido %q", string(audio2))
	}
	if mime2 != "audio/mpeg" {
		t.Errorf("cache deve retornar o mesmo mime, obtido %q", mime2)
	}
	if mock.calls != 1 {
		t.Errorf("segunda chamada deve usar o cache (calls ainda 1), obtido %d", mock.calls)
	}
}

func TestTTSService_Synthesize_CacheMiss(t *testing.T) {
	dir := t.TempDir()
	mock := &mockSynthesizer{audio: []byte("primeiro-audio"), mime: "audio/mpeg"}
	svc := NewTTSService(mock, dir, testDefaultVoice)

	// Primeira chamada: cache vazio, deve salvar no disco e chamar o provedor.
	audio1, _, err := svc.Synthesize(context.Background(), "texto um", testDefaultVoice)
	if err != nil {
		t.Fatalf("primeira chamada não deveria falhar: %v", err)
	}
	if string(audio1) != "primeiro-audio" {
		t.Errorf("esperado áudio do provedor na cache miss, obtido %q", string(audio1))
	}
	if mock.calls != 1 {
		t.Errorf("cache miss deve chamar o provedor (calls=1), obtido %d", mock.calls)
	}

	// Segunda chamada com mesma entrada: cache, não chama o provedor.
	audio2, _, err := svc.Synthesize(context.Background(), "texto um", testDefaultVoice)
	if err != nil {
		t.Fatalf("segunda chamada (cache) não deveria falhar: %v", err)
	}
	if string(audio2) != "primeiro-audio" {
		t.Errorf("cache deve retornar o mesmo áudio, obtido %q", string(audio2))
	}
	if mock.calls != 1 {
		t.Errorf("cache deve evitar nova chamada ao provedor (calls ainda 1), obtido %d", mock.calls)
	}

	// Verifica que o arquivo de cache foi realmente persistido no disco.
	expectedPath := filepath.Join(dir, svc.cacheKey(testDefaultVoice, "texto um"))
	if _, err := os.Stat(expectedPath); errors.Is(err, fs.ErrNotExist) {
		t.Errorf("esperado arquivo de cache persistido em %s, mas não existe", expectedPath)
	}
}

func TestTTSService_Synthesize_EmptyText(t *testing.T) {
	dir := t.TempDir()
	mock := &mockSynthesizer{audio: []byte("x"), mime: "audio/mpeg"}
	svc := NewTTSService(mock, dir, testDefaultVoice)

	for _, text := range []string{"", "   ", "\t\n"} {
		_, _, err := svc.Synthesize(context.Background(), text, testDefaultVoice)
		if err == nil {
			t.Errorf("texto vazio/espacos (%q) deveria retornar erro", text)
		}
		if mock.calls != 0 {
			t.Errorf("texto vazio não deve chamar o provedor (calls=0), obtido %d", mock.calls)
		}
	}

	// Nenhum arquivo de cache deve ser criado para texto vazio.
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("falha ao listar diretório de cache: %v", err)
	}
	if len(entries) != 0 {
		t.Errorf("texto vazio não deve criar arquivos de cache, encontrado %d", len(entries))
	}
}

func TestTTSService_Synthesize_EdgeTTSFailure(t *testing.T) {
	dir := t.TempDir()
	providerErr := errors.New("edge-tts indisponível")
	mock := &mockSynthesizer{err: providerErr}
	svc := NewTTSService(mock, dir, testDefaultVoice)

	_, _, err := svc.Synthesize(context.Background(), "qualquer texto", testDefaultVoice)
	if err == nil {
		t.Fatalf("esperado erro do provedor Edge-TTS, obteve nil")
	}
	if !errors.Is(err, providerErr) {
		t.Errorf("esperado o erro original do provedor, obtido %v", err)
	}
	if mock.calls != 1 {
		t.Errorf("deve chamar o provedor uma vez mesmo em falha (calls=1), obtido %d", mock.calls)
	}
}

func TestTTSService_CachePath_SHA256(t *testing.T) {
	dir := t.TempDir()
	svc := NewTTSService(&mockSynthesizer{}, dir, testDefaultVoice)

	// Mesmo (voice:text) deve gerar o mesmo caminho de cache.
	key1 := svc.cacheKey("pt-BR-AntonioNeural", "olá mundo")
	key2 := svc.cacheKey("pt-BR-AntonioNeural", "olá mundo")
	if key1 != key2 {
		t.Errorf("mesma combinação deve gerar mesma chave: %q vs %q", key1, key2)
	}

	// Texto diferente gera chave diferente.
	key3 := svc.cacheKey("pt-BR-AntonioNeural", "outro texto")
	if key1 == key3 {
		t.Errorf("texto diferente deve gerar chave diferente")
	}

	// Voz diferente gera chave diferente.
	key4 := svc.cacheKey("pt-BR-FranciscaNeural", "olá mundo")
	if key1 == key4 {
		t.Errorf("voz diferente deve gerar chave diferente")
	}

	// A chave deve ser o SHA-256 hex de "voice:text" com sufixo .mp3.
	sum := sha256.Sum256([]byte("pt-BR-AntonioNeural:olá mundo"))
	expected := hex.EncodeToString(sum[:]) + ".mp3"
	if key1 != expected {
		t.Errorf("chave deve ser SHA-256 de voice:text+'.mp3', esperado %q, obtido %q", expected, key1)
	}

	// O caminho completo deve residir no cacheDir.
	path := svc.cachePath("pt-BR-AntonioNeural", "olá mundo")
	if !strings.HasPrefix(path, dir) {
		t.Errorf("cachePath deve estar dentro de %s, obtido %q", dir, path)
	}
	if filepath.Base(path) != key1 {
		t.Errorf("base do cachePath deve ser a chave, obtido %q", filepath.Base(path))
	}
}

func TestTTSService_DefaultVoice(t *testing.T) {
	dir := t.TempDir()
	mock := &mockSynthesizer{audio: []byte("audio"), mime: "audio/mpeg"}
	svc := NewTTSService(mock, dir, "")

	_, _, err := svc.Synthesize(context.Background(), "texto", "") // voice vazio
	if err != nil {
		t.Fatalf("voice vazio deve usar default, não falhar: %v", err)
	}
	if mock.lastVoice != testDefaultVoice {
		t.Errorf("quando voice='' o serviço deve usar %q como default, obtido %q", testDefaultVoice, mock.lastVoice)
	}
}

func TestTTSService_MaxTextLimit(t *testing.T) {
	dir := t.TempDir()
	mock := &mockSynthesizer{audio: []byte("x"), mime: "audio/mpeg"}
	svc := NewTTSService(mock, dir, testDefaultVoice)

	longText := strings.Repeat("a", testMaxText+1)
	_, _, err := svc.Synthesize(context.Background(), longText, testDefaultVoice)
	if err == nil {
		t.Errorf("texto acima de %d caracteres deveria retornar erro de limite", testMaxText)
	}
	if mock.calls != 0 {
		t.Errorf("texto muito longo não deve chamar o provedor (calls=0), obtido %d", mock.calls)
	}

	// Texto exatamente no limite deve ser aceito.
	exactLimit := strings.Repeat("b", testMaxText)
	mock2 := &mockSynthesizer{audio: []byte("x"), mime: "audio/mpeg"}
	svc2 := NewTTSService(mock2, dir, testDefaultVoice)
	if _, _, err := svc2.Synthesize(context.Background(), exactLimit, testDefaultVoice); err != nil {
		t.Errorf("texto exatamente no limite (%d) não deveria falhar: %v", testMaxText, err)
	}
}

func TestTTSService_CacheDirCreation(t *testing.T) {
	// Diretório que não existe: o serviço deve criá-lo automaticamente na gravação.
	dir := filepath.Join(t.TempDir(), "nao-existe", "tts-cache")
	mock := &mockSynthesizer{audio: []byte("audio"), mime: "audio/mpeg"}
	svc := NewTTSService(mock, dir, testDefaultVoice)

	if _, err := os.Stat(dir); !os.IsNotExist(err) {
		t.Fatalf("o diretório não deveria existir antes da primeira síntese")
	}

	if _, _, err := svc.Synthesize(context.Background(), "texto", testDefaultVoice); err != nil {
		t.Fatalf("síntese não deveria falhar ao criar o diretório de cache: %v", err)
	}

	if _, err := os.Stat(dir); err != nil {
		t.Errorf("o serviço deveria criar o diretório de cache automaticamente: %v", err)
	}
}
