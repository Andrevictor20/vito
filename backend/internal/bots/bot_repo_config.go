package bots

import (
	"context"
	"database/sql"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/repository"
	"time"

	"github.com/andrevmp/vito/backend/internal/catalog"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// ListActions lista as ações configuradas de um bot.
func (r *BotRepositorySQLite) ListActions(ctx context.Context, botID, userID string) ([]domain.BotAction, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, bot_id, user_id, action_key, policy, config_json, created_at, updated_at
		FROM bot_actions
		WHERE bot_id = ? AND user_id = ?
		ORDER BY created_at ASC, action_key ASC
	`, botID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var actions []domain.BotAction
	for rows.Next() {
		var a domain.BotAction
		var pol string
		if err := rows.Scan(&a.ID, &a.BotID, &a.UserID, &a.ActionKey, &pol, &a.ConfigJSON, &a.CreatedAt, &a.UpdatedAt); err != nil {
			return nil, err
		}
		a.Policy = domain.ActionPolicy(pol)
		actions = append(actions, a)
	}
	return actions, rows.Err()
}

// UpsertAction cria ou atualiza uma ação do bot validando ALWAYS.
func (r *BotRepositorySQLite) UpsertAction(ctx context.Context, a *domain.BotAction) error {
	if err := domain.ValidateActionPolicy(a.ActionKey, a.Policy); err != nil {
		return err
	}
	now := time.Now().UTC()
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	if a.ConfigJSON == "" {
		a.ConfigJSON = "{}"
	}
	if a.CreatedAt.IsZero() {
		a.CreatedAt = now
	}
	a.UpdatedAt = now

	return repository.ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO bot_actions (id, bot_id, user_id, action_key, policy, config_json, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON CONFLICT(bot_id, action_key) DO UPDATE SET
				policy = excluded.policy,
				config_json = excluded.config_json,
				updated_at = excluded.updated_at
		`, a.ID, a.BotID, a.UserID, a.ActionKey, string(a.Policy), a.ConfigJSON, a.CreatedAt, a.UpdatedAt)
		return err
	})
}

// UpdateActionPolicy altera apenas a política de uma ação existente, bloqueando auto em ALWAYS.
func (r *BotRepositorySQLite) UpdateActionPolicy(ctx context.Context, botID, userID, actionKey string, policy domain.ActionPolicy) error {
	if err := domain.ValidateActionPolicy(actionKey, policy); err != nil {
		return err
	}
	n, err := repository.ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `
			UPDATE bot_actions
			SET policy = ?, updated_at = ?
			WHERE bot_id = ? AND user_id = ? AND action_key = ?
		`, string(policy), time.Now().UTC(), botID, userID, actionKey)
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("%w: %s", domain.ErrUnknownAction, actionKey)
	}
	return nil
}

// DeleteAction remove uma ação configurada do bot.
func (r *BotRepositorySQLite) DeleteAction(ctx context.Context, botID, userID, actionKey string) error {
	_, err := repository.ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `DELETE FROM bot_actions WHERE bot_id = ? AND user_id = ? AND action_key = ?`, botID, userID, actionKey)
	})
	return err
}

// ListSkills lista as habilidades anexadas ao bot.
func (r *BotRepositorySQLite) ListSkills(ctx context.Context, botID, userID string) ([]domain.BotSkill, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, bot_id, user_id, skill_key, version, created_at
		FROM bot_skills
		WHERE bot_id = ? AND user_id = ?
		ORDER BY created_at ASC
	`, botID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var skills []domain.BotSkill
	for rows.Next() {
		var s domain.BotSkill
		if err := rows.Scan(&s.ID, &s.BotID, &s.UserID, &s.SkillKey, &s.Version, &s.CreatedAt); err != nil {
			return nil, err
		}
		skills = append(skills, s)
	}
	return skills, rows.Err()
}

// AttachSkill anexa um pacote de habilidade ao bot e adiciona apenas as ações faltantes
// com política padrão (nunca sobrescrevendo ações existentes).
func (r *BotRepositorySQLite) AttachSkill(ctx context.Context, botID, userID string, skill catalog.SkillManifest) error {
	existingSkills, err := r.ListSkills(ctx, botID, userID)
	if err != nil {
		return err
	}
	alreadyAttached := false
	for _, s := range existingSkills {
		if s.SkillKey == skill.Key {
			alreadyAttached = true
			break
		}
	}
	if !alreadyAttached && len(existingSkills) >= domain.MaxBotSkills {
		return domain.ErrMaxSkillsExceeded
	}

	now := time.Now().UTC()
	ver := skill.Version
	if ver <= 0 {
		ver = 1
	}

	return repository.ExecuteQueuedWrite(ctx, func() error {
		tx, err := r.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback() }()

		if _, err := tx.ExecContext(ctx, `
			INSERT INTO bot_skills (id, bot_id, user_id, skill_key, version, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON CONFLICT(bot_id, skill_key) DO UPDATE SET version = excluded.version
		`, uuid.NewString(), botID, userID, skill.Key, ver, now); err != nil {
			return err
		}

		for _, actKey := range skill.Actions {
			spec, ok := domain.ActionCatalog[actKey]
			if !ok {
				return fmt.Errorf("%w: %s", domain.ErrUnknownAction, actKey)
			}
			if _, err := tx.ExecContext(ctx, `
				INSERT OR IGNORE INTO bot_actions (id, bot_id, user_id, action_key, policy, config_json, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, '{}', ?, ?)
			`, uuid.NewString(), botID, userID, actKey, string(spec.DefaultPolicy), now, now); err != nil {
				return err
			}
		}

		return tx.Commit()
	})
}

// RemoveSkill remove apenas a habilidade de bot_skills, preservando todas as bot_actions.
func (r *BotRepositorySQLite) RemoveSkill(ctx context.Context, botID, userID, skillKey string) error {
	n, err := repository.ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `DELETE FROM bot_skills WHERE bot_id = ? AND user_id = ? AND skill_key = ?`, botID, userID, skillKey)
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrSkillNotFound
	}
	return nil
}

// PendingSkillUpgradeActions retorna as ações exigidas por uma nova versão da habilidade
// que o bot ainda não possui concedidas (AC-11).
func (r *BotRepositorySQLite) PendingSkillUpgradeActions(ctx context.Context, botID, userID string, skill catalog.SkillManifest) ([]string, error) {
	actions, err := r.ListActions(ctx, botID, userID)
	if err != nil {
		return nil, err
	}
	have := make(map[string]bool, len(actions))
	for _, a := range actions {
		have[a.ActionKey] = true
	}
	var missing []string
	for _, actKey := range skill.Actions {
		if !have[actKey] {
			missing = append(missing, actKey)
		}
	}
	return missing, nil
}

// UpgradeSkill atualiza a versão da habilidade e adiciona as ações faltantes após confirmação.
func (r *BotRepositorySQLite) UpgradeSkill(ctx context.Context, botID, userID string, skill catalog.SkillManifest) error {
	return r.AttachSkill(ctx, botID, userID, skill)
}

// ListMemories retorna as memórias ativas isoladas do bot.
func (r *BotRepositorySQLite) ListMemories(ctx context.Context, botID, userID string) ([]domain.BotMemory, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT id, bot_id, user_id, content, source, is_active, created_at, updated_at
		FROM bot_memories
		WHERE bot_id = ? AND user_id = ? AND is_active = 1
		ORDER BY created_at DESC
	`, botID, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var mems []domain.BotMemory
	for rows.Next() {
		var m domain.BotMemory
		if err := rows.Scan(&m.ID, &m.BotID, &m.UserID, &m.Content, &m.Source, &m.IsActive, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, err
		}
		mems = append(mems, m)
	}
	return mems, rows.Err()
}

// AddMemory persiste uma nova memória isolada do bot.
func (r *BotRepositorySQLite) AddMemory(ctx context.Context, m *domain.BotMemory) error {
	now := time.Now().UTC()
	if m.ID == "" {
		m.ID = uuid.NewString()
	}
	if m.Source == "" {
		m.Source = "chat"
	}
	if m.CreatedAt.IsZero() {
		m.CreatedAt = now
	}
	m.UpdatedAt = now
	m.IsActive = true

	return repository.ExecuteQueuedWrite(ctx, func() error {
		_, err := r.db.ExecContext(ctx, `
			INSERT INTO bot_memories (id, bot_id, user_id, content, source, is_active, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 1, ?, ?)
		`, m.ID, m.BotID, m.UserID, m.Content, m.Source, m.CreatedAt, m.UpdatedAt)
		return err
	})
}

// DeleteMemory desativa/remove uma memória específica do bot.
func (r *BotRepositorySQLite) DeleteMemory(ctx context.Context, botID, userID, memID string) error {
	_, err := repository.ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `DELETE FROM bot_memories WHERE id = ? AND bot_id = ? AND user_id = ?`, memID, botID, userID)
	})
	return err
}
