package repository

import "github.com/andrevmp/vito/backend/internal/domain"

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

func (r *TriggerRepositorySQLite) DeleteLog(id, userID string) error {
	query := `
		DELETE FROM trigger_logs
		WHERE id = ? AND trigger_id IN (SELECT id FROM triggers WHERE user_id = ?)
	`
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

func (r *TriggerRepositorySQLite) ClearLogs(triggerID, userID string) error {
	query := `
		DELETE FROM trigger_logs
		WHERE trigger_id = ? AND trigger_id IN (SELECT id FROM triggers WHERE user_id = ?)
	`
	_, err := r.db.Exec(query, triggerID, userID)
	return err
}

// ListUnreadLogsByTriggerIDs busca logs não lidos de múltiplos radares em uma única query IN (elimina N+1).
func (r *TriggerRepositorySQLite) ListUnreadLogsByTriggerIDs(triggerIDs []string) (map[string][]domain.TriggerLog, error) {
	result := make(map[string][]domain.TriggerLog, len(triggerIDs))
	if len(triggerIDs) == 0 {
		return result, nil
	}
	placeholders := ""
	args := make([]interface{}, len(triggerIDs))
	for i, id := range triggerIDs {
		if i > 0 {
			placeholders += ","
		}
		placeholders += "?"
		args[i] = id
	}
	query := `
		SELECT id, trigger_id, triggered_at, message, COALESCE(payload, ''), is_read
		FROM trigger_logs
		WHERE is_read = 0 AND trigger_id IN (` + placeholders + `)
		ORDER BY triggered_at DESC
	`
	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var l domain.TriggerLog
		if err := rows.Scan(&l.ID, &l.TriggerID, &l.TriggeredAt, &l.Message, &l.Payload, &l.IsRead); err != nil {
			return nil, err
		}
		result[l.TriggerID] = append(result[l.TriggerID], l)
	}
	return result, rows.Err()
}
