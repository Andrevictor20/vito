package database

import (
	"database/sql"
	"time"
)

// applyBotsMigration aplica 027_bots.sql, adiciona colunas de bot em triggers
// de forma idempotente e realiza o backfill de gatilhos legados.
func applyBotsMigration(db *sql.DB, scriptPath string) error {
	content, err := migrationFS.ReadFile(scriptPath)
	if err != nil {
		return err
	}
	if _, err := db.Exec(string(content)); err != nil {
		return err
	}

	alterRules := []struct {
		column string
		ddl    string
	}{
		{"goal", "ALTER TABLE triggers ADD COLUMN goal TEXT NOT NULL DEFAULT ''"},
		{"rules_json", "ALTER TABLE triggers ADD COLUMN rules_json TEXT NOT NULL DEFAULT '[]'"},
		{"category", "ALTER TABLE triggers ADD COLUMN category TEXT NOT NULL DEFAULT ''"},
		{"icon", "ALTER TABLE triggers ADD COLUMN icon TEXT NOT NULL DEFAULT 'radar'"},
		{"color", "ALTER TABLE triggers ADD COLUMN color TEXT NOT NULL DEFAULT 'orange'"},
		{"skin_json", "ALTER TABLE triggers ADD COLUMN skin_json TEXT NOT NULL DEFAULT '{}'"},
		{"template_key", "ALTER TABLE triggers ADD COLUMN template_key TEXT NOT NULL DEFAULT ''"},
		{"quiet_only_on_change", "ALTER TABLE triggers ADD COLUMN quiet_only_on_change INTEGER NOT NULL DEFAULT 1"},
		{"thread_id", "ALTER TABLE triggers ADD COLUMN thread_id TEXT NOT NULL DEFAULT ''"},
		{"consecutive_failures", "ALTER TABLE triggers ADD COLUMN consecutive_failures INTEGER NOT NULL DEFAULT 0"},
		{"model_pref", "ALTER TABLE triggers ADD COLUMN model_pref TEXT NOT NULL DEFAULT ''"},
		{"effort_pref", "ALTER TABLE triggers ADD COLUMN effort_pref TEXT NOT NULL DEFAULT ''"},
	}

	if hasTable(db, "triggers") {
		for _, rule := range alterRules {
			if hasColumn(db, "triggers", rule.column) {
				continue
			}
			if _, err := db.Exec(rule.ddl); err != nil {
				return err
			}
		}
		if err := backfillLegacyTriggersToBots(db); err != nil {
			return err
		}
	}

	return nil
}

// backfillLegacyTriggersToBots converte gatilhos legados em bots com goal preenchido
// e ações padrão [search:auto, notify:auto] de forma idempotente.
func backfillLegacyTriggersToBots(db *sql.DB) error {
	if _, err := db.Exec(`
		UPDATE triggers
		SET goal = COALESCE(NULLIF(goal, ''), NULLIF(query, ''), title)
		WHERE goal = ''
	`); err != nil {
		return err
	}

	if _, err := db.Exec(`
		UPDATE triggers
		SET category = CASE
			WHEN condition_type IN ('price_above', 'price_below') THEN 'Preços'
			WHEN category = 'news' THEN 'Notícias'
			ELSE 'Monitoramento'
		END
		WHERE category = ''
	`); err != nil {
		return err
	}

	now := time.Now().UTC()
	for _, actionKey := range []string{"search", "notify"} {
		if _, err := db.Exec(`
			INSERT OR IGNORE INTO bot_actions (id, bot_id, user_id, action_key, policy, config_json, created_at, updated_at)
			SELECT t.id || ':' || ?, t.id, t.user_id, ?, 'auto', '{}', ?, ?
			FROM triggers t
			WHERE NOT EXISTS (
				SELECT 1 FROM bot_actions ba WHERE ba.bot_id = t.id AND ba.action_key = ?
			)
		`, actionKey, actionKey, now, now, actionKey); err != nil {
			return err
		}
	}

	return nil
}
