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

// RecentMessagesByKind retorna as mensagens recentes de um tipo de chat
// (self = conversa "Você"; group/direct = demais conversas).
func (r *WhatsAppConversationRepositorySQLite) RecentMessagesByKind(ctx context.Context, userID, chatKind string, limit int, since time.Time) ([]domain.WhatsAppConversationMessage, error) {
	if userID == "" || chatKind == "" || limit <= 0 {
		return []domain.WhatsAppConversationMessage{}, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+waConversationColumns+`
		FROM whatsapp_conversation_messages
		WHERE user_id = ? AND chat_kind = ? AND message_timestamp >= ?
		ORDER BY message_timestamp DESC
		LIMIT ?
	`, userID, chatKind, since, limit)
	if err != nil {
		return nil, err
	}
	return scanConversationMessages(rows)
}

// RecentChats devolve um resumo por conversa (última mensagem + volume),
// do mais recente para o mais antigo. É a base do diretório de contatos e
// da lista de pendências de resposta.
func (r *WhatsAppConversationRepositorySQLite) RecentChats(ctx context.Context, userID string, since time.Time, limit int) ([]domain.WhatsAppChatSummary, error) {
	if userID == "" || limit <= 0 {
		return []domain.WhatsAppChatSummary{}, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT chat_jid, chat_label, chat_kind, text, sender_name, from_me, message_timestamp, total
		FROM (
			SELECT
				chat_jid, chat_label, chat_kind, text, sender_name, from_me, message_timestamp,
				ROW_NUMBER() OVER (PARTITION BY chat_jid ORDER BY message_timestamp DESC) AS rn,
				COUNT(*) OVER (PARTITION BY chat_jid) AS total
			FROM whatsapp_conversation_messages
			WHERE user_id = ? AND message_timestamp >= ?
		)
		WHERE rn = 1
		ORDER BY message_timestamp DESC
		LIMIT ?
	`, userID, since, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]domain.WhatsAppChatSummary, 0, 16)
	for rows.Next() {
		var s domain.WhatsAppChatSummary
		var fromMe int
		if err := rows.Scan(
			&s.ChatJID, &s.ChatLabel, &s.ChatKind, &s.LastText, &s.LastSender,
			&fromMe, &s.LastAt, &s.MessageCount,
		); err != nil {
			return nil, err
		}
		s.LastFromMe = fromMe != 0
		result = append(result, s)
	}
	return result, rows.Err()
}

// UpdateChatLabels reetiqueta as conversas do usuário (usado para resolver os
// nomes dos chats @lid, que chegam sem pushName).
func (r *WhatsAppConversationRepositorySQLite) UpdateChatLabels(ctx context.Context, userID string, labels map[string]string) (int64, error) {
	if userID == "" || len(labels) == 0 {
		return 0, nil
	}
	var updated int64
	for chatJID, label := range labels {
		if chatJID == "" || label == "" {
			continue
		}
		res, err := r.db.ExecContext(ctx, `
			UPDATE whatsapp_conversation_messages
			SET chat_label = ?
			WHERE user_id = ? AND chat_jid = ? AND chat_label <> ?
		`, label, userID, chatJID, label)
		if err != nil {
			return updated, err
		}
		affected, _ := res.RowsAffected()
		updated += affected
	}
	return updated, nil
}

// CountMessages conta as mensagens arquivadas do usuário dentro da janela de idade.
func (r *WhatsAppConversationRepositorySQLite) CountMessages(ctx context.Context, userID string, since time.Time) (int64, error) {
	if userID == "" {
		return 0, nil
	}
	var total int64
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM whatsapp_conversation_messages
		WHERE user_id = ? AND message_timestamp >= ?
	`, userID, since).Scan(&total)
	if err != nil {
		return 0, err
	}
	return total, nil
}

// GetPendingState devolve o estado de cobrança de uma pendência (nil se nunca cobrada).
func (r *WhatsAppConversationRepositorySQLite) GetPendingState(ctx context.Context, userID, chatJID string) (*domain.WhatsAppPendingState, error) {
	if userID == "" || chatJID == "" {
		return nil, nil
	}
	var st domain.WhatsAppPendingState
	var lastNudged, snoozed, dismissed sql.NullTime
	err := r.db.QueryRowContext(ctx, `
		SELECT user_id, chat_jid, last_nudged_at, snoozed_until, dismissed_at, updated_at
		FROM whatsapp_pending_state
		WHERE user_id = ? AND chat_jid = ?
	`, userID, chatJID).Scan(&st.UserID, &st.ChatJID, &lastNudged, &snoozed, &dismissed, &st.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	if lastNudged.Valid {
		st.LastNudgedAt = &lastNudged.Time
	}
	if snoozed.Valid {
		st.SnoozedUntil = &snoozed.Time
	}
	if dismissed.Valid {
		st.DismissedAt = &dismissed.Time
	}
	return &st, nil
}

// SavePendingState cria ou atualiza o estado de cobrança de uma pendência.
func (r *WhatsAppConversationRepositorySQLite) SavePendingState(ctx context.Context, state *domain.WhatsAppPendingState) error {
	if state == nil || state.UserID == "" || state.ChatJID == "" {
		return errors.New("estado de pendência inválido")
	}
	if state.UpdatedAt.IsZero() {
		state.UpdatedAt = time.Now().UTC()
	}
	return database.WithBusyRetry(4, func() error {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO whatsapp_pending_state
				(user_id, chat_jid, last_nudged_at, snoozed_until, dismissed_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(user_id, chat_jid) DO UPDATE SET
				last_nudged_at = excluded.last_nudged_at,
				snoozed_until  = excluded.snoozed_until,
				dismissed_at   = excluded.dismissed_at,
				updated_at     = excluded.updated_at
		`, state.UserID, state.ChatJID, state.LastNudgedAt, state.SnoozedUntil, state.DismissedAt, state.UpdatedAt)
		return err
	})
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
