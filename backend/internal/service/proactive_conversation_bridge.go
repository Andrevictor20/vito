package service

import (
	"context"
	"time"

	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/google/uuid"
)

// ProactiveConversationBridge conecta os workers proativos do Vito ao ConversationStore (AC-11).
type ProactiveConversationBridge struct {
	repo *repository.ConversationStoreRepository
}

// NewProactiveConversationBridge cria a ponte proativa.
func NewProactiveConversationBridge(repo *repository.ConversationStoreRepository) *ProactiveConversationBridge {
	return &ProactiveConversationBridge{repo: repo}
}

// RecordProactiveNotification grava um alerta emitido por um worker no histórico da conversa do usuário.
func (b *ProactiveConversationBridge) RecordProactiveNotification(ctx context.Context, userID, channel, workerType, message string) error {
	if b.repo == nil {
		return nil
	}
	if channel == "" {
		channel = "app_mobile"
	}

	thread, err := b.repo.GetOrCreateThread(ctx, userID, channel, "")
	if err != nil {
		return err
	}

	turn := repository.ConversationTurn{
		ID:         uuid.New().String(),
		ThreadID:   thread.ID,
		UserID:     userID,
		Channel:    channel,
		Role:       "assistant",
		Origin:     "proactive_worker",
		WorkerType: workerType,
		Content:    message,
		ModelUsed:  "proactive_worker_engine",
		CreatedAt:  time.Now().UTC(),
	}

	return b.repo.CreateTurn(ctx, &turn)
}
