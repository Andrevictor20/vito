package service

import (
	"context"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// ChatService gerencia a lógica de negócio e sincronização de conversas entre dispositivos.
type ChatService struct {
	repo domain.ChatRepository
}

// NewChatService instancia o serviço de sincronização de chat.
func NewChatService(repo domain.ChatRepository) *ChatService {
	return &ChatService{repo: repo}
}

// ListSessions retorna as sessões de chat do usuário.
func (s *ChatService) ListSessions(ctx context.Context, userID string) ([]domain.ChatSession, error) {
	if userID == "" {
		return nil, errors.New("userID obrigatório")
	}
	return s.repo.ListSessions(ctx, userID)
}

// GetSessionWithMessages retorna a conversa e suas mensagens.
func (s *ChatService) GetSessionWithMessages(ctx context.Context, sessionID, userID string) (*domain.ChatSessionWithMessages, error) {
	if sessionID == "" || userID == "" {
		return nil, errors.New("sessionID e userID obrigatórios")
	}
	return s.repo.GetSessionWithMessages(ctx, sessionID, userID)
}

// SyncSession realiza o upsert bidirecional da sessão e suas mensagens com reconciliação atômica.
func (s *ChatService) SyncSession(ctx context.Context, userID string, session *domain.ChatSession, messages []domain.ChatMessage) (*domain.ChatSessionWithMessages, error) {
	if userID == "" || session == nil || session.ID == "" {
		return nil, errors.New("dados de sessão inválidos para sincronização")
	}

	session.UserID = userID
	if session.Title == "" {
		session.Title = "Nova Conversa"
	}
	now := time.Now().UTC()
	if session.UpdatedAt.IsZero() {
		session.UpdatedAt = now
	}

	// Persiste metadados da sessão
	if err := s.repo.SaveSession(ctx, session); err != nil {
		return nil, err
	}

	// Sanitiza e atribui tenant em todas as mensagens
	for i := range messages {
		messages[i].SessionID = session.ID
		messages[i].UserID = userID
		if messages[i].Timestamp.IsZero() {
			messages[i].Timestamp = now
		}
	}

	if len(messages) > 0 {
		if err := s.repo.SaveMessages(ctx, messages); err != nil {
			return nil, err
		}
	}

	return s.repo.GetSessionWithMessages(ctx, session.ID, userID)
}

// DeleteSession remove a sessão e todo o seu histórico no servidor.
func (s *ChatService) DeleteSession(ctx context.Context, sessionID, userID string) error {
	if sessionID == "" || userID == "" {
		return errors.New("sessionID e userID obrigatórios")
	}
	return s.repo.DeleteSession(ctx, sessionID, userID)
}
