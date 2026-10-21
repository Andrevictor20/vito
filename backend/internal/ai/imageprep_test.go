package ai

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"strings"
	"testing"
)

// imagemTestePNG gera um PNG válido com as dimensões pedidas.
func imagemTestePNG(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{R: uint8(x % 256), G: uint8(y % 256), B: uint8((x + y) % 256), A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatalf("falha ao codificar PNG de teste: %v", err)
	}
	return buf.Bytes()
}

// TestPrepareImage_FarejaMimeReal corrige o mime declarado.
//
// O app enviava "image/jpeg" fixo mesmo para PNG/WEBP/HEIC; o backend precisa
// usar o tipo real dos bytes para o provedor não recusar ou desinterpretar a imagem.
func TestPrepareImage_FarejaMimeReal(t *testing.T) {
	raw := imagemTestePNG(t, 8, 8)
	b64 := base64.StdEncoding.EncodeToString(raw)

	out, mime, err := PrepareImage(b64, "image/jpeg")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if mime != "image/png" {
		t.Errorf("mime esperado image/png, obteve %s", mime)
	}
	if out == "" {
		t.Error("esperava payload base64 não vazio")
	}
}

// TestPrepareImage_PreservaImagemPequena mantém o payload original quando a
// imagem já é pequena (nitidez para OCR de screenshots, sem perda de qualidade).
func TestPrepareImage_PreservaImagemPequena(t *testing.T) {
	raw := imagemTestePNG(t, 64, 64)
	b64 := base64.StdEncoding.EncodeToString(raw)

	out, mime, err := PrepareImage(b64, "")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if out != b64 {
		t.Error("imagem pequena deveria ser preservada byte a byte")
	}
	if mime != "image/png" {
		t.Errorf("mime esperado image/png, obteve %s", mime)
	}
}

// TestPrepareImage_RedimensionaImagemGrande garante o teto de pixels.
//
// Fotos de celular chegam com 3-6MB; o Gemini limita o payload inline a 20MB
// (e o base64 estoura esse limite). O redimensionamento corta o custo e a latência.
func TestPrepareImage_RedimensionaImagemGrande(t *testing.T) {
	raw := imagemTestePNG(t, 1600, 1200)
	b64 := base64.StdEncoding.EncodeToString(raw)

	out, mime, err := PrepareImage(b64, "image/jpeg")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if mime != "image/jpeg" {
		t.Errorf("mime esperado image/jpeg após re-codificação, obteve %s", mime)
	}
	decoded, err := base64.StdEncoding.DecodeString(out)
	if err != nil {
		t.Fatalf("payload base64 inválido: %v", err)
	}
	cfg, _, err := image.DecodeConfig(bytes.NewReader(decoded))
	if err != nil {
		t.Fatalf("falha ao decodificar a imagem resultante: %v", err)
	}
	if cfg.Width > 1280 || cfg.Height > 1280 {
		t.Errorf("lado maior deveria ser <= 1280, obteve %dx%d", cfg.Width, cfg.Height)
	}
}

// TestPrepareImage_RemovePrefixoDataURL aceita o formato "data:<mime>;base64,<dados>".
func TestPrepareImage_RemovePrefixoDataURL(t *testing.T) {
	raw := imagemTestePNG(t, 8, 8)
	b64 := base64.StdEncoding.EncodeToString(raw)

	out, mime, err := PrepareImage("data:image/png;base64,"+b64, "")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if mime != "image/png" {
		t.Errorf("mime esperado image/png, obteve %s", mime)
	}
	if out != b64 {
		t.Error("esperava o payload sem o prefixo data URL")
	}
}

// TestPrepareImage_RejeitaPayloadInvalido falha com mensagem clara (sem panic).
func TestPrepareImage_RejeitaPayloadInvalido(t *testing.T) {
	if _, _, err := PrepareImage("não-é-base64-!!!", "image/jpeg"); err == nil {
		t.Error("esperava erro para base64 inválido")
	}
}

// TestPrepareImage_RejeitaConteudoNaoImagem falha quando o payload não é imagem.
func TestPrepareImage_RejeitaConteudoNaoImagem(t *testing.T) {
	naoImagem := base64.StdEncoding.EncodeToString([]byte("isso e um texto, nao uma imagem"))
	_, _, err := PrepareImage(naoImagem, "")
	if err == nil {
		t.Fatal("esperava erro para conteúdo que não é imagem")
	}
	if !strings.Contains(strings.ToLower(err.Error()), "imagem") {
		t.Errorf("mensagem de erro deveria mencionar imagem, obteve: %v", err)
	}
}
