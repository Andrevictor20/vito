package repository

import (
	"database/sql"
	"encoding/json"
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

const triggerSelectColumns = `
	id, user_id, title, category, query,
	COALESCE(user_intent, ''), COALESCE(search_keywords, ''),
	COALESCE(search_config_json, '{}'), COALESCE(seen_fingerprints_json, '[]'), last_metric_value,
	condition_type,
	target_value, current_value, status, frequency,
	COALESCE(scheduled_time, ''), COALESCE(days_of_week, 'DAILY'), COALESCE(last_run_status, ''),
	COALESCE(last_error, ''),
	last_checked_at, next_check_at, created_at, updated_at
`

func scanTrigger(scanner interface{ Scan(dest ...interface{}) error }) (*domain.Trigger, error) {
	var t domain.Trigger
	var lastChecked, nextCheck sql.NullTime
	var lastMetricVal sql.NullFloat64
	var cat, cond, status, freq string

	err := scanner.Scan(
		&t.ID, &t.UserID, &t.Title, &cat, &t.Query, &t.UserIntent, &t.SearchKeywords,
		&t.SearchConfigJSON, &t.SeenFingerprintsJSON, &lastMetricVal,
		&cond,
		&t.TargetValue, &t.CurrentValue, &status, &freq,
		&t.ScheduledTime, &t.DaysOfWeek, &t.LastRunStatus, &t.LastError,
		&lastChecked, &nextCheck, &t.CreatedAt, &t.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	t.Category = domain.TriggerCategory(cat)
	t.ConditionType = domain.TriggerConditionType(cond)
	t.Status = domain.TriggerStatus(status)
	t.Frequency = domain.TriggerFrequency(freq)

	if lastMetricVal.Valid {
		t.LastMetricValue = &lastMetricVal.Float64
	}
	if lastChecked.Valid {
		t.LastCheckedAt = &lastChecked.Time
	}
	if nextCheck.Valid {
		t.NextCheckAt = &nextCheck.Time
	}

	return &t, nil
}

func (r *TriggerRepositorySQLite) Create(t *domain.Trigger) error {
	searchConfig := t.SearchConfigJSON
	if searchConfig == "" {
		searchConfig = "{}"
	}
	seenFingerprints := t.SeenFingerprintsJSON
	if seenFingerprints == "" {
		seenFingerprints = "[]"
	}
	var lastMetricVal sql.NullFloat64
	if t.LastMetricValue != nil {
		lastMetricVal = sql.NullFloat64{Float64: *t.LastMetricValue, Valid: true}
	}

	query := `
		INSERT INTO triggers (
			id, user_id, title, category, query, user_intent, search_keywords,
			search_config_json, seen_fingerprints_json, last_metric_value,
			condition_type, target_value, current_value, status, frequency,
			scheduled_time, days_of_week, last_run_status,
			last_checked_at, next_check_at, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := r.db.Exec(
		query,
		t.ID, t.UserID, t.Title, string(t.Category), t.Query, t.UserIntent, t.SearchKeywords,
		searchConfig, seenFingerprints, lastMetricVal,
		string(t.ConditionType), t.TargetValue, t.CurrentValue, string(t.Status), string(t.Frequency),
		t.ScheduledTime, t.DaysOfWeek, t.LastRunStatus,
		t.LastCheckedAt, t.NextCheckAt, t.CreatedAt, t.UpdatedAt,
	)
	return err
}

func (r *TriggerRepositorySQLite) GetByID(id, userID string) (*domain.Trigger, error) {
	query := "SELECT " + triggerSelectColumns + " FROM triggers WHERE id = ? AND user_id = ?"
	t, err := scanTrigger(r.db.QueryRow(query, id, userID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrTriggerNotFound
		}
		return nil, err
	}
	return t, nil
}

func (r *TriggerRepositorySQLite) ListByUser(userID string, category domain.TriggerCategory, status domain.TriggerStatus) ([]domain.Trigger, error) {
	query := "SELECT " + triggerSelectColumns + " FROM triggers WHERE user_id = ?"
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
		t, err := scanTrigger(rows)
		if err != nil {
			return nil, err
		}
		triggers = append(triggers, *t)
	}

	return triggers, rows.Err()
}

func (r *TriggerRepositorySQLite) ListActive() ([]domain.Trigger, error) {
	query := "SELECT " + triggerSelectColumns + " FROM triggers WHERE status = 'active' ORDER BY next_check_at ASC"
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var triggers []domain.Trigger
	for rows.Next() {
		t, err := scanTrigger(rows)
		if err != nil {
			return nil, err
		}
		triggers = append(triggers, *t)
	}

	return triggers, rows.Err()
}

func (r *TriggerRepositorySQLite) ListDueTriggers(now time.Time) ([]domain.Trigger, error) {
	query := "SELECT " + triggerSelectColumns + " FROM triggers WHERE status = 'active' AND (next_check_at IS NULL OR next_check_at <= ?) ORDER BY next_check_at ASC"
	rows, err := r.db.Query(query, now.UTC())
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var triggers []domain.Trigger
	for rows.Next() {
		t, err := scanTrigger(rows)
		if err != nil {
			return nil, err
		}
		triggers = append(triggers, *t)
	}

	return triggers, rows.Err()
}

func (r *TriggerRepositorySQLite) Update(t *domain.Trigger) error {
	searchConfig := t.SearchConfigJSON
	if searchConfig == "" {
		searchConfig = "{}"
	}
	query := `
		UPDATE triggers
		SET title = ?, category = ?, query = ?, user_intent = ?, search_keywords = ?,
		    search_config_json = ?, condition_type = ?,
		    target_value = ?, frequency = ?, scheduled_time = ?, days_of_week = ?, updated_at = ?
		WHERE id = ? AND user_id = ?
	`
	res, err := r.db.Exec(
		query,
		t.Title, string(t.Category), t.Query, t.UserIntent, t.SearchKeywords,
		searchConfig, string(t.ConditionType),
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

// UpdateFingerprintsAndMetric atualiza a lista de hashes vistos e a última métrica numérica apurada.
func (r *TriggerRepositorySQLite) UpdateFingerprintsAndMetric(id string, seenFingerprintsJSON string, lastMetricValue *float64) error {
	if seenFingerprintsJSON == "" {
		seenFingerprintsJSON = "[]"
	}
	var metricVal sql.NullFloat64
	if lastMetricValue != nil {
		metricVal = sql.NullFloat64{Float64: *lastMetricValue, Valid: true}
	}
	query := `UPDATE triggers SET seen_fingerprints_json = ?, last_metric_value = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.Exec(query, seenFingerprintsJSON, metricVal, time.Now().UTC(), id)
	return err
}

// UpdateSearchConfig atualiza o plano de buscas e parâmetros estruturados do radar.
func (r *TriggerRepositorySQLite) UpdateSearchConfig(id string, searchConfigJSON string) error {
	if searchConfigJSON == "" {
		searchConfigJSON = "{}"
	}
	query := `UPDATE triggers SET search_config_json = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.Exec(query, searchConfigJSON, time.Now().UTC(), id)
	return err
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

// UpdateLastError persiste o erro da última coleta para visibilidade no app.
func (r *TriggerRepositorySQLite) UpdateLastError(id string, errMsg string) error {
	if len(errMsg) > 500 {
		errMsg = errMsg[:500]
	}
	_, err := r.db.Exec(`UPDATE triggers SET last_error = ?, updated_at = ? WHERE id = ?`, errMsg, time.Now().UTC(), id)
	return err
}

// GetLastNotifiedAt lê o último push enviado (cooldown Fase 1).
func (r *TriggerRepositorySQLite) GetLastNotifiedAt(id string) (*time.Time, error) {
	var raw sql.NullTime
	if err := r.db.QueryRow(`SELECT last_notified_at FROM triggers WHERE id = ?`, id).Scan(&raw); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrTriggerNotFound
		}
		return nil, err
	}
	if !raw.Valid {
		return nil, nil
	}
	return &raw.Time, nil
}

// UpdateLastNotifiedAt registra o push enviado (cooldown Fase 1).
func (r *TriggerRepositorySQLite) UpdateLastNotifiedAt(id string, t time.Time) error {
	_, err := r.db.Exec(`UPDATE triggers SET last_notified_at = ?, updated_at = ? WHERE id = ?`, t.UTC(), time.Now().UTC(), id)
	return err
}

// GetSeenHashes lê os hashes do delta gate (§9.3).
func (r *TriggerRepositorySQLite) GetSeenHashes(id string) ([]string, error) {
	var raw sql.NullString
	if err := r.db.QueryRow(`SELECT last_seen_hashes FROM triggers WHERE id = ?`, id).Scan(&raw); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrTriggerNotFound
		}
		return nil, err
	}
	if !raw.Valid || raw.String == "" {
		return nil, nil
	}
	var hashes []string
	if err := json.Unmarshal([]byte(raw.String), &hashes); err != nil {
		return nil, nil
	}
	return hashes, nil
}

// SetSeenHashes grava os hashes (mantém no máximo 50).
func (r *TriggerRepositorySQLite) SetSeenHashes(id string, hashes []string) error {
	if len(hashes) > 50 {
		hashes = hashes[len(hashes)-50:]
	}
	encoded, err := json.Marshal(hashes)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(`UPDATE triggers SET last_seen_hashes = ?, updated_at = ? WHERE id = ?`, string(encoded), time.Now().UTC(), id)
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
