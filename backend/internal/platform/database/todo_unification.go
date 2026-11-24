package database

import (
	"database/sql"
	"time"
)

// MigratePendingItemsToTodos copia pendências legadas para a tabela unificada
// de todos (expand-and-contract). Idempotente: pula ids já existentes e não
// apaga pending_items (rollback = voltar a ler a tabela antiga).
func MigratePendingItemsToTodos(db *sql.DB) error {
	var pendingTable string
	err := db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name='pending_items'`).Scan(&pendingTable)
	if err != nil {
		return nil
	}

	rows, err := db.Query(`
		SELECT id, user_id, title, COALESCE(category, 'geral'), status,
		       COALESCE(scheduled_date, ''), remind_at,
		       COALESCE(remind_repeat, 'none'), COALESCE(remind_advance, 0),
		       created_at, updated_at
		FROM pending_items
	`)
	if err != nil {
		return nil
	}
	defer rows.Close()

	type pendingRow struct {
		id, userID, title, category, status, scheduledDate string
		remindAt                                           sql.NullTime
		remindRepeat                                       string
		remindAdvance                                      int
		createdAt, updatedAt                               string
	}

	var pendings []pendingRow
	for rows.Next() {
		var p pendingRow
		if err := rows.Scan(&p.id, &p.userID, &p.title, &p.category, &p.status, &p.scheduledDate, &p.remindAt, &p.remindRepeat, &p.remindAdvance, &p.createdAt, &p.updatedAt); err != nil {
			continue
		}
		pendings = append(pendings, p)
	}
	if err := rows.Err(); err != nil {
		return nil
	}

	for _, p := range pendings {
		var exists int
		if err := db.QueryRow(`SELECT COUNT(*) FROM todos WHERE id = ?`, p.id).Scan(&exists); err != nil {
			continue
		}
		if exists > 0 {
			continue
		}

		todoStatus := "pending"
		if p.status == "done" {
			todoStatus = "completed"
		}

		var dueDate any
		if len(p.scheduledDate) == 10 {
			if t, err := time.Parse("2006-01-02", p.scheduledDate); err == nil {
				dueDate = t.Add(23*time.Hour + 59*time.Minute).UTC()
			}
		}

		var remindAt any
		if p.remindAt.Valid {
			remindAt = p.remindAt.Time
		}

		category := p.category
		if category == "" {
			category = "geral"
		}

		_, _ = db.Exec(`
			INSERT INTO todos (id, user_id, title, status, priority, category, due_date, remind_at, remind_repeat, remind_advance, created_at, updated_at)
			VALUES (?, ?, ?, ?, 'medium', ?, ?, ?, ?, ?, ?, ?)
		`, p.id, p.userID, p.title, todoStatus, category, dueDate, remindAt, p.remindRepeat, p.remindAdvance, p.createdAt, p.updatedAt)
	}

	return nil
}
