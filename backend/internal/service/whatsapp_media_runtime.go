package service

import (
	"context"
	"encoding/json"
	"log"
	"strings"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// enrichOnDemand analisa a mídia que ainda não foi lida (mensagem atual e
// mensagem marcada), para o Vito "enxergar" o conteúdo.
//
// É o par do worker de background: o worker processa o backlog aos poucos
// (custo), e o acionamento do Vito resolve na hora o que é relevante agora.
func (s *WhatsAppService) enrichOnDemand(ctx context.Context, userID string, msg *inboundMessage) {
	if s.enricher == nil || s.contextSvc == nil || msg == nil {
		return
	}
	candidates := []string{msg.MessageID}
	if msg.QuotedID != "" {
		candidates = append(candidates, msg.QuotedID)
	}
	for _, id := range candidates {
		if id == "" {
			continue
		}
		archived, err := s.contextSvc.MessageByID(ctx, userID, id)
		if err != nil || archived == nil {
			continue
		}
		if archived.MediaKind == "" || archived.MediaStatus == domain.WhatsAppMediaStatusDone {
			continue
		}
		if strings.TrimSpace(archived.MediaPayload) == "" {
			continue
		}
		content, err := s.enricher.Enrich(ctx, *archived)
		if err != nil {
			log.Printf("⚠️ [WhatsAppMedia] não foi possível analisar a mídia %s sob demanda: %v", id, err)
			continue
		}
		log.Printf("🖼️ [WhatsAppMedia] mídia %s analisada sob demanda (%d caracteres)", id, len(content))
	}
}

// downloadImage baixa a imagem da Evolution API e normaliza o payload.
//
// O reuso do GetMediaBase64 (o mesmo caminho do áudio) evita uma segunda
// integração com a Evolution. A normalização corrige o mime real e reduz o
// tamanho — fotos do WhatsApp chegam com 16MB, acima do limite de payload do
// provedor de IA.
func (s *WhatsAppService) downloadImage(ctx context.Context, instanceName string, data json.RawMessage, mime string) (string, string) {
	b64, err := s.client.GetMediaBase64(ctx, instanceName, data)
	if err != nil {
		log.Printf("⚠️ [WhatsAppService] falha ao baixar a imagem: %v", err)
		return "", ""
	}
	if strings.TrimSpace(b64) == "" {
		return "", ""
	}
	prepared, preparedMime, err := ai.PrepareImage(b64, mime)
	if err != nil {
		log.Printf("⚠️ [WhatsAppService] imagem não pôde ser preparada: %v", err)
		return "", ""
	}
	return prepared, preparedMime
}
