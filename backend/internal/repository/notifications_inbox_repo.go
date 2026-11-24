package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// NotificationsInboxRepositorySQLite persiste a central de notificações e preferências no SQLite.
type NotificationsInboxRepositorySQLite struct {
	db *sql.DB
}

// NewNotificationsInboxRepository instancia o repositório da central de notificações.
func NewNotificationsInboxRepository(db *sql.DB) *NotificationsInboxRepositorySQLite {
	return &NotificationsInboxRepositorySQLite{db: db}
}

func normalizeActionsJSON(n *domain.UserNotification) string {
	if strings.TrimSpace(n.ActionsJSON) != "" {
		return n.ActionsJSON
	}
	if len(n.Actions) == 0 {
		return "[]"
	}
	b, err := json.Marshal(n.Actions)
	if err != nil {
		return "[]"
	}
	return string(b)
}

// ComputeGroupKey calcula o grupo temporal dinâmico ("Agora", "Hoje", "Ontem", "Anteriores") no fuso local.
func ComputeGroupKey(createdAt, now time.Time, loc *time.Location) string {
	if loc == nil {
		var err error
		loc, err = time.LoadLocation("America/Sao_Paulo")
		if err != nil {
			loc = time.UTC
		}
	}
	if now.IsZero() {
		now = time.Now()
	}
	localNow := now.In(loc)
	localCreated := createdAt.In(loc)

	diff := localNow.Sub(localCreated)
	if diff <= time.Hour && diff >= -5*time.Minute {
		return "Agora"
	}
	ny, nm, nd := localNow.Date()
	cy, cm, cd := localCreated.Date()
	if ny == cy && nm == cm && nd == cd {
		return "Hoje"
	}
	yesterday := localNow.AddDate(0, 0, -1)
	yy, ym, yd := yesterday.Date()
	if yy == cy && ym == cm && yd == cd {
		return "Ontem"
	}
	return "Anteriores"
}

func normalizeGroupKey(raw string, createdAt time.Time, now time.Time) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "agora":
		return "Agora"
	case "hoje":
		return "Hoje"
	case "ontem":
		return "Ontem"
	case "anteriores":
		return "Anteriores"
	}
	return ComputeGroupKey(createdAt, now, nil)
}

func scanUserNotification(scanner interface{ Scan(dest ...any) error }) (*domain.UserNotification, error) {
	var n domain.UserNotification
	var typ string
	var unreadInt, dismissedInt int
	err := scanner.Scan(
		&n.ID,
		&n.UserID,
		&n.GroupKey,
		&typ,
		&n.SourceDomain,
		&n.SourceID,
		&n.BotID,
		&n.Title,
		&n.Body,
		&n.ActionsJSON,
		&unreadInt,
		&dismissedInt,
		&n.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	n.Type = domain.NotificationType(typ)
	n.IsUnread = unreadInt != 0
	n.IsDismissed = dismissedInt != 0
	n.Actions = []domain.NotificationAction{}
	if strings.TrimSpace(n.ActionsJSON) != "" {
		_ = json.Unmarshal([]byte(n.ActionsJSON), &n.Actions)
		if n.Actions == nil {
			n.Actions = []domain.NotificationAction{}
		}
	}
	return &n, nil
}

// Create insere uma nova notificação na caixa do usuário via DefaultWriterQueue.
func (r *NotificationsInboxRepositorySQLite) Create(ctx context.Context, n *domain.UserNotification) error {
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now().UTC()
	}
	if n.Type == "" {
		n.Type = domain.NotificationTypeInfo
	}
	n.GroupKey = normalizeGroupKey(n.GroupKey, n.CreatedAt, time.Now().UTC())
	actionsJSON := normalizeActionsJSON(n)

	unread := 0
	if n.IsUnread {
		unread = 1
	}
	dismissed := 0
	if n.IsDismissed {
		dismissed = 1
	}

	const q = `
		INSERT INTO user_notifications (
			id, user_id, group_key, type, source_domain, source_id, bot_id,
			title, body, actions_json, is_unread, is_dismissed, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	return ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, q,
			n.ID, n.UserID, n.GroupKey, string(n.Type), n.SourceDomain, n.SourceID, n.BotID,
			n.Title, n.Body, actionsJSON, unread, dismissed, n.CreatedAt,
		)
		return err
	})
}

// UpsertBySource cria ou atualiza atomicamente uma notificação ativa deduplicada por (user_id, source_domain, source_id).
func (r *NotificationsInboxRepositorySQLite) UpsertBySource(ctx context.Context, n *domain.UserNotification) error {
	if strings.TrimSpace(n.SourceDomain) == "" || strings.TrimSpace(n.SourceID) == "" {
		return r.Create(ctx, n)
	}
	if n.ID == "" {
		n.ID = uuid.NewString()
	}
	if n.CreatedAt.IsZero() {
		n.CreatedAt = time.Now().UTC()
	}
	if n.Type == "" {
		n.Type = domain.NotificationTypeInfo
	}
	n.GroupKey = normalizeGroupKey(n.GroupKey, n.CreatedAt, time.Now().UTC())
	actionsJSON := normalizeActionsJSON(n)
	unread := 0
	if n.IsUnread {
		unread = 1
	}

	const q = `
		INSERT INTO user_notifications (
			id, user_id, group_key, type, source_domain, source_id, bot_id,
			title, body, actions_json, is_unread, is_dismissed, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
		ON CONFLICT(user_id, source_domain, source_id) WHERE is_dismissed = 0 AND source_id <> ''
		DO UPDATE SET
			title = excluded.title,
			body = excluded.body,
			actions_json = excluded.actions_json,
			bot_id = excluded.bot_id
	`
	return ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, q,
			n.ID, n.UserID, n.GroupKey, string(n.Type), n.SourceDomain, n.SourceID, n.BotID,
			n.Title, n.Body, actionsJSON, unread, n.CreatedAt,
		)
		return err
	})
}

// GetByID busca uma notificação isolada pelo par (id, user_id).
func (r *NotificationsInboxRepositorySQLite) GetByID(ctx context.Context, id, userID string) (*domain.UserNotification, error) {
	const q = `
		SELECT id, user_id, group_key, type, source_domain, source_id, bot_id,
		       title, body, actions_json, is_unread, is_dismissed, created_at
		FROM user_notifications
		WHERE id = ? AND user_id = ?
	`
	n, err := scanUserNotification(r.db.QueryRowContext(ctx, q, id, userID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrNotificationNotFound
		}
		return nil, err
	}
	return n, nil
}

// ListByUser retorna as notificações filtradas do usuário e os contadores da central.
func (r *NotificationsInboxRepositorySQLite) ListByUser(
	ctx context.Context,
	userID string,
	filter domain.NotificationInboxFilter,
) ([]domain.UserNotification, domain.NotificationInboxCounts, error) {
	var counts domain.NotificationInboxCounts
	_ = r.db.QueryRowContext(ctx, `
		SELECT
			COUNT(*),
			COALESCE(SUM(CASE WHEN type = 'aprovar' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN type = 'alerta' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN type = 'info' THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN is_unread = 1 THEN 1 ELSE 0 END), 0)
		FROM user_notifications
		WHERE user_id = ? AND is_dismissed = 0
	`, userID).Scan(&counts.All, &counts.Approve, &counts.Alert, &counts.Info, &counts.Unread)

	limit := filter.Limit
	if limit <= 0 || limit > 200 {
		limit = 100
	}

	var conds []string
	args := []any{userID}
	conds = append(conds, "user_id = ?")
	if !filter.IncludeDismissed {
		conds = append(conds, "is_dismissed = 0")
	}
	if filter.UnreadOnly {
		conds = append(conds, "is_unread = 1")
	}
	if t := strings.TrimSpace(strings.ToLower(filter.Type)); t != "" && t != "all" {
		conds = append(conds, "type = ?")
		args = append(args, t)
	}
	args = append(args, limit)

	q := fmt.Sprintf(`
		SELECT id, user_id, group_key, type, source_domain, source_id, bot_id,
		       title, body, actions_json, is_unread, is_dismissed, created_at
		FROM user_notifications
		WHERE %s
		ORDER BY is_unread DESC, created_at DESC
		LIMIT ?
	`, strings.Join(conds, " AND "))

	rows, err := r.db.QueryContext(ctx, q, args...)
	if err != nil {
		return nil, counts, err
	}
	defer rows.Close()

	out := make([]domain.UserNotification, 0)
	for rows.Next() {
		n, scanErr := scanUserNotification(rows)
		if scanErr != nil {
			return nil, counts, scanErr
		}
		out = append(out, *n)
	}
	return out, counts, rows.Err()
}

// MarkRead marca uma notificação específica do usuário como lida.
func (r *NotificationsInboxRepositorySQLite) MarkRead(ctx context.Context, id, userID string) error {
	affected, err := ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `
			UPDATE user_notifications SET is_unread = 0 WHERE id = ? AND user_id = ?
		`, id, userID)
	})
	if err != nil {
		return err
	}
	if affected == 0 {
		return domain.ErrNotificationNotFound
	}
	return nil
}

// Dismiss oculta/resolve uma notificação do usuário e a marca como lida.
func (r *NotificationsInboxRepositorySQLite) Dismiss(ctx context.Context, id, userID string) error {
	affected, err := ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `
			UPDATE user_notifications SET is_unread = 0, is_dismissed = 1 WHERE id = ? AND user_id = ?
		`, id, userID)
	})
	if err != nil {
		return err
	}
	if affected == 0 {
		return domain.ErrNotificationNotFound
	}
	return nil
}

// MarkAllRead marca todas as notificações não descartadas do usuário como lidas.
func (r *NotificationsInboxRepositorySQLite) MarkAllRead(ctx context.Context, userID string) (int64, error) {
	return ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `
			UPDATE user_notifications SET is_unread = 0
			WHERE user_id = ? AND is_dismissed = 0 AND is_unread = 1
		`, userID)
	})
}

// GetPreferences retorna as preferências de notificação por categoria do usuário.
func (r *NotificationsInboxRepositorySQLite) GetPreferences(ctx context.Context, userID string) (*domain.NotificationPreferences, error) {
	const q = `
		SELECT user_id, agenda, tarefas, financas, bots, resumo, promo, updated_at
		FROM notification_preferences
		WHERE user_id = ?
	`
	var p domain.NotificationPreferences
	var ag, ta, fi, bo, re, pr int
	err := r.db.QueryRowContext(ctx, q, userID).Scan(
		&p.UserID, &ag, &ta, &fi, &bo, &re, &pr, &p.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.DefaultNotificationPreferences(userID), nil
	}
	if err != nil {
		return nil, err
	}
	p.Agenda = ag != 0
	p.Tarefas = ta != 0
	p.Financas = fi != 0
	p.Bots = bo != 0
	p.Resumo = re != 0
	p.Promo = pr != 0
	return &p, nil
}

// UpsertPreferences persiste as preferências de notificação do usuário via DefaultWriterQueue.
func (r *NotificationsInboxRepositorySQLite) UpsertPreferences(ctx context.Context, p *domain.NotificationPreferences) error {
	p.UpdatedAt = time.Now().UTC()
	b2i := func(b bool) int {
		if b {
			return 1
		}
		return 0
	}
	const q = `
		INSERT INTO notification_preferences (user_id, agenda, tarefas, financas, bots, resumo, promo, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			agenda = excluded.agenda,
			tarefas = excluded.tarefas,
			financas = excluded.financas,
			bots = excluded.bots,
			resumo = excluded.resumo,
			promo = excluded.promo,
			updated_at = excluded.updated_at
	`
	return ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, q,
			p.UserID,
			b2i(p.Agenda),
			b2i(p.Tarefas),
			b2i(p.Financas),
			b2i(p.Bots),
			b2i(p.Resumo),
			b2i(p.Promo),
			p.UpdatedAt,
		)
		return err
	})
}
