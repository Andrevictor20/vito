package repository

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppConversationRepositorySQLite implementa domain.WhatsAppConversationRepository em SQLite.
type WhatsAppConversationRepositorySQLite struct {
	db *sql.DB
}

// NewWhatsAppConversationRepository cria o repositório do shadow inbox do WhatsApp.
func NewWhatsAppConversationRepository(db *sql.DB) *WhatsAppConversationRepositorySQLite {
	return &WhatsAppConversationRepositorySQLite{db: db}
}

const waConversationColumns = `id, user_id, instance_name, chat_jid, chat_kind, chat_label,
	sender_jid, sender_name, from_me, kind, text, quoted_text, message_timestamp, created_at`

// SaveMessage arquiva uma mensagem do WhatsApp de forma idempotente (upsert por id).
func (r *WhatsAppConversationRepositorySQLite) SaveMessage(ctx context.Context, msg *domain.WhatsAppConversationMessage) error {
	if msg == nil || msg.ID == "" || msg.UserID == "" {
		return errors.New("mensagem do WhatsApp inválida")
	}
	if msg.CreatedAt.IsZero() {
		msg.CreatedAt = time.Now().UTC()
	}
	if msg.MessageTimestamp.IsZero() {
		msg.MessageTimestamp = msg.CreatedAt
	}

	return database.WithBusyRetry(4, func() error {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO whatsapp_conversation_messages
				(id, user_id, instance_name, chat_jid, chat_kind, chat_label, sender_jid, sender_name,
				 from_me, kind, text, quoted_text, message_timestamp, created_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(id) DO UPDATE SET
				chat_kind   = excluded.chat_kind,
				chat_label  = CASE WHEN excluded.chat_label <> '' THEN excluded.chat_label ELSE whatsapp_conversation_messages.chat_label END,
				sender_name = CASE WHEN excluded.sender_name <> '' THEN excluded.sender_name ELSE whatsapp_conversation_messages.sender_name END,
				quoted_text = CASE WHEN excluded.quoted_text <> '' THEN excluded.quoted_text ELSE whatsapp_conversation_messages.quoted_text END,
				text        = CASE WHEN excluded.text <> '' THEN excluded.text ELSE whatsapp_conversation_messages.text END
		`, msg.ID, msg.UserID, msg.InstanceName, msg.ChatJID, msg.ChatKind, msg.ChatLabel,
			msg.SenderJID, msg.SenderName, boolToInt(msg.FromMe), msg.Kind, msg.Text, msg.QuotedText,
			msg.MessageTimestamp, msg.CreatedAt)
		return err
	})
}

// RecentMessages retorna as mensagens mais recentes de um chat, em ordem cronológica.
func (r *WhatsAppConversationRepositorySQLite) RecentMessages(ctx context.Context, userID, chatJID string, limit int, since time.Time) ([]domain.WhatsAppConversationMessage, error) {
	if userID == "" || chatJID == "" || limit <= 0 {
		return []domain.WhatsAppConversationMessage{}, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+waConversationColumns+`
		FROM whatsapp_conversation_messages
		WHERE user_id = ? AND chat_jid = ? AND message_timestamp >= ?
		ORDER BY message_timestamp DESC
		LIMIT ?
	`, userID, chatJID, since, limit)
	if err != nil {
		return nil, err
	}
	return scanConversationMessages(rows)
}

// RecentMessagesAcrossChats retorna as mensagens mais recentes de todos os chats do usuário.
func (r *WhatsAppConversationRepositorySQLite) RecentMessagesAcrossChats(ctx context.Context, userID string, limit int, since time.Time) ([]domain.WhatsAppConversationMessage, error) {
	if userID == "" || limit <= 0 {
		return []domain.WhatsAppConversationMessage{}, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+waConversationColumns+`
		FROM whatsapp_conversation_messages
		WHERE user_id = ? AND message_timestamp >= ?
		ORDER BY message_timestamp DESC
		LIMIT ?
	`, userID, since, limit)
	if err != nil {
		return nil, err
	}
	return scanConversationMessages(rows)
}

// GetContextSettings retorna as preferências de escopo do usuário (nil se nunca configuradas).
func (r *WhatsAppConversationRepositorySQLite) GetContextSettings(ctx context.Context, userID string) (*domain.WhatsAppContextSettings, error) {
	if userID == "" {
		return nil, errors.New("userID obrigatório")
	}
	var s domain.WhatsAppContextSettings
	err := r.db.QueryRowContext(ctx, `
		SELECT user_id, scope, window_size, updated_at
		FROM whatsapp_context_settings
		WHERE user_id = ?
	`, userID).Scan(&s.UserID, &s.Scope, &s.WindowSize, &s.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &s, nil
}

// SaveContextSettings cria ou atualiza as preferências de escopo do usuário.
func (r *WhatsAppConversationRepositorySQLite) SaveContextSettings(ctx context.Context, settings *domain.WhatsAppContextSettings) error {
	if settings == nil || settings.UserID == "" {
		return errors.New("preferências de contexto inválidas")
	}
	if settings.UpdatedAt.IsZero() {
		settings.UpdatedAt = time.Now().UTC()
	}
	return database.WithBusyRetry(4, func() error {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO whatsapp_context_settings (user_id, scope, window_size, updated_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(user_id) DO UPDATE SET
				scope       = excluded.scope,
				window_size = excluded.window_size,
				updated_at  = excluded.updated_at
		`, settings.UserID, settings.Scope, settings.WindowSize, settings.UpdatedAt)
		return err
	})
}

// DeleteMessages remove todas as mensagens arquivadas do usuário (botão "Limpar histórico").
func (r *WhatsAppConversationRepositorySQLite) DeleteMessages(ctx context.Context, userID string) error {
	if userID == "" {
		return errors.New("userID obrigatório")
	}
	return database.WithBusyRetry(4, func() error {
		_, err := r.db.ExecContext(ctx, `DELETE FROM whatsapp_conversation_messages WHERE user_id = ?`, userID)
		return err
	})
}

// PruneOlderThan remove mensagens anteriores ao limite de retenção e devolve quantas saiuíram.
func (r *WhatsAppConversationRepositorySQLite) PruneOlderThan(ctx context.Context, cutoff time.Time) (int64, error) {
	var removed int64
	err := database.WithBusyRetry(4, func() error {
		res, err := r.db.ExecContext(ctx, `DELETE FROM whatsapp_conversation_messages WHERE message_timestamp < ?`, cutoff)
		if err != nil {
			return err
		}
		removed, _ = res.RowsAffected()
		return nil
	})
	return removed, err
}

// scanConversationMessages materializa as linhas e inverte o ORDER BY DESC para ordem cronológica.
func scanConversationMessages(rows *sql.Rows) ([]domain.WhatsAppConversationMessage, error) {
	defer rows.Close()

	result := make([]domain.WhatsAppConversationMessage, 0, 16)
	for rows.Next() {
		var m domain.WhatsAppConversationMessage
		var fromMe int
		if err := rows.Scan(
			&m.ID, &m.UserID, &m.InstanceName, &m.ChatJID, &m.ChatKind, &m.ChatLabel,
			&m.SenderJID, &m.SenderName, &fromMe, &m.Kind, &m.Text, &m.QuotedText,
			&m.MessageTimestamp, &m.CreatedAt,
		); err != nil {
			return nil, err
		}
		m.FromMe = fromMe != 0
		result = append(result, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// A consulta vem em ordem decrescente; a janela de contexto é entregue em ordem cronológica.
	for i, j := 0, len(result)-1; i < j; i, j = i+1, j-1 {
		result[i], result[j] = result[j], result[i]
	}
	return result, nil
}

func boolToInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
