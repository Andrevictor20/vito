package repository

import (
	"context"
	"database/sql"
	"github.com/andrevmp/vito/backend/internal/platform/database"
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
		SELECT user_id, autonomy_mode, auto_focus_blocks,
		       COALESCE(persona_style, 'balanced'),
		       COALESCE(preferred_voice, 'alloy'),
		       COALESCE(emoji_policy, 'moderate'),
		       COALESCE(response_length, 'adaptive'),
		       COALESCE(default_model, ''),
		       COALESCE(default_effort, 'auto'),
		       created_at, updated_at
		FROM user_ai_settings
		WHERE user_id = ?
	`
	row := r.db.QueryRow(query, userID)

	var s domain.AISettings
	var autoFocus bool
	var modeStr string
	var persona, voice, emoji, respLen, defModel, defEffort string
	var createdAt, updatedAt time.Time

	err := row.Scan(
		&s.UserID,
		&modeStr,
		&autoFocus,
		&persona,
		&voice,
		&emoji,
		&respLen,
		&defModel,
		&defEffort,
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
	s.PersonaStyle = persona
	s.PreferredVoice = voice
	s.EmojiPolicy = emoji
	s.ResponseLength = respLen
	s.DefaultModel = defModel
	s.DefaultEffort = defEffort
	s.CreatedAt = createdAt
	s.UpdatedAt = updatedAt

	return &s, nil
}

// UpsertSettings insere ou atualiza as configurações de IA do usuário via DefaultWriterQueue.
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
	if s.PersonaStyle == "" {
		s.PersonaStyle = "balanced"
	}
	if s.PreferredVoice == "" {
		s.PreferredVoice = "alloy"
	}
	if s.EmojiPolicy == "" {
		s.EmojiPolicy = "moderate"
	}
	if s.ResponseLength == "" {
		s.ResponseLength = "adaptive"
	}
	if s.DefaultEffort == "" {
		s.DefaultEffort = domain.EffortAuto
	}

	query := `
		INSERT INTO user_ai_settings (
			user_id, autonomy_mode, auto_focus_blocks,
			persona_style, preferred_voice, emoji_policy, response_length,
			default_model, default_effort, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			autonomy_mode = excluded.autonomy_mode,
			auto_focus_blocks = excluded.auto_focus_blocks,
			persona_style = excluded.persona_style,
			preferred_voice = excluded.preferred_voice,
			emoji_policy = excluded.emoji_policy,
			response_length = excluded.response_length,
			default_model = excluded.default_model,
			default_effort = excluded.default_effort,
			updated_at = excluded.updated_at
	`
	return database.ExecuteQueuedWrite(context.Background(), func() error {
		_, err := r.db.Exec(
			query,
			s.UserID,
			mode,
			s.AutoFocusBlocks,
			s.PersonaStyle,
			s.PreferredVoice,
			s.EmojiPolicy,
			s.ResponseLength,
			s.DefaultModel,
			s.DefaultEffort,
			s.CreatedAt,
			s.UpdatedAt,
		)
		return err
	})
}

// GetPreferences retorna apenas o modelo e o esforço padrão do usuário.
func (r *AISettingsRepositorySQLite) GetPreferences(ctx context.Context, userID string) (*domain.AIPreferences, error) {
	_ = ctx
	settings, err := r.GetSettings(userID)
	if err != nil {
		return nil, err
	}
	return &domain.AIPreferences{
		DefaultModel:  settings.DefaultModel,
		DefaultEffort: settings.DefaultEffort,
	}, nil
}

// UpdatePreferences atualiza apenas default_model e default_effort, criando a linha padrão se necessário.
func (r *AISettingsRepositorySQLite) UpdatePreferences(ctx context.Context, userID, defaultModel, defaultEffort string) error {
	if defaultEffort == "" {
		defaultEffort = domain.EffortAuto
	}
	now := time.Now().UTC()
	const query = `
		INSERT INTO user_ai_settings (
			user_id, autonomy_mode, auto_focus_blocks,
			persona_style, preferred_voice, emoji_policy, response_length,
			default_model, default_effort, created_at, updated_at
		) VALUES (?, 'assisted', 0, 'balanced', 'alloy', 'moderate', 'adaptive', ?, ?, ?, ?)
		ON CONFLICT(user_id) DO UPDATE SET
			default_model = excluded.default_model,
			default_effort = excluded.default_effort,
			updated_at = excluded.updated_at
	`
	return database.ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, query, userID, defaultModel, defaultEffort, now, now)
		return err
	})
}

// ClearProviderPrefs limpa o default_model quando o provedor referenciado é removido.
func (r *AISettingsRepositorySQLite) ClearProviderPrefs(ctx context.Context, userID, providerKey string) error {
	const query = `
		UPDATE user_ai_settings
		SET default_model = '', updated_at = ?
		WHERE user_id = ? AND default_model LIKE ?
	`
	return database.ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, query, time.Now().UTC(), userID, providerKey+":%")
		return err
	})
}
