package repository

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// SenderNamesByChat devolve o nome de perfil (pushName) mais recente de cada chat.
// SenderNamesByChat devolve o nome de PERFIL (pushName) mais recente de cada chat.
//
// IMPORTANTE: Considera apenas mensagens RECEBIDAS (from_me = false), pois o
// pushName da mensagem é o nome do REMETENTE. Se considerarmos mensagens
// enviadas pelo próprio usuário (from_me = true), o sender_name será o nome
// do próprio usuário ("André Victor"), não o nome do contato ("Bella").
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
			WHERE user_id = ? AND message_timestamp >= ? AND sender_name <> '' AND from_me = false
				AND chat_jid NOT LIKE '%@broadcast'
				AND chat_jid NOT LIKE '%@newsletter'
				AND chat_kind NOT IN ('broadcast', 'newsletter')
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

// SaveAlias grava um apelido aprendido pelo dono para um contato.
func (r *WhatsAppConversationRepositorySQLite) SaveAlias(ctx context.Context, userID, chatJID, alias string) error {
	if userID == "" || chatJID == "" || strings.TrimSpace(alias) == "" {
		return errors.New("apelido inválido")
	}
	return database.WithBusyRetry(4, func() error {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO whatsapp_contact_aliases (user_id, chat_jid, alias, created_at)
			VALUES (?, ?, ?, ?)
			ON CONFLICT(user_id, chat_jid, alias) DO NOTHING
		`, userID, chatJID, strings.TrimSpace(alias), time.Now().UTC())
		return err
	})
}

// AliasesByName devolve os JIDs que respondem a um apelido aprendido.
func (r *WhatsAppConversationRepositorySQLite) AliasesByName(ctx context.Context, userID, alias string) ([]string, error) {
	if userID == "" || strings.TrimSpace(alias) == "" {
		return nil, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT chat_jid FROM whatsapp_contact_aliases
		WHERE user_id = ? AND LOWER(alias) = LOWER(?)
	`, userID, strings.TrimSpace(alias))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]string, 0, 2)
	for rows.Next() {
		var chatJID string
		if err := rows.Scan(&chatJID); err != nil {
			return nil, err
		}
		out = append(out, chatJID)
	}
	return out, rows.Err()
}

// DeleteAlias remove um apelido específico gravado para um chat.
func (r *WhatsAppConversationRepositorySQLite) DeleteAlias(ctx context.Context, userID, chatJID, alias string) error {
	if userID == "" || chatJID == "" || strings.TrimSpace(alias) == "" {
		return nil
	}
	return database.WithBusyRetry(4, func() error {
		_, err := r.db.ExecContext(ctx, `
			DELETE FROM whatsapp_contact_aliases
			WHERE user_id = ? AND chat_jid = ? AND LOWER(alias) = LOWER(?)
		`, userID, chatJID, strings.TrimSpace(alias))
		return err
	})
}

// DeleteAliasesByName remove todos os apelidos gravados com determinado nome.
func (r *WhatsAppConversationRepositorySQLite) DeleteAliasesByName(ctx context.Context, userID, alias string) error {
	if userID == "" || strings.TrimSpace(alias) == "" {
		return nil
	}
	return database.WithBusyRetry(4, func() error {
		_, err := r.db.ExecContext(ctx, `
			DELETE FROM whatsapp_contact_aliases
			WHERE user_id = ? AND LOWER(alias) = LOWER(?)
		`, userID, strings.TrimSpace(alias))
		return err
	})
}

// phoneDigits extrai apenas os dígitos de um telefone.
func phoneDigits(raw string) string {
	digits := make([]rune, 0, len(raw))
	for _, r := range raw {
		if r >= '0' && r <= '9' {
			digits = append(digits, r)
		}
	}
	return string(digits)
}

// canonicalBRPhone remove o 9º dígito de um celular brasileiro (DDI 55 + DDD + 9 + 8).
func canonicalBRPhone(digits string) string {
	if len(digits) == 13 && strings.HasPrefix(digits, "55") {
		return digits[:4] + digits[5:]
	}
	return digits
}

// SaveSavedNames persiste o nome salvo no rótulo das conversas cujo número bate.
//
// O cache de nomes vive em RAM (e se perde a cada deploy); gravar o rótulo no
// shadow inbox faz o nome salvo sobreviver ao reinício — e o backfill deixa de
// sobrescrevê-lo (o Relabel só troca rótulos vazios/genéricos).
func (r *WhatsAppConversationRepositorySQLite) SaveSavedNames(ctx context.Context, userID string, names map[string]string) (int64, error) {
	if userID == "" || len(names) == 0 {
		return 0, nil
	}
	// Telefone normalizado (só dígitos, com e sem o 9º dígito) -> nome salvo.
	byNumber := make(map[string]string, len(names)*2)
	for number, name := range names {
		digits := phoneDigits(number)
		if digits == "" || strings.TrimSpace(name) == "" {
			continue
		}
		byNumber[digits] = name
		byNumber[canonicalBRPhone(digits)] = name
	}
	if len(byNumber) == 0 {
		return 0, nil
	}

	rows, err := r.db.QueryContext(ctx, `
		SELECT chat_jid FROM whatsapp_conversation_messages
		WHERE user_id = ? AND chat_jid LIKE '%@s.whatsapp.net'
	`, userID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var updated int64
	for rows.Next() {
		var chatJID string
		if err := rows.Scan(&chatJID); err != nil {
			return updated, err
		}
		digits := strings.TrimSuffix(chatJID, "@s.whatsapp.net")
		name, ok := byNumber[digits]
		if !ok || name == "" {
			continue
		}
		if err := database.WithBusyRetry(4, func() error {
			_, execErr := r.db.ExecContext(ctx, `
				UPDATE whatsapp_conversation_messages SET chat_label = ?
				WHERE user_id = ? AND chat_jid = ?
			`, name, userID, chatJID)
			return execErr
		}); err != nil {
			return updated, err
		}
		updated++
	}
	return updated, rows.Err()
}

// ChatLabels devolve o rótulo atual de cada conversa (JID -> chat_label).
func (r *WhatsAppConversationRepositorySQLite) ChatLabels(ctx context.Context, userID string) (map[string]string, error) {
	if userID == "" {
		return map[string]string{}, nil
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT chat_jid, chat_label FROM whatsapp_conversation_messages
		WHERE user_id = ?
		GROUP BY chat_jid
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make(map[string]string, 16)
	for rows.Next() {
		var chatJID, label string
		if err := rows.Scan(&chatJID, &label); err != nil {
			return nil, err
		}
		out[chatJID] = label
	}
	return out, rows.Err()
}
