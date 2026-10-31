package service

import (
	"context"
	"time"

	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/google/uuid"
)

// WhatsAppConversationBridge faz a ponte entre o webhook do WhatsApp e o ConversationStore SQLite.
type WhatsAppConversationBridge struct {
	repo *repository.ConversationStoreRepository
}

// NewWhatsAppConversationBridge cria a ponte de conversa do WhatsApp.
func NewWhatsAppConversationBridge(repo *repository.ConversationStoreRepository) *WhatsAppConversationBridge {
	return &WhatsAppConversationBridge{repo: repo}
}

// RecordIncoming grava uma mensagem recebida de um contato no WhatsApp como turno 'user'.
func (b *WhatsAppConversationBridge) RecordIncoming(ctx context.Context, userID, chatJID, text string) (*repository.ConversationThread, error) {
	if b.repo == nil {
		return nil, nil
	}
	thread, err := b.repo.GetOrCreateThread(ctx, userID, "whatsapp", chatJID)
	if err != nil {
		return nil, err
	}

	turn := repository.ConversationTurn{
		ID:        uuid.New().String(),
		ThreadID:  thread.ID,
		UserID:    userID,
		Channel:   "whatsapp",
		Role:      "user",
		Origin:    "direct",
		Content:   text,
		CreatedAt: time.Now().UTC(),
	}
	if err := b.repo.CreateTurn(ctx, &turn); err != nil {
		return nil, err
	}
	return thread, nil
}

// RecordOutgoing grava a resposta do assistente no WhatsApp como turno 'assistant'.
func (b *WhatsAppConversationBridge) RecordOutgoing(ctx context.Context, userID, threadID, text, modelUsed string) error {
	if b.repo == nil {
		return nil
	}
	turn := repository.ConversationTurn{
		ID:        uuid.New().String(),
		ThreadID:  threadID,
		UserID:    userID,
		Channel:   "whatsapp",
		Role:      "assistant",
		Origin:    "direct",
		Content:   text,
		ModelUsed: modelUsed,
		CreatedAt: time.Now().UTC(),
	}
	return b.repo.CreateTurn(ctx, &turn)
}

// GetRecentHistory retorna os últimos turnos (até limit, default 20) da conversa no WhatsApp.
func (b *WhatsAppConversationBridge) GetRecentHistory(ctx context.Context, threadID string, limit int) ([]*repository.ConversationTurn, error) {
	if b.repo == nil {
		return nil, nil
	}
	if limit <= 0 {
		limit = 20
	}
	return b.repo.ListTurnsByThread(ctx, threadID, limit)
}

// GetOrCreateThread recupera ou inicializa a thread para o contato no WhatsApp.
func (b *WhatsAppConversationBridge) GetOrCreateThread(ctx context.Context, userID, chatJID string) (*repository.ConversationThread, error) {
	if b.repo == nil {
		return nil, nil
	}
	return b.repo.GetOrCreateThread(ctx, userID, "whatsapp", chatJID)
}

// SetConversationBridge conecta a ponte de conversas ao WhatsAppService.
func (s *WhatsAppService) SetConversationBridge(bridge *WhatsAppConversationBridge) {
	s.convBridge = bridge
}

// ConversationBridge retorna a ponte de conversas configurada no WhatsAppService.
func (s *WhatsAppService) ConversationBridge() *WhatsAppConversationBridge {
	return s.convBridge
}

// recordBridgeIncoming registra uma mensagem recebida e devolve o threadID correspondente.
func (s *WhatsAppService) recordBridgeIncoming(ctx context.Context, userID, chatJID, text string) string {
	if s.convBridge == nil {
		return ""
	}
	thread, err := s.convBridge.RecordIncoming(ctx, userID, chatJID, text)
	if err != nil || thread == nil {
		return ""
	}
	return thread.ID
}

// recordBridgeOutgoing grava o turno do assistente na thread correspondente.
func (s *WhatsAppService) recordBridgeOutgoing(ctx context.Context, userID, threadID, chatJID, text, modelUsed string) {
	if s.convBridge == nil {
		return
	}
	if threadID == "" {
		if thread, err := s.convBridge.GetOrCreateThread(ctx, userID, chatJID); err == nil && thread != nil {
			threadID = thread.ID
		}
	}
	if threadID != "" {
		_ = s.convBridge.RecordOutgoing(ctx, userID, threadID, text, modelUsed)
	}
}
