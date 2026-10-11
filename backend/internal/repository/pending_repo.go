package repository

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// PendingRepositorySQLite implementa domain.PendingRepository com SQLite.
type PendingRepositorySQLite struct {
	db *sql.DB
}

// NewPendingRepository cria uma nova instância de PendingRepositorySQLite.
func NewPendingRepository(db *sql.DB) *PendingRepositorySQLite {
	return &PendingRepositorySQLite{db: db}
}

func (r *PendingRepositorySQLite) Create(item *domain.PendingItem) error {
	query := `
		INSERT INTO pending_items (
			id, user_id, title, description, category, status, scheduled_date, nudge_sent_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(
		query,
		item.ID,
		item.UserID,
		item.Title,
		item.Description,
		item.Category,
		item.Status,
		item.ScheduledDate,
		item.NudgeSentAt,
		item.CreatedAt,
		item.UpdatedAt,
	)
	return err
}

func (r *PendingRepositorySQLite) GetByID(id, userID string) (*domain.PendingItem, error) {
	query := `
		SELECT id, user_id, title, COALESCE(description, ''), category, status, COALESCE(scheduled_date, ''), nudge_sent_at, created_at, updated_at
		FROM pending_items
		WHERE id = ? AND user_id = ?
	`
	var item domain.PendingItem
	err := r.db.QueryRow(query, id, userID).Scan(
		&item.ID,
		&item.UserID,
		&item.Title,
		&item.Description,
		&item.Category,
		&item.Status,
		&item.ScheduledDate,
		&item.NudgeSentAt,
		&item.CreatedAt,
		&item.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrPendingItemNotFound
		}
		return nil, err
	}
	return &item, nil
}

func (r *PendingRepositorySQLite) ListByUser(userID string, status *domain.PendingStatus, category string) ([]domain.PendingItem, error) {
	var conditions []string
	var args []interface{}

	conditions = append(conditions, "user_id = ?")
	args = append(args, userID)

	if status != nil && *status != "" {
		conditions = append(conditions, "status = ?")
		args = append(args, string(*status))
	}

	if category != "" && !strings.EqualFold(category, "todas") && !strings.EqualFold(category, "all") {
		conditions = append(conditions, "LOWER(category) = LOWER(?)")
		args = append(args, category)
	}

	query := fmt.Sprintf(`
		SELECT id, user_id, title, COALESCE(description, ''), category, status, COALESCE(scheduled_date, ''), nudge_sent_at, created_at, updated_at
		FROM pending_items
		WHERE %s
		ORDER BY created_at DESC
	`, strings.Join(conditions, " AND "))

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.PendingItem
	for rows.Next() {
		var item domain.PendingItem
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Title,
			&item.Description,
			&item.Category,
			&item.Status,
			&item.ScheduledDate,
			&item.NudgeSentAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *PendingRepositorySQLite) Update(item *domain.PendingItem) error {
	query := `
		UPDATE pending_items
		SET title = ?, description = ?, category = ?, status = ?, scheduled_date = ?, nudge_sent_at = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`
	item.UpdatedAt = time.Now().UTC()
	res, err := r.db.Exec(
		query,
		item.Title,
		item.Description,
		item.Category,
		item.Status,
		item.ScheduledDate,
		item.NudgeSentAt,
		item.UpdatedAt,
		item.ID,
		item.UserID,
	)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return domain.ErrPendingItemNotFound
	}
	return nil
}

func (r *PendingRepositorySQLite) Delete(id, userID string) error {
	query := `DELETE FROM pending_items WHERE id = ? AND user_id = ?`
	res, err := r.db.Exec(query, id, userID)
	if err != nil {
		return err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return domain.ErrPendingItemNotFound
	}
	return nil
}

func (r *PendingRepositorySQLite) ListUnscheduledDueForNudge(cutoff time.Time) ([]domain.PendingItem, error) {
	query := `
		SELECT id, user_id, title, COALESCE(description, ''), category, status, COALESCE(scheduled_date, ''), nudge_sent_at, created_at, updated_at
		FROM pending_items
		WHERE status = 'inbox' 
		  AND created_at <= ?
		  AND (nudge_sent_at IS NULL OR nudge_sent_at <= ?)
		ORDER BY created_at ASC
	`
	// cutoff define que foi criada há > 24h e não recebeu nudge hoje
	todayStart := time.Now().UTC().Truncate(24 * time.Hour)
	rows, err := r.db.Query(query, cutoff, todayStart)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []domain.PendingItem
	for rows.Next() {
		var item domain.PendingItem
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.Title,
			&item.Description,
			&item.Category,
			&item.Status,
			&item.ScheduledDate,
			&item.NudgeSentAt,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return items, rows.Err()
}

func (r *PendingRepositorySQLite) MarkNudgeSent(id string, sentAt time.Time) error {
	query := `UPDATE pending_items SET nudge_sent_at = ? WHERE id = ?`
	_, err := r.db.Exec(query, sentAt, id)
	return err
}
