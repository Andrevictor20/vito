package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/google/uuid"
)

// BotRepositorySQLite persiste bots, ações, habilidades e memórias sobre SQLite.
type BotRepositorySQLite struct {
	db *sql.DB
}

// NewBotRepository cria um repositório de bots com suporte à fila de escrita.
func NewBotRepository(db *sql.DB) *BotRepositorySQLite {
	return &BotRepositorySQLite{db: db}
}

const botSelectColumns = `
	id, user_id, title,
	COALESCE(NULLIF(goal, ''), NULLIF(query, ''), title),
	COALESCE(rules_json, '[]'),
	COALESCE(category, ''),
	COALESCE(icon, 'radar'),
	COALESCE(color, 'orange'),
	COALESCE(skin_json, '{}'),
	COALESCE(template_key, ''),
	COALESCE(query, ''),
	COALESCE(condition_type, 'daily_brief'),
	COALESCE(target_value, ''),
	COALESCE(current_value, ''),
	status, frequency,
	COALESCE(scheduled_time, ''),
	COALESCE(days_of_week, 'DAILY'),
	COALESCE(quiet_only_on_change, 1),
	COALESCE(thread_id, ''),
	COALESCE(consecutive_failures, 0),
	COALESCE(model_pref, ''),
	COALESCE(effort_pref, ''),
	COALESCE(last_run_status, ''),
	COALESCE(last_error, ''),
	last_checked_at, next_check_at, created_at, updated_at
`

func scanBot(scanner interface{ Scan(dest ...interface{}) error }) (*domain.Bot, error) {
	var b domain.Bot
	var rulesJSON, status, freq string
	var quietInt int
	var lastChecked, nextCheck sql.NullTime

	err := scanner.Scan(
		&b.ID, &b.UserID, &b.Title, &b.Goal, &rulesJSON,
		&b.Category, &b.Icon, &b.Color, &b.SkinJSON, &b.TemplateKey,
		&b.Query, &b.ConditionType, &b.TargetValue, &b.CurrentValue,
		&status, &freq, &b.ScheduledTime, &b.DaysOfWeek,
		&quietInt, &b.ThreadID, &b.ConsecutiveFailures,
		&b.ModelPref, &b.EffortPref, &b.LastRunStatus, &b.LastError,
		&lastChecked, &nextCheck, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	b.Status = domain.TriggerStatus(status)
	b.Frequency = domain.TriggerFrequency(freq)
	b.QuietOnlyOnChange = quietInt != 0
	if lastChecked.Valid {
		b.LastCheckedAt = &lastChecked.Time
	}
	if nextCheck.Valid {
		b.NextCheckAt = &nextCheck.Time
	}
	if rulesJSON != "" {
		_ = json.Unmarshal([]byte(rulesJSON), &b.Rules)
	}
	if b.Rules == nil {
		b.Rules = []string{}
	}
	return &b, nil
}

// Create registra um novo bot na tabela triggers e suas ações/habilidades iniciais.
func (r *BotRepositorySQLite) Create(ctx context.Context, b *domain.Bot) error {
	now := time.Now().UTC()
	if b.ID == "" {
		b.ID = uuid.NewString()
	}
	if b.CreatedAt.IsZero() {
		b.CreatedAt = now
	}
	if b.UpdatedAt.IsZero() {
		b.UpdatedAt = now
	}
	if b.Status == "" {
		b.Status = domain.TriggerStatusActive
	}
	if b.Frequency == "" {
		b.Frequency = domain.TriggerFrequency(domain.FrequencyDailyMorning)
	}
	if b.ConditionType == "" {
		b.ConditionType = string(domain.ConditionDailyBrief)
	}
	if b.Icon == "" {
		b.Icon = "radar"
	}
	if b.Color == "" {
		b.Color = "orange"
	}
	if b.SkinJSON == "" {
		b.SkinJSON = "{}"
	}
	if b.DaysOfWeek == "" {
		b.DaysOfWeek = "DAILY"
	}
	rulesBytes, err := json.Marshal(b.Rules)
	if err != nil {
		return err
	}
	if b.Rules == nil {
		rulesBytes = []byte("[]")
	}
	quietInt := 0
	if b.QuietOnlyOnChange {
		quietInt = 1
	}
	queryText := b.Query
	if queryText == "" {
		queryText = b.Goal
	}

	for _, act := range b.Actions {
		if err := domain.ValidateActionPolicy(act.ActionKey, act.Policy); err != nil {
			return err
		}
	}

	return ExecuteQueuedWrite(ctx, func() error {
		tx, err := r.db.BeginTx(ctx, nil)
		if err != nil {
			return err
		}
		defer func() { _ = tx.Rollback() }()

		_, err = tx.ExecContext(ctx, `
			INSERT INTO triggers (
				id, user_id, title, category, query, goal, rules_json,
				icon, color, skin_json, template_key,
				condition_type, target_value, current_value, status, frequency,
				scheduled_time, days_of_week, quiet_only_on_change, thread_id,
				consecutive_failures, model_pref, effort_pref,
				last_checked_at, next_check_at, created_at, updated_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			b.ID, b.UserID, b.Title, b.Category, queryText, b.Goal, string(rulesBytes),
			b.Icon, b.Color, b.SkinJSON, b.TemplateKey,
			b.ConditionType, b.TargetValue, b.CurrentValue, string(b.Status), string(b.Frequency),
			b.ScheduledTime, b.DaysOfWeek, quietInt, b.ThreadID,
			b.ConsecutiveFailures, b.ModelPref, b.EffortPref,
			b.LastCheckedAt, b.NextCheckAt, b.CreatedAt, b.UpdatedAt,
		)
		if err != nil {
			return err
		}

		for _, act := range b.Actions {
			actID := act.ID
			if actID == "" {
				actID = uuid.NewString()
			}
			cfg := act.ConfigJSON
			if cfg == "" {
				cfg = "{}"
			}
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO bot_actions (id, bot_id, user_id, action_key, policy, config_json, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			`, actID, b.ID, b.UserID, act.ActionKey, string(act.Policy), cfg, now, now); err != nil {
				return err
			}
		}

		for _, sk := range b.Skills {
			skID := sk.ID
			if skID == "" {
				skID = uuid.NewString()
			}
			ver := sk.Version
			if ver <= 0 {
				ver = 1
			}
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO bot_skills (id, bot_id, user_id, skill_key, version, created_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, skID, b.ID, b.UserID, sk.SkillKey, ver, now); err != nil {
				return err
			}
		}

		return tx.Commit()
	})
}

// GetByID busca um bot com suas ações, habilidades e memórias ativas.
func (r *BotRepositorySQLite) GetByID(ctx context.Context, id, userID string) (*domain.Bot, error) {
	query := "SELECT " + botSelectColumns + " FROM triggers WHERE id = ? AND user_id = ?"
	b, err := scanBot(r.db.QueryRowContext(ctx, query, id, userID))
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, domain.ErrBotNotFound
		}
		return nil, err
	}
	if b.Actions, err = r.ListActions(ctx, id, userID); err != nil {
		return nil, err
	}
	if b.Skills, err = r.ListSkills(ctx, id, userID); err != nil {
		return nil, err
	}
	if b.Memories, err = r.ListMemories(ctx, id, userID); err != nil {
		return nil, err
	}
	return b, nil
}

// ListByUser lista todos os bots do usuário ordenados pelos mais recentes.
func (r *BotRepositorySQLite) ListByUser(ctx context.Context, userID string) ([]domain.Bot, error) {
	query := "SELECT " + botSelectColumns + " FROM triggers WHERE user_id = ? ORDER BY created_at DESC"
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bots []domain.Bot
	for rows.Next() {
		b, err := scanBot(rows)
		if err != nil {
			return nil, err
		}
		bots = append(bots, *b)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	for i := range bots {
		if bots[i].Actions, err = r.ListActions(ctx, bots[i].ID, userID); err != nil {
			return nil, err
		}
		if bots[i].Skills, err = r.ListSkills(ctx, bots[i].ID, userID); err != nil {
			return nil, err
		}
	}
	return bots, nil
}

// Update atualiza campos editáveis de um bot existente.
func (r *BotRepositorySQLite) Update(ctx context.Context, b *domain.Bot) error {
	b.UpdatedAt = time.Now().UTC()
	rulesBytes, err := json.Marshal(b.Rules)
	if err != nil {
		return err
	}
	if b.Rules == nil {
		rulesBytes = []byte("[]")
	}
	quietInt := 0
	if b.QuietOnlyOnChange {
		quietInt = 1
	}

	n, err := ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `
			UPDATE triggers SET
				title = ?, goal = ?, rules_json = ?, category = ?,
				icon = ?, color = ?, skin_json = ?, status = ?,
				frequency = ?, scheduled_time = ?, days_of_week = ?,
				quiet_only_on_change = ?, thread_id = ?, consecutive_failures = ?,
				model_pref = ?, effort_pref = ?, updated_at = ?
			WHERE id = ? AND user_id = ?
		`,
			b.Title, b.Goal, string(rulesBytes), b.Category,
			b.Icon, b.Color, b.SkinJSON, string(b.Status),
			string(b.Frequency), b.ScheduledTime, b.DaysOfWeek,
			quietInt, b.ThreadID, b.ConsecutiveFailures,
			b.ModelPref, b.EffortPref, b.UpdatedAt,
			b.ID, b.UserID,
		)
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrBotNotFound
	}
	return nil
}

// Delete remove um bot e suas dependências por CASCADE.
func (r *BotRepositorySQLite) Delete(ctx context.Context, id, userID string) error {
	n, err := ExecuteQueuedWriteRows(ctx, func() (sql.Result, error) {
		return r.db.ExecContext(ctx, `DELETE FROM triggers WHERE id = ? AND user_id = ?`, id, userID)
	})
	if err != nil {
		return err
	}
	if n == 0 {
		return domain.ErrBotNotFound
	}
	return nil
}
