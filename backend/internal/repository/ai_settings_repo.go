package repository

import (
	"database/sql"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// AISettingsRepositorySQLite gerencia a persistência das preferências de IA no SQLite.
type AISettingsRepositorySQLite struct {
	db *sql.DB
}

// NewAISettingsRepository cria uma nova instância de AISettingsRepositorySQLite.
func NewAISettingsRepository(db *sql.DB) *AISettingsRepositorySQLite {
	return &AISettingsRepositorySQLite{db: db}
}

// GetSettings recupera as preferências de IA do usuário ou retorna o default (assistido) se inexistente.
func (r *AISettingsRepositorySQLite) GetSettings(userID string) (*domain.AISettings, error) {
	query := `
		SELECT user_id, autonomy_mode, auto_focus_blocks, created_at, updated_at
		FROM user_ai_settings
		WHERE user_id = ?
	`
	row := r.db.QueryRow(query, userID)

	var s domain.AISettings
	var autoFocus bool
	var modeStr string
	var createdAt, updatedAt time.Time

	err := row.Scan(
		&s.UserID,
		&modeStr,
		&autoFocus,
		&createdAt,
		&updatedAt,
	)
	if err == sql.ErrNoRows {
		return domain.DefaultAISettings(userID), nil
	}
	if err != nil {
		return nil, err
	}

	s.AutonomyMode = domain.AutonomyMode(modeStr)
	s.AutoFocusBlocks = autoFocus
	s.CreatedAt = createdAt
	s.UpdatedAt = updatedAt

	return &s, nil
}

// UpsertSettings insere ou atualiza as configurações de IA do usuário.
func (r *AISettingsRepositorySQLite) UpsertSettings(s *domain.AISettings) error {
	now := time.Now().UTC()
	if s.CreatedAt.IsZero() {
		s.CreatedAt = now
	}
	s.UpdatedAt = now

	mode := string(s.AutonomyMode)
	if mode == "" {
		mode = string(domain.AutonomyModeAssisted)
	}

	query := `
		INSERT INTO user_ai_settings (
			user_id, autonomy_mode, auto_focus_blocks, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			autonomy_mode = excluded.autonomy_mode,
			auto_focus_blocks = excluded.auto_focus_blocks,
			updated_at = excluded.updated_at
	`
	_, err := r.db.Exec(
		query,
		s.UserID,
		mode,
		s.AutoFocusBlocks,
		s.CreatedAt,
		s.UpdatedAt,
	)
	return err
}
