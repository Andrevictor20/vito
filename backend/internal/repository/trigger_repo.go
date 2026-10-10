package repository

import (
	"database/sql"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// TriggerRepositorySQLite implementa domain.TriggerRepository usando SQLite.
type TriggerRepositorySQLite struct {
	db *sql.DB
}

// NewTriggerRepository instancia um novo repositório de disparadores SQLite.
func NewTriggerRepository(db *sql.DB) *TriggerRepositorySQLite {
	return &TriggerRepositorySQLite{db: db}
}

func (r *TriggerRepositorySQLite) Create(t *domain.Trigger) error {
	query := `
		INSERT INTO triggers (
			id, user_id, title, category, query, condition_type,
			target_value, current_value, status, frequency,
			scheduled_time, days_of_week, last_run_status,
			last_checked_at, next_check_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(
		query,
		t.ID, t.UserID, t.Title, string(t.Category), t.Query, string(t.ConditionType),
		t.TargetValue, t.CurrentValue, string(t.Status), string(t.Frequency),
		t.ScheduledTime, t.DaysOfWeek, t.LastRunStatus,
		t.LastCheckedAt, t.NextCheckAt, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

func (r *TriggerRepositorySQLite) GetByID(id, userID string) (*domain.Trigger, error) {
	query := `
		SELECT
			id, user_id, title, category, query, condition_type,
			target_value, current_value, status, frequency,
			COALESCE(scheduled_time, ''), COALESCE(days_of_week, 'DAILY'), COALESCE(last_run_status, ''),
			last_checked_at, next_check_at, created_at, updated_at
		FROM triggers
		WHERE id = ? AND user_id = ?
	`
	var t domain.Trigger
	var lastChecked, nextCheck sql.NullTime
	var cat, cond, status, freq string

	err := r.db.QueryRow(query, id, userID).Scan(
		&t.ID, &t.UserID, &t.Title, &cat, &t.Query, &cond,
		&t.TargetValue, &t.CurrentValue, &status, &freq,
		&t.ScheduledTime, &t.DaysOfWeek, &t.LastRunStatus,
		&lastChecked, &nextCheck, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrTriggerNotFound
		}
		return nil, err
	}

	t.Category = domain.TriggerCategory(cat)
	t.ConditionType = domain.TriggerConditionType(cond)
	t.Status = domain.TriggerStatus(status)
	t.Frequency = domain.TriggerFrequency(freq)

	if lastChecked.Valid {
		t.LastCheckedAt = &lastChecked.Time
	}
	if nextCheck.Valid {
		t.NextCheckAt = &nextCheck.Time
	}

	return &t, nil
}

func (r *TriggerRepositorySQLite) ListByUser(userID string, category domain.TriggerCategory, status domain.TriggerStatus) ([]domain.Trigger, error) {
	query := `
		SELECT
			id, user_id, title, category, query, condition_type,
			target_value, current_value, status, frequency,
			COALESCE(scheduled_time, ''), COALESCE(days_of_week, 'DAILY'), COALESCE(last_run_status, ''),
			last_checked_at, next_check_at, created_at, updated_at
		FROM triggers
		WHERE user_id = ?
	`
	args := []interface{}{userID}

	if category != "" {
		query += " AND category = ?"
		args = append(args, string(category))
	}
	if status != "" {
		query += " AND status = ?"
		args = append(args, string(status))
	}

	query += " ORDER BY created_at DESC"

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var triggers []domain.Trigger
	for rows.Next() {
		var t domain.Trigger
		var lastChecked, nextCheck sql.NullTime
		var cat, cond, st, freq string

		if err := rows.Scan(
			&t.ID, &t.UserID, &t.Title, &cat, &t.Query, &cond,
			&t.TargetValue, &t.CurrentValue, &st, &freq,
			&t.ScheduledTime, &t.DaysOfWeek, &t.LastRunStatus,
			&lastChecked, &nextCheck, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}

		t.Category = domain.TriggerCategory(cat)
		t.ConditionType = domain.TriggerConditionType(cond)
		t.Status = domain.TriggerStatus(st)
		t.Frequency = domain.TriggerFrequency(freq)

		if lastChecked.Valid {
			t.LastCheckedAt = &lastChecked.Time
		}
		if nextCheck.Valid {
			t.NextCheckAt = &nextCheck.Time
		}

		triggers = append(triggers, t)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return triggers, nil
}

func (r *TriggerRepositorySQLite) ListActive() ([]domain.Trigger, error) {
	query := `
		SELECT
			id, user_id, title, category, query, condition_type,
			target_value, current_value, status, frequency,
			COALESCE(scheduled_time, ''), COALESCE(days_of_week, 'DAILY'), COALESCE(last_run_status, ''),
			last_checked_at, next_check_at, created_at, updated_at
		FROM triggers
		WHERE status = 'active'
		ORDER BY next_check_at ASC
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var triggers []domain.Trigger
	for rows.Next() {
		var t domain.Trigger
		var lastChecked, nextCheck sql.NullTime
		var cat, cond, st, freq string

		if err := rows.Scan(
			&t.ID, &t.UserID, &t.Title, &cat, &t.Query, &cond,
			&t.TargetValue, &t.CurrentValue, &st, &freq,
			&t.ScheduledTime, &t.DaysOfWeek, &t.LastRunStatus,
			&lastChecked, &nextCheck, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}

		t.Category = domain.TriggerCategory(cat)
		t.ConditionType = domain.TriggerConditionType(cond)
		t.Status = domain.TriggerStatus(st)
		t.Frequency = domain.TriggerFrequency(freq)

		if lastChecked.Valid {
			t.LastCheckedAt = &lastChecked.Time
		}
		if nextCheck.Valid {
			t.NextCheckAt = &nextCheck.Time
		}

		triggers = append(triggers, t)
	}

	return triggers, rows.Err()
}

func (r *TriggerRepositorySQLite) ListDueTriggers(now time.Time) ([]domain.Trigger, error) {
	query := `
		SELECT
			id, user_id, title, category, query, condition_type,
			target_value, current_value, status, frequency,
			COALESCE(scheduled_time, ''), COALESCE(days_of_week, 'DAILY'), COALESCE(last_run_status, ''),
			last_checked_at, next_check_at, created_at, updated_at
		FROM triggers
		WHERE status = 'active'
		  AND (next_check_at IS NULL OR next_check_at <= ?)
		ORDER BY next_check_at ASC
	`
	rows, err := r.db.Query(query, now.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var triggers []domain.Trigger
	for rows.Next() {
		var t domain.Trigger
		var lastChecked, nextCheck sql.NullTime
		var cat, cond, st, freq string

		if err := rows.Scan(
			&t.ID, &t.UserID, &t.Title, &cat, &t.Query, &cond,
			&t.TargetValue, &t.CurrentValue, &st, &freq,
			&t.ScheduledTime, &t.DaysOfWeek, &t.LastRunStatus,
			&lastChecked, &nextCheck, &t.CreatedAt, &t.UpdatedAt,
		); err != nil {
			return nil, err
		}

		t.Category = domain.TriggerCategory(cat)
		t.ConditionType = domain.TriggerConditionType(cond)
		t.Status = domain.TriggerStatus(st)
		t.Frequency = domain.TriggerFrequency(freq)

		if lastChecked.Valid {
			t.LastCheckedAt = &lastChecked.Time
		}
		if nextCheck.Valid {
			t.NextCheckAt = &nextCheck.Time
		}

		triggers = append(triggers, t)
	}

	return triggers, rows.Err()
}

func (r *TriggerRepositorySQLite) Update(t *domain.Trigger) error {
	query := `
		UPDATE triggers
		SET title = ?, category = ?, query = ?, condition_type = ?,
		    target_value = ?, frequency = ?, scheduled_time = ?, days_of_week = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`
	res, err := r.db.Exec(
		query,
		t.Title, string(t.Category), t.Query, string(t.ConditionType),
		t.TargetValue, string(t.Frequency), t.ScheduledTime, t.DaysOfWeek, t.UpdatedAt,
		t.ID, t.UserID,
	)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrTriggerNotFound
	}
	return nil
}

func (r *TriggerRepositorySQLite) UpdateStatus(id, userID string, status domain.TriggerStatus) error {
	query := `
		UPDATE triggers
		SET status = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`
	res, err := r.db.Exec(query, string(status), time.Now().UTC(), id, userID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrTriggerNotFound
	}
	return nil
}

func (r *TriggerRepositorySQLite) UpdateEvaluation(id string, currentValue string, status domain.TriggerStatus, lastChecked time.Time, nextCheck *time.Time) error {
	query := `
		UPDATE triggers
		SET current_value = ?, status = ?, last_checked_at = ?, next_check_at = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.db.Exec(query, currentValue, string(status), lastChecked, nextCheck, time.Now().UTC(), id)
	return err
}

func (r *TriggerRepositorySQLite) UpdateRunResult(id string, currentValue string, status domain.TriggerStatus, lastRunStatus string, lastChecked time.Time, nextCheck *time.Time) error {
	query := `
		UPDATE triggers
		SET current_value = ?, status = ?, last_run_status = ?, last_checked_at = ?, next_check_at = ?, updated_at = ?
		WHERE id = ?
	`
	_, err := r.db.Exec(query, currentValue, string(status), lastRunStatus, lastChecked, nextCheck, time.Now().UTC(), id)
	return err
}

func (r *TriggerRepositorySQLite) Delete(id, userID string) error {
	query := `DELETE FROM triggers WHERE id = ? AND user_id = ?`
	res, err := r.db.Exec(query, id, userID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrTriggerNotFound
	}
	return nil
}

func (r *TriggerRepositorySQLite) CreateLog(log *domain.TriggerLog) error {
	query := `
		INSERT INTO trigger_logs (id, trigger_id, triggered_at, message, payload, is_read)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(query, log.ID, log.TriggerID, log.TriggeredAt, log.Message, log.Payload, log.IsRead)
	return err
}

func (r *TriggerRepositorySQLite) ListLogsByTrigger(triggerID string) ([]domain.TriggerLog, error) {
	query := `
		SELECT id, trigger_id, triggered_at, message, COALESCE(payload, ''), is_read
		FROM trigger_logs
		WHERE trigger_id = ?
		ORDER BY triggered_at DESC
	`
	rows, err := r.db.Query(query, triggerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []domain.TriggerLog
	for rows.Next() {
		var l domain.TriggerLog
		if err := rows.Scan(&l.ID, &l.TriggerID, &l.TriggeredAt, &l.Message, &l.Payload, &l.IsRead); err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}

	return logs, rows.Err()
}
