package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// mediaDescriptionPrompt é o pedido padrão de descrição de imagem do histórico.
const mediaDescriptionPrompt = "Descreva esta imagem em português, de forma objetiva, em até 3 frases. Se houver texto na imagem, transcreva-o."

// WhatsAppMediaEnricher lê a mídia das mensagens do WhatsApp (áudio e imagem).
//
// Sem isto o shadow inbox guardava só o TEXTO: uma foto antiga era ilegível
// para sempre, porque o backfill descartava o payload cru da mídia.
//
// Custos (por isso o worker tem teto por ciclo e o enriquecimento sob demanda):
//   - áudio: Whisper no Groq (cota generosa);
//   - imagem: visão via OpenRouter — o Gemini free tier (20 req/dia) fica
//     reservado ao chat.
type WhatsAppMediaEnricher struct {
	client      EvolutionAPIClient
	contextSvc  *WhatsAppContextService
	transcriber ai.AudioTranscriber
	vision      ai.ImageDescriber
	maxAge      time.Duration
	timeout     time.Duration
}

// WhatsAppMediaEnricherConfig parametrização do enriquecimento de mídia.
type WhatsAppMediaEnricherConfig struct {
	MaxAge  time.Duration
	Timeout time.Duration
}

// DefaultWhatsAppMediaEnricherConfig devolve a configuração padrão.
func DefaultWhatsAppMediaEnricherConfig() WhatsAppMediaEnricherConfig {
	return WhatsAppMediaEnricherConfig{
		MaxAge:  90 * 24 * time.Hour,
		Timeout: 45 * time.Second,
	}
}

// NewWhatsAppMediaEnricher cria o enriquecedor de mídia.
func NewWhatsAppMediaEnricher(
	client EvolutionAPIClient,
	contextSvc *WhatsAppContextService,
	transcriber ai.AudioTranscriber,
	vision ai.ImageDescriber,
	cfg WhatsAppMediaEnricherConfig,
) *WhatsAppMediaEnricher {
	if cfg.MaxAge <= 0 {
		cfg.MaxAge = 90 * 24 * time.Hour
	}
	if cfg.Timeout <= 0 {
		cfg.Timeout = 45 * time.Second
	}
	return &WhatsAppMediaEnricher{
		client:      client,
		contextSvc:  contextSvc,
		transcriber: transcriber,
		vision:      vision,
		maxAge:      cfg.MaxAge,
		timeout:     cfg.Timeout,
	}
}

// SetTranscriber injeta o transcritor de áudio (Groq Whisper).
func (e *WhatsAppMediaEnricher) SetTranscriber(transcriber ai.AudioTranscriber) {
	e.transcriber = transcriber
}

// SetVision injeta o provedor de visão (OpenRouter).
func (e *WhatsAppMediaEnricher) SetVision(vision ai.ImageDescriber) {
	e.vision = vision
}

// Enrich lê a mídia de uma mensagem e devolve o conteúdo (transcrição ou descrição).
//
// Idempotente: uma mídia já analisada (media_status = done) não é reprocessada.
func (e *WhatsAppMediaEnricher) Enrich(ctx context.Context, msg domain.WhatsAppConversationMessage) (string, error) {
	if e == nil || e.client == nil || e.contextSvc == nil {
		return "", fmt.Errorf("enriquecedor de mídia indisponível")
	}
	if strings.TrimSpace(msg.MediaPayload) == "" {
		return "", fmt.Errorf("mensagem %s não tem referência de mídia", msg.ID)
	}
	if msg.MediaStatus == domain.WhatsAppMediaStatusDone && strings.TrimSpace(msg.MediaText) != "" {
		return msg.MediaText, nil
	}

	runCtx, cancel := context.WithTimeout(ctx, e.timeout)
	defer cancel()

	var (
		content string
		err     error
	)
	switch msg.MediaKind {
	case domain.WhatsAppMediaKindAudio:
		content, err = e.transcribe(runCtx, msg)
	case domain.WhatsAppMediaKindImage:
		content, err = e.describe(runCtx, msg)
	default:
		return "", fmt.Errorf("tipo de mídia não suportado: %q", msg.MediaKind)
	}
	if err != nil {
		_ = e.contextSvc.SaveMediaStatus(runCtx, msg.UserID, msg.ID, domain.WhatsAppMediaStatusFailed)
		return "", err
	}

	content = strings.TrimSpace(content)
	if content == "" {
		_ = e.contextSvc.SaveMediaStatus(runCtx, msg.UserID, msg.ID, domain.WhatsAppMediaStatusFailed)
		return "", fmt.Errorf("mídia %s sem conteúdo", msg.ID)
	}
	if err := e.contextSvc.SaveMediaText(runCtx, msg.UserID, msg.ID, content); err != nil {
		return "", err
	}
	return content, nil
}

// transcribe baixa o áudio e transcreve com o Whisper.
func (e *WhatsAppMediaEnricher) transcribe(ctx context.Context, msg domain.WhatsAppConversationMessage) (string, error) {
	if e.transcriber == nil {
		return "", fmt.Errorf("transcritor de áudio indisponível")
	}
	audioBytes, err := e.downloadMedia(ctx, msg)
	if err != nil {
		return "", err
	}
	transcribed, err := e.transcriber.Transcribe(ctx, bytes.NewReader(audioBytes), "audio.ogg")
	if err != nil {
		return "", err
	}
	return transcribed, nil
}

// describe baixa a imagem, normaliza e pede a descrição ao provedor de visão.
func (e *WhatsAppMediaEnricher) describe(ctx context.Context, msg domain.WhatsAppConversationMessage) (string, error) {
	if e.vision == nil {
		return "", fmt.Errorf("provedor de visão indisponível")
	}
	raw, err := e.downloadMedia(ctx, msg)
	if err != nil {
		return "", err
	}
	prepared, mime, err := ai.PrepareImage(base64.StdEncoding.EncodeToString(raw), msg.MediaMime)
	if err != nil {
		return "", err
	}
	return e.vision.DescribeImage(ctx, prepared, mime, mediaDescriptionPrompt)
}

// downloadMedia baixa a mídia do WhatsApp usando o envelope arquivado.
func (e *WhatsAppMediaEnricher) downloadMedia(ctx context.Context, msg domain.WhatsAppConversationMessage) ([]byte, error) {
	var payload interface{}
	if err := json.Unmarshal([]byte(msg.MediaPayload), &payload); err != nil {
		return nil, fmt.Errorf("payload de mídia inválido: %w", err)
	}
	b64, err := e.client.GetMediaBase64(ctx, msg.InstanceName, payload)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(b64) == "" {
		return nil, fmt.Errorf("mídia vazia")
	}
	raw, err := base64.StdEncoding.DecodeString(b64)
	if err != nil {
		return nil, fmt.Errorf("base64 de mídia inválido: %w", err)
	}
	return raw, nil
}

// EnrichPending enriquece as mídias pendentes de um usuário (teto por ciclo).
//
// A ordem é a mais antiga primeiro: a mídia que está há mais tempo invisível
// para o Vito é a que o usuário mais precisa.
func (e *WhatsAppMediaEnricher) EnrichPending(ctx context.Context, userID string, limit int) (int, error) {
	if e == nil || e.contextSvc == nil {
		return 0, nil
	}
	if limit <= 0 {
		limit = 3
	}
	pending, err := e.contextSvc.PendingMedia(ctx, userID, limit, time.Now().UTC().Add(-e.maxAge))
	if err != nil {
		return 0, err
	}
	enriched := 0
	for _, msg := range pending {
		if _, err := e.Enrich(ctx, msg); err != nil {
			log.Printf("⚠️ [WhatsAppMedia] falha ao enriquecer %s: %v", msg.ID, err)
			continue
		}
		enriched++
	}
	return enriched, nil
}
