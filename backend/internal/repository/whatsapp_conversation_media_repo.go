package repository

import (
	"context"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// SenderNamesByChat devolve o nome de perfil (pushName) mais recente de cada chat.
func (r *WhatsAppConversationRepositorySQLite) SenderNamesByChat(ctx context.Context, userID string, since time.Time) (map[string]string, error) {
	if userID == "" {
		return map[string]string{}, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT chat_jid, sender_name
		FROM (
			SELECT chat_jid, sender_name,
				ROW_NUMBER() OVER (PARTITION BY chat_jid ORDER BY message_timestamp DESC) AS rn
			FROM whatsapp_conversation_messages
			WHERE user_id = ? AND message_timestamp >= ? AND sender_name <> ''
		)
		WHERE rn = 1
	`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]string, 16)
	for rows.Next() {
		var chatJID, senderName string
		if err := rows.Scan(&chatJID, &senderName); err != nil {
			return nil, err
		}
		out[chatJID] = senderName
	}
	return out, rows.Err()
}

// MessageByID busca uma mensagem arquivada pelo id.
//
// É o que permite resolver a mensagem marcada ("responder a esta"): o id vem
// do contextInfo.stanzaId e a mensagem pode ser antiga — ou ser uma imagem/áudio
// cujo conteúdo só existe depois do enriquecimento.
func (r *WhatsAppConversationRepositorySQLite) MessageByID(ctx context.Context, userID, id string) (*domain.WhatsAppConversationMessage, error) {
	if userID == "" || id == "" {
		return nil, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+waConversationColumns+`
		FROM whatsapp_conversation_messages
		WHERE user_id = ? AND id = ?
		LIMIT 1
	`, userID, id)
	if err != nil {
		return nil, err
	}
	messages, err := scanConversationMessages(rows)
	if err != nil {
		return nil, err
	}
	if len(messages) == 0 {
		return nil, nil
	}
	return &messages[0], nil
}

// PendingMedia devolve mensagens com mídia ainda não analisada, mais antigas
// primeiro (o worker de enriquecimento consome nessa ordem: o mais antigo do
// backlog é o que está há mais tempo "invisível" para o Vito).
func (r *WhatsAppConversationRepositorySQLite) PendingMedia(ctx context.Context, userID string, limit int, since time.Time) ([]domain.WhatsAppConversationMessage, error) {
	if userID == "" || limit <= 0 {
		return []domain.WhatsAppConversationMessage{}, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+waConversationColumns+`
		FROM whatsapp_conversation_messages
		WHERE user_id = ?
		  AND media_kind IN ('image', 'audio')
		  AND media_status <> 'done'
		  AND media_payload <> ''
		  AND message_timestamp >= ?
		ORDER BY message_timestamp ASC
		LIMIT ?
	`, userID, since, limit)
	if err != nil {
		return nil, err
	}
	return scanConversationMessages(rows)
}

// MediaStatus conta as mídias do usuário por estado de enriquecimento.
func (r *WhatsAppConversationRepositorySQLite) MediaStatus(ctx context.Context, userID string, since time.Time) (map[string]int64, error) {
	counts := map[string]int64{
		domain.WhatsAppMediaStatusPending: 0,
		domain.WhatsAppMediaStatusDone:    0,
		domain.WhatsAppMediaStatusFailed:  0,
	}
	if userID == "" {
		return counts, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT media_status, COUNT(*)
		FROM whatsapp_conversation_messages
		WHERE user_id = ? AND media_kind IN ('image', 'audio') AND message_timestamp >= ?
		GROUP BY media_status
	`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var status string
		var total int64
		if err := rows.Scan(&status, &total); err != nil {
			return nil, err
		}
		counts[status] = total
	}
	return counts, rows.Err()
}

// UpdateMediaResult grava o resultado do enriquecimento de uma mídia.
func (r *WhatsAppConversationRepositorySQLite) UpdateMediaResult(ctx context.Context, userID, id, status, text string) error {
	if userID == "" || id == "" || status == "" {
		return errors.New("resultado de mídia inválido")
	}
	return database.WithBusyRetry(4, func() error {
		_, err := r.db.ExecContext(ctx, `
			UPDATE whatsapp_conversation_messages
			SET media_status = ?, media_text = ?
			WHERE user_id = ? AND id = ?
		`, status, text, userID, id)
		return err
	})
}

// SearchMessages busca no histórico do WhatsApp por conteúdo (full-text).
//
// Cobre o texto da mensagem E a descrição da mídia (media_text) — é o que
// responde a "aquela mensagem da Ana sobre o contrato" e "aquela foto do recibo".
func (r *WhatsAppConversationRepositorySQLite) SearchMessages(ctx context.Context, userID, query string, limit int) ([]domain.WhatsAppConversationMessage, error) {
	if userID == "" || limit <= 0 {
		return []domain.WhatsAppConversationMessage{}, nil
	}
	match := ftsQuery(query)
	if match == "" {
		return []domain.WhatsAppConversationMessage{}, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+waConversationColumnsM+`
		FROM whatsapp_messages_fts
		JOIN whatsapp_conversation_messages m ON m.rowid = whatsapp_messages_fts.rowid
		WHERE whatsapp_messages_fts MATCH ? AND m.user_id = ?
		ORDER BY bm25(whatsapp_messages_fts)
		LIMIT ?
	`, match, userID, limit)
	if err != nil {
		return nil, err
	}
	return scanConversationMessages(rows)
}
