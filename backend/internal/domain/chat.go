package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrChatSessionNotFound = errors.New("conversa não encontrada")
)

// ChatSession representa uma sessão de conversa do usuário com o assistente Vito.
type ChatSession struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Title     string    `json:"title"`
	Preview   string    `json:"preview"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ChatMessage representa uma mensagem individual dentro de uma sessão.
type ChatMessage struct {
	ID              string    `json:"id"`
	SessionID       string    `json:"session_id"`
	UserID          string    `json:"user_id"`
	Sender          string    `json:"sender"` // "user" ou "vito"
	Text            string    `json:"text"`
	Timestamp       time.Time `json:"timestamp"`
	ImageURI        string    `json:"image_uri,omitempty"`
	ActionPerformed string    `json:"action_performed,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

// ChatSessionWithMessages agrega uma sessão e suas respectivas mensagens.
type ChatSessionWithMessages struct {
	Session  ChatSession   `json:"session"`
	Messages []ChatMessage `json:"messages"`
}

// ChatRepository define o contrato de persistência para sessões e mensagens de chat.
type ChatRepository interface {
	ListSessions(ctx context.Context, userID string) ([]ChatSession, error)
	GetSession(ctx context.Context, id, userID string) (*ChatSession, error)
	GetSessionWithMessages(ctx context.Context, sessionID, userID string) (*ChatSessionWithMessages, error)
	SaveSession(ctx context.Context, session *ChatSession) error
	SaveMessages(ctx context.Context, messages []ChatMessage) error
	DeleteSession(ctx context.Context, id, userID string) error
}
