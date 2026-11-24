package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"hash/fnv"
	"log"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

const (
	defaultMaxInboundAge         = 10 * time.Minute
	defaultMaxInboundConcurrency = 4
	defaultMaxInboundQueue       = 512
	chatLockShards               = 64
)

// whatsappInboundCoordinator limita a concorrência de processamento em background
// (transcrição Whisper + chamadas de IA) e serializa mensagens de uma mesma conversa.
type whatsappInboundCoordinator struct {
	sem       chan struct{}
	queued    atomic.Int64
	maxQueued int64
	chatLocks [chatLockShards]sync.Mutex
}

func newWhatsAppInboundCoordinator(concurrency, maxQueued int) *whatsappInboundCoordinator {
	if concurrency <= 0 {
		concurrency = defaultMaxInboundConcurrency
	}
	if maxQueued <= 0 {
		maxQueued = defaultMaxInboundQueue
	}
	return &whatsappInboundCoordinator{
		sem:       make(chan struct{}, concurrency),
		maxQueued: int64(maxQueued),
	}
}

func (c *whatsappInboundCoordinator) run(fn func()) {
	if c == nil || fn == nil {
		return
	}
	if n := c.queued.Add(1); n > c.maxQueued {
		c.queued.Add(-1)
		log.Printf("⚠️ [WhatsAppInbound] fila de processamento cheia (%d pendentes); evento descartado para proteger memória", c.maxQueued)
		return
	}
	go func() {
		defer c.queued.Add(-1)
		c.sem <- struct{}{}
		defer func() { <-c.sem }()
		fn()
	}()
}

// lockChat serializa mensagens do mesmo chat para preservar ordem e evitar
// corrida no histórico/IA entre mensagens consecutivas.
func (c *whatsappInboundCoordinator) lockChat(instanceName, remoteJID string) func() {
	if c == nil || (instanceName == "" && remoteJID == "") {
		return func() {}
	}
	h := fnv.New32a()
	_, _ = h.Write([]byte(instanceName))
	_, _ = h.Write([]byte{':'})
	_, _ = h.Write([]byte(remoteJID))
	idx := h.Sum32() % chatLockShards
	c.chatLocks[idx].Lock()
	return func() { c.chatLocks[idx].Unlock() }
}

type inboundRawItem struct {
	upsertType string
	raw        json.RawMessage
}

// extractInboundItems extrai todos os envelopes de mensagem de `data`, seja objeto
// único, array `[...]` ou wrapper `{"type":"notify|append","messages":[...]}`.
func extractInboundItems(data json.RawMessage) []inboundRawItem {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return nil
	}
	if trimmed[0] == '[' {
		var arr []json.RawMessage
		if err := json.Unmarshal(trimmed, &arr); err == nil && len(arr) > 0 {
			out := make([]inboundRawItem, 0, len(arr))
			for _, item := range arr {
				out = append(out, inboundRawItem{
					upsertType: extractUpsertType(item),
					raw:        item,
				})
			}
			return out
		}
		return nil
	}
	if trimmed[0] == '{' {
		var wrapper struct {
			Type     string            `json:"type"`
			Messages []json.RawMessage `json:"messages"`
		}
		if err := json.Unmarshal(trimmed, &wrapper); err == nil && len(wrapper.Messages) > 0 {
			out := make([]inboundRawItem, 0, len(wrapper.Messages))
			for _, item := range wrapper.Messages {
				ut := strings.TrimSpace(wrapper.Type)
				if ut == "" {
					ut = extractUpsertType(item)
				}
				out = append(out, inboundRawItem{
					upsertType: ut,
					raw:        item,
				})
			}
			return out
		}
		return []inboundRawItem{{
			upsertType: extractUpsertType(trimmed),
			raw:        trimmed,
		}}
	}
	return nil
}

func extractUpsertType(raw json.RawMessage) string {
	var meta struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(raw, &meta); err != nil {
		return ""
	}
	return strings.TrimSpace(meta.Type)
}

// isSupportedMessagesWebhookEvent aceita apenas eventos de nova mensagem / envio,
// descartando atualizações de ACK/status (`messages.update`, `messages.delete`, etc.).
func isSupportedMessagesWebhookEvent(event string) bool {
	ev := strings.ToLower(strings.TrimSpace(event))
	if ev == "" {
		return false
	}
	if strings.Contains(ev, "messages.update") ||
		strings.Contains(ev, "messages_update") ||
		strings.Contains(ev, "messages.delete") ||
		strings.Contains(ev, "messages_delete") ||
		strings.Contains(ev, "messages.set") ||
		strings.Contains(ev, "messages_set") {
		return false
	}
	return ev == "messages" ||
		strings.Contains(ev, "messages.upsert") ||
		strings.Contains(ev, "messages_upsert") ||
		strings.Contains(ev, "send.message") ||
		strings.Contains(ev, "send_message")
}

// isStaleOrAppendReplay identifica mensagens antigas reenviadas após queda/reconexão
// do servidor ou lotes históricos de sincronização (`type: "append"`).
func isStaleOrAppendReplay(upsertType string, msgTimestamp time.Time, maxAge time.Duration) bool {
	if strings.EqualFold(strings.TrimSpace(upsertType), "append") {
		return true
	}
	if msgTimestamp.IsZero() || maxAge <= 0 {
		return false
	}
	return time.Since(msgTimestamp) > maxAge
}

// checkShadowInboxDuplicate consulta o shadow inbox persistido para evitar que
// mensagens anteriores a um restart sejam reprocessadas pela IA/Whisper.
func checkShadowInboxDuplicate(
	ctx context.Context,
	contextSvc *WhatsAppContextService,
	userID string,
	msg *inboundMessage,
	upsertType string,
) (alreadyHandled bool, cachedMediaText string) {
	if contextSvc == nil || msg == nil || msg.MessageID == "" || userID == "" {
		return false, ""
	}
	existing, err := contextSvc.MessageByID(ctx, userID, msg.MessageID)
	if err != nil || existing == nil {
		return false, ""
	}
	if existing.Kind == messageKindVito {
		return true, existing.MediaText
	}
	// Se já foi arquivada no banco e chegou como append ou tem mais de 2 min,
	// trata como replay pós-queda/reinício e evita reenviar resposta.
	if strings.EqualFold(strings.TrimSpace(upsertType), "append") {
		return true, existing.MediaText
	}
	if !msg.Timestamp.IsZero() && time.Since(msg.Timestamp) > 2*time.Minute {
		return true, existing.MediaText
	}
	if !existing.CreatedAt.IsZero() && (time.Since(existing.CreatedAt) > 2*time.Minute || time.Since(existing.CreatedAt) <= 2*time.Minute) {
		return true, existing.MediaText
	}
	return true, existing.MediaText
}

// archiveStaleMessage arquiva silenciosamente uma mensagem antiga/append sem
// disparar transcrição Whisper, reação 👀 ou resposta de IA.
func (s *WhatsAppService) archiveStaleMessage(
	ctx context.Context,
	integration *domain.WhatsAppIntegration,
	instanceName string,
	msg *inboundMessage,
) {
	if s.contextSvc == nil || integration == nil || msg == nil || msg.MessageID == "" {
		return
	}
	rawText := strings.TrimSpace(msg.Text)
	if rawText == "" && !msg.IsImage && !msg.IsAudio {
		return
	}
	if IsVitoMessage(rawText) || s.isOutboundReply(rawText) {
		clean, _ := StripVitoSignature(rawText)
		s.archiveMessage(ctx, integration.UserID, instanceName, msg, s.classifyChatCachedOnly(instanceName, integration, msg.RemoteJID), clean, "vito")
		return
	}
	chatKind := s.classifyChatCachedOnly(instanceName, integration, msg.RemoteJID)
	s.archiveMessage(ctx, integration.UserID, instanceName, msg, chatKind, rawText, "user")
}

// classifyChatCachedOnly classifica a conversa usando apenas os caches locais
// (sem chamadas HTTP bloqueantes à Evolution API) para arquivamento rápido de replay.
func (s *WhatsAppService) classifyChatCachedOnly(instanceName string, integration *domain.WhatsAppIntegration, remoteJID string) string {
	participants, fresh := 0, false
	if strings.HasSuffix(remoteJID, "@g.us") && s.groupMeta != nil {
		participants, fresh = s.groupMeta.ParticipantsCount(remoteJID)
	}
	ownerLID := ""
	selfReference := integration.Phone
	if s.ownerCache != nil {
		ownerLID = s.ownerCache.LID(instanceName)
		if ownerLID != "" && strings.EqualFold(strings.TrimSpace(remoteJID), ownerLID) {
			return domain.WhatsAppChatKindSelf
		}
		if ownerJID, _ := s.ownerCache.JID(instanceName); ownerJID != "" {
			selfReference = ownerJID
		}
	}
	return ClassifyChat(remoteJID, selfReference, participants, fresh, ownerLID)
}
