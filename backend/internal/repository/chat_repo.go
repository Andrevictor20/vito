package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// ChatRepositorySQLite implementa domain.ChatRepository usando SQLite.
type ChatRepositorySQLite struct {
	db *sql.DB
}

// NewChatRepository instancia o repositório de chat SQLite.
func NewChatRepository(db *sql.DB) *ChatRepositorySQLite {
	return &ChatRepositorySQLite{db: db}
}

// ListSessions lista todas as sessões de chat do usuário ordenadas por updated_at DESC.
func (r *ChatRepositorySQLite) ListSessions(ctx context.Context, userID string) ([]domain.ChatSession, error) {
	query := `
		SELECT id, user_id, title, preview, created_at, updated_at
		FROM chat_sessions
		WHERE user_id = ?
		ORDER BY updated_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := make([]domain.ChatSession, 0)
	for rows.Next() {
		var s domain.ChatSession
		if err := rows.Scan(&s.ID, &s.UserID, &s.Title, &s.Preview, &s.CreatedAt, &s.UpdatedAt); err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, rows.Err()
}

// GetSession busca os metadados de uma sessão específica.
func (r *ChatRepositorySQLite) GetSession(ctx context.Context, id, userID string) (*domain.ChatSession, error) {
	query := `
		SELECT id, user_id, title, preview, created_at, updated_at
		FROM chat_sessions
		WHERE id = ? AND user_id = ?
	`
	var s domain.ChatSession
	err := r.db.QueryRowContext(ctx, query, id, userID).Scan(
		&s.ID, &s.UserID, &s.Title, &s.Preview, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

// GetSessionWithMessages busca a sessão e todas as suas mensagens ordenadas cronologicamente.
func (r *ChatRepositorySQLite) GetSessionWithMessages(ctx context.Context, sessionID, userID string) (*domain.ChatSessionWithMessages, error) {
	sess, err := r.GetSession(ctx, sessionID, userID)
	if err != nil {
		return nil, err
	}
	if sess == nil {
		return nil, nil
	}

	query := `
		SELECT id, session_id, user_id, sender, text, timestamp, COALESCE(image_uri, ''), COALESCE(action_performed, ''), created_at
		FROM chat_messages
		WHERE session_id = ? AND user_id = ?
		ORDER BY timestamp ASC
	`
	rows, err := r.db.QueryContext(ctx, query, sessionID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	messages := make([]domain.ChatMessage, 0)
	for rows.Next() {
		var m domain.ChatMessage
		if err := rows.Scan(
			&m.ID, &m.SessionID, &m.UserID, &m.Sender, &m.Text, &m.Timestamp, &m.ImageURI, &m.ActionPerformed, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}

	return &domain.ChatSessionWithMessages{
		Session:  *sess,
		Messages: messages,
	}, rows.Err()
}

// SaveSession insere ou atualiza os metadados da sessão (upsert atômico).
func (r *ChatRepositorySQLite) SaveSession(ctx context.Context, session *domain.ChatSession) error {
	now := time.Now().UTC()
	if session.CreatedAt.IsZero() {
		session.CreatedAt = now
	}
	if session.UpdatedAt.IsZero() {
		session.UpdatedAt = now
	}

	query := `
		INSERT INTO chat_sessions (id, user_id, title, preview, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			title = excluded.title,
			preview = excluded.preview,
			updated_at = excluded.updated_at
	`
	_, err := r.db.ExecContext(ctx, query,
		session.ID, session.UserID, session.Title, session.Preview, session.CreatedAt, session.UpdatedAt,
	)
	return err
}

// SaveMessages insere ou atualiza um lote de mensagens dentro de uma transação SQLite.
func (r *ChatRepositorySQLite) SaveMessages(ctx context.Context, messages []domain.ChatMessage) error {
	if len(messages) == 0 {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO chat_messages (id, session_id, user_id, sender, text, timestamp, image_uri, action_performed, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(id) DO UPDATE SET
			text = excluded.text,
			image_uri = excluded.image_uri,
			action_performed = excluded.action_performed
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now().UTC()
	for _, m := range messages {
		if m.CreatedAt.IsZero() {
			m.CreatedAt = now
		}
		if m.Timestamp.IsZero() {
			m.Timestamp = now
		}
		_, err := stmt.ExecContext(ctx,
			m.ID, m.SessionID, m.UserID, m.Sender, m.Text, m.Timestamp, m.ImageURI, m.ActionPerformed, m.CreatedAt,
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// DeleteSession remove a sessão e cascateia a remoção das mensagens.
func (r *ChatRepositorySQLite) DeleteSession(ctx context.Context, id, userID string) error {
	query := `DELETE FROM chat_sessions WHERE id = ? AND user_id = ?`
	_, err := r.db.ExecContext(ctx, query, id, userID)
	return err
}
