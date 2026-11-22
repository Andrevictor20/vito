package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// SyncBotPendingNotifications sincroniza confirmações suspensas de bots com a caixa de notificações.
func (r *NotificationsInboxRepositorySQLite) SyncBotPendingNotifications(ctx context.Context, userID string) error {
	_ = ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, `
			UPDATE user_notifications
			SET is_dismissed = 1, is_unread = 0
			WHERE user_id = ?
			  AND source_domain = 'bots'
			  AND is_dismissed = 0
			  AND source_id != ''
			  AND source_id IN (
				SELECT id FROM pending_confirmations WHERE user_id = ? AND status != 'SUSPENDED'
			  )
		`, userID, userID)
		return err
	})

	rows, err := r.db.QueryContext(ctx, `
		SELECT p.id, p.thread_id, p.toolset_name, p.operation, COALESCE(p.preview_json, '{}'),
		       p.created_at, COALESCE(t.id, ''), COALESCE(t.title, '')
		FROM pending_confirmations p
		LEFT JOIN triggers t
		  ON t.user_id = p.user_id
		 AND (t.thread_id = p.thread_id OR 'bot_' || t.id = p.thread_id)
		WHERE p.user_id = ?
		  AND p.status = 'SUSPENDED'
		  AND (p.channel = 'bot' OR p.thread_id LIKE 'bot_%' OR t.id IS NOT NULL)
	`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	type botPend struct {
		confID, threadID, toolset, op, previewJSON, botID, botTitle string
		createdAt                                                   time.Time
	}
	var items []botPend
	for rows.Next() {
		var it botPend
		if scanErr := rows.Scan(&it.confID, &it.threadID, &it.toolset, &it.op, &it.previewJSON, &it.createdAt, &it.botID, &it.botTitle); scanErr == nil {
			items = append(items, it)
		}
	}
	for _, it := range items {
		botID := it.botID
		if botID == "" && strings.HasPrefix(it.threadID, "bot_") {
			botID = strings.TrimPrefix(it.threadID, "bot_")
		}
		title := strings.TrimSpace(it.botTitle)
		if title == "" {
			title = "Aprovação de Bot"
		}
		body := fmt.Sprintf("Ação pendente: %s (%s)", it.op, it.toolset)
		var preview map[string]any
		if json.Unmarshal([]byte(it.previewJSON), &preview) == nil {
			if s, ok := preview["summary"].(string); ok && strings.TrimSpace(s) != "" {
				body = strings.TrimSpace(s)
			}
		}
		var exists int
		_ = r.db.QueryRowContext(ctx, `
			SELECT COUNT(1) FROM user_notifications
			WHERE user_id = ? AND source_domain = 'bots' AND source_id = ?
		`, userID, it.confID).Scan(&exists)
		if exists > 0 {
			continue
		}
		_ = r.Create(ctx, &domain.UserNotification{
			UserID:       userID,
			GroupKey:     "Agora",
			Type:         domain.NotificationTypeApprove,
			SourceDomain: "bots",
			SourceID:     it.confID,
			BotID:        botID,
			Title:        title,
			Body:         body,
			Actions: []domain.NotificationAction{
				{ID: "deny", Label: "Recusar", Style: "secondary"},
				{ID: "approve", Label: "Aprovar", Style: "primary"},
			},
			IsUnread:  true,
			CreatedAt: it.createdAt,
		})
	}
	return nil
}

// SyncOverdueTodoNotifications sincroniza alerta resumido de tarefas atrasadas se houver pendências vencidas.
func (r *NotificationsInboxRepositorySQLite) SyncOverdueTodoNotifications(ctx context.Context, userID string, now time.Time) error {
	var overdueCount int
	if err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(1)
		FROM todos
		WHERE user_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < ?
	`, userID, now.UTC()).Scan(&overdueCount); err != nil {
		return nil
	}

	if overdueCount == 0 {
		_ = ExecuteQueuedWrite(ctx, func() error {
			_, err := r.db.ExecContext(ctx, `
				UPDATE user_notifications
				SET is_dismissed = 1, is_unread = 0
				WHERE user_id = ? AND source_domain = 'tarefas' AND source_id = 'overdue_summary' AND is_dismissed = 0
			`, userID)
			return err
		})
		return nil
	}

	title := fmt.Sprintf("%d tarefas atrasadas", overdueCount)
	if overdueCount == 1 {
		title = "1 tarefa atrasada"
	}
	var existingID string
	var dismissed int
	err := r.db.QueryRowContext(ctx, `
		SELECT id, is_dismissed
		FROM user_notifications
		WHERE user_id = ? AND source_domain = 'tarefas' AND source_id = 'overdue_summary'
		  AND date(created_at) = date(?)
		ORDER BY created_at DESC
		LIMIT 1
	`, userID, now.UTC()).Scan(&existingID, &dismissed)
	if err == nil && existingID != "" {
		if dismissed == 0 {
			_ = ExecuteQueuedWrite(ctx, func() error {
				_, execErr := r.db.ExecContext(ctx, `
					UPDATE user_notifications SET title = ? WHERE id = ? AND user_id = ?
				`, title, existingID, userID)
				return execErr
			})
		}
		return nil
	}

	return r.Create(ctx, &domain.UserNotification{
		UserID:       userID,
		GroupKey:     "Hoje",
		Type:         domain.NotificationTypeAlert,
		SourceDomain: "tarefas",
		SourceID:     "overdue_summary",
		Title:        title,
		Body:         "Posso reagendar tudo para hoje em um toque.",
		Actions: []domain.NotificationAction{
			{ID: "view_tasks", Label: "Ver tarefas", Style: "secondary"},
			{ID: "reschedule_today", Label: "Reagendar hoje", Style: "primary"},
		},
		IsUnread:  true,
		CreatedAt: now.UTC(),
	})
}

// RescheduleOverdueTodosToday move tarefas pendentes vencidas do usuário para o fim do dia atual.
func (r *NotificationsInboxRepositorySQLite) RescheduleOverdueTodosToday(ctx context.Context, userID string, now time.Time) (int64, error) {
	loc := now.Location()
	endOfToday := time.Date(now.Year(), now.Month(), now.Day(), 18, 0, 0, 0, loc).UTC()
	return ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `
			UPDATE todos
			SET due_date = ?, updated_at = ?
			WHERE user_id = ? AND status = 'pending' AND due_date IS NOT NULL AND due_date < ?
		`, endOfToday, now.UTC(), userID, now.UTC())
	})
}
