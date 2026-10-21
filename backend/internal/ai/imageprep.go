package ai

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/color"
	_ "image/gif" // registra o decodificador GIF
	"image/jpeg"
	_ "image/png" // registra o decodificador PNG
	"net/http"
	"strings"
)

const (
	// imageMaxDimension é o lado maior máximo da imagem enviada à IA.
	// Fotos de celular têm 4000px+ e pesam MB; 1280px basta para ler texto e
	// reconhecer objetos, e derruba o custo/latência da análise.
	imageMaxDimension = 1280
	// imageKeepBytes é o limite abaixo do qual a imagem é preservada como está
	// (nitidez para OCR de screenshots, sem re-codificação).
	imageKeepBytes = 1 << 20 // 1MB
	// imageMaxBytes é o teto do payload — acima disso o provedor recusa.
	imageMaxBytes = 6 << 20 // 6MB
	// imageJPEGQuality é a qualidade da re-codificação.
	imageJPEGQuality = 88
)

// PrepareImage normaliza uma imagem para envio à IA.
//
// Três problemas resolvidos aqui:
//  1. O app e o WhatsApp declaravam mime fixo ("image/jpeg") mesmo para PNG,
//     WEBP ou HEIC — o tipo real é deduzido dos bytes.
//  2. Fotos de celular (3-6MB) viravam base64 de 8MB e estouravam o limite de
//     payload do provedor: a imagem é redimensionada quando passa de 1MB.
//  3. O consumo de cota por análise cai junto com o tamanho do payload.
//
// Devolve o base64 pronto e o mime correto.
func PrepareImage(b64, declaredMime string) (string, string, error) {
	raw := strings.TrimSpace(b64)
	if raw == "" {
		return "", "", errors.New("imagem vazia")
	}
	// Aceita o formato "data:<mime>;base64,<dados>".
	if idx := strings.Index(raw, ";base64,"); idx >= 0 {
		raw = raw[idx+len(";base64,"):]
	}
	if strings.HasPrefix(raw, "data:") {
		raw = strings.TrimSpace(strings.TrimPrefix(raw, "data:"))
		if idx := strings.Index(raw, ","); idx >= 0 {
			raw = raw[idx+1:]
		}
	}

	data, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		return "", "", fmt.Errorf("imagem em base64 inválido: %w", err)
	}
	if len(data) == 0 {
		return "", "", errors.New("imagem vazia")
	}
	if len(data) > imageMaxBytes {
		return "", "", fmt.Errorf("imagem muito grande (%d bytes): o limite é %d bytes", len(data), imageMaxBytes)
	}

	mime := detectImageMime(data, declaredMime)
	if mime == "" {
		return "", "", errors.New("o conteúdo enviado não é uma imagem")
	}

	// Imagem pequena: preserva como está (nitidez para OCR).
	if len(data) <= imageKeepBytes && !exceedsMaxDimension(data) {
		return base64.StdEncoding.EncodeToString(data), mime, nil
	}

	// Imagem grande: redimensiona e re-codifica em JPEG.
	src, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		// Formato não decodificável (WEBP/HEIC): repassa o original com o mime
		// detectado — o Gemini aceita esses formatos nativamente.
		return base64.StdEncoding.EncodeToString(data), mime, nil
	}

	resized := resizeImage(src, imageMaxDimension)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, resized, &jpeg.Options{Quality: imageJPEGQuality}); err != nil {
		return "", "", fmt.Errorf("falha ao re-codificar a imagem: %w", err)
	}
	if buf.Len() > imageMaxBytes {
		return "", "", fmt.Errorf("imagem processada ainda excede o limite (%d bytes)", buf.Len())
	}
	return base64.StdEncoding.EncodeToString(buf.Bytes()), "image/jpeg", nil
}

// detectImageMime deduz o tipo real da imagem pelos bytes, com fallback no
// mime declarado (útil para HEIC/HEIF, que não têm assinatura padrão).
//
// Devolve string vazia quando o conteúdo não é imagem e nenhum mime de imagem
// foi declarado — nesse caso o chamador deve recusar o payload.
func detectImageMime(data []byte, declaredMime string) string {
	detected := http.DetectContentType(data)
	if strings.HasPrefix(detected, "image/") {
		return detected
	}
	declared := strings.TrimSpace(declaredMime)
	if strings.HasPrefix(declared, "image/") {
		return declared
	}
	return ""
}

// exceedsMaxDimension informa se a imagem tem dimensões acima do limite.
//
// Conta os pixels (e não os bytes) porque o custo da análise cresce com a
// área: o Gemini fatia a imagem em blocos de 768px, então uma foto de 4000px
// custa ~6x mais tokens que a mesma foto reduzida a 1280px.
func exceedsMaxDimension(data []byte) bool {
	cfg, _, err := image.DecodeConfig(bytes.NewReader(data))
	if err != nil {
		return false
	}
	return cfg.Width > imageMaxDimension || cfg.Height > imageMaxDimension
}

// resizeImage reescala a imagem para que o lado maior não exceda maxDim.
//
// Usa média por área (box filter): o `image/draw` da stdlib faz nearest
// neighbor, que gera serrilhado pesado ao reduzir uma foto de 4000px.
func resizeImage(src image.Image, maxDim int) image.Image {
	bounds := src.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w <= 0 || h <= 0 {
		return src
	}
	if w <= maxDim && h <= maxDim {
		return src
	}

	scale := float64(maxDim) / float64(max(w, h))
	dstW := int(float64(w) * scale)
	dstH := int(float64(h) * scale)
	if dstW < 1 {
		dstW = 1
	}
	if dstH < 1 {
		dstH = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, dstW, dstH))
	for y := 0; y < dstH; y++ {
		y0 := bounds.Min.Y + y*h/dstH
		y1 := bounds.Min.Y + (y+1)*h/dstH
		if y1 <= y0 {
			y1 = y0 + 1
		}
		for x := 0; x < dstW; x++ {
			x0 := bounds.Min.X + x*w/dstW
			x1 := bounds.Min.X + (x+1)*w/dstW
			if x1 <= x0 {
				x1 = x0 + 1
			}
			var r, g, bl, a, n uint64
			for sy := y0; sy < y1; sy++ {
				for sx := x0; sx < x1; sx++ {
					cr, cg, cb, ca := src.At(sx, sy).RGBA()
					r += uint64(cr)
					g += uint64(cg)
					bl += uint64(cb)
					a += uint64(ca)
					n++
				}
			}
			if n == 0 {
				n = 1
			}
			dst.Set(x, y, color.RGBA{
				R: uint8(r / n >> 8),
				G: uint8(g / n >> 8),
				B: uint8(bl / n >> 8),
				A: uint8(a / n >> 8),
			})
		}
	}
	return dst
}
