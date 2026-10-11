package repository

import (
	"database/sql"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// BriefingRepositorySQLite gerencia a persistência das configurações do briefing matinal no SQLite.
type BriefingRepositorySQLite struct {
	db *sql.DB
}

// NewBriefingRepository cria uma nova instância de BriefingRepositorySQLite.
func NewBriefingRepository(db *sql.DB) *BriefingRepositorySQLite {
	return &BriefingRepositorySQLite{db: db}
}

// GetSettings busca as configurações de briefing do usuário ou retorna o default se inexistente.
func (r *BriefingRepositorySQLite) GetSettings(userID string) (*domain.BriefingSettings, error) {
	query := `
		SELECT user_id, enabled, scheduled_time, wakeup_alarm_early, last_sent_date, created_at, updated_at
		FROM user_briefing_settings
		WHERE user_id = ?
	`
	row := r.db.QueryRow(query, userID)

	var s domain.BriefingSettings
	var enabled, wakeup bool
	var createdAt, updatedAt time.Time

	err := row.Scan(
		&s.UserID,
		&enabled,
		&s.ScheduledTime,
		&wakeup,
		&s.LastSentDate,
		&createdAt,
		&updatedAt,
	)
	if err == sql.ErrNoRows {
		return domain.DefaultBriefingSettings(userID), nil
	}
	if err != nil {
		return nil, err
	}

	s.Enabled = enabled
	s.WakeupAlarmEarly = wakeup
	s.CreatedAt = createdAt
	s.UpdatedAt = updatedAt

	return &s, nil
}

// UpsertSettings insere ou atualiza as configurações de briefing do usuário.
func (r *BriefingRepositorySQLite) UpsertSettings(s *domain.BriefingSettings) error {
	now := time.Now().UTC()
	if s.CreatedAt.IsZero() {
		s.CreatedAt = now
	}
	s.UpdatedAt = now

	query := `
		INSERT INTO user_briefing_settings (
			user_id, enabled, scheduled_time, wakeup_alarm_early, last_sent_date, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			enabled = excluded.enabled,
			scheduled_time = excluded.scheduled_time,
			wakeup_alarm_early = excluded.wakeup_alarm_early,
			last_sent_date = excluded.last_sent_date,
			updated_at = excluded.updated_at
	`
	_, err := r.db.Exec(
		query,
		s.UserID,
		s.Enabled,
		s.ScheduledTime,
		s.WakeupAlarmEarly,
		s.LastSentDate,
		s.CreatedAt,
		s.UpdatedAt,
	)
	return err
}

// ListActiveSettings retorna todos os usuários com o briefing matinal ativado.
func (r *BriefingRepositorySQLite) ListActiveSettings() ([]domain.BriefingSettings, error) {
	query := `
		SELECT user_id, enabled, scheduled_time, wakeup_alarm_early, last_sent_date, created_at, updated_at
		FROM user_briefing_settings
		WHERE enabled = 1
	`
	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []domain.BriefingSettings
	for rows.Next() {
		var s domain.BriefingSettings
		var enabled, wakeup bool
		var createdAt, updatedAt time.Time

		if err := rows.Scan(
			&s.UserID,
			&enabled,
			&s.ScheduledTime,
			&wakeup,
			&s.LastSentDate,
			&createdAt,
			&updatedAt,
		); err != nil {
			return nil, err
		}

		s.Enabled = enabled
		s.WakeupAlarmEarly = wakeup
		s.CreatedAt = createdAt
		s.UpdatedAt = updatedAt

		list = append(list, s)
	}

	return list, rows.Err()
}

// MarkSent atualiza a data do último envio de briefing para o usuário.
func (r *BriefingRepositorySQLite) MarkSent(userID, dateStr string) error {
	now := time.Now().UTC()
	query := `
		INSERT INTO user_briefing_settings (
			user_id, enabled, scheduled_time, wakeup_alarm_early, last_sent_date, created_at, updated_at
		) VALUES (?, 1, '07:30', 1, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			last_sent_date = excluded.last_sent_date,
			updated_at = excluded.updated_at
	`
	_, err := r.db.Exec(query, userID, dateStr, now, now)
	return err
}
