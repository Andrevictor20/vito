package repository

import (
	"database/sql"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// CoreProfileRepository SQLite (UPSERT).
type CoreProfileRepository struct {
	db *sql.DB
}

func NewCoreProfileRepository(db *sql.DB) *CoreProfileRepository {
	return &CoreProfileRepository{db: db}
}

func (r *CoreProfileRepository) GetAll(userID string) ([]domain.CoreProfile, error) {
	rows, err := r.db.Query(`SELECT user_id, profile_key, profile_value, updated_at FROM user_core_profile WHERE user_id=? ORDER BY profile_key`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []domain.CoreProfile
	for rows.Next() {
		var p domain.CoreProfile
		if err := rows.Scan(&p.UserID, &p.Key, &p.Value, &p.UpdatedAt); err != nil {
			continue
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *CoreProfileRepository) Set(userID, key, value string) error {
	_, err := r.db.Exec(`INSERT INTO user_core_profile (user_id, profile_key, profile_value, updated_at) VALUES (?,?,?,?)
		ON CONFLICT(user_id, profile_key) DO UPDATE SET profile_value=excluded.profile_value, updated_at=excluded.updated_at`,
		userID, key, value, time.Now().UTC())
	return err
}
