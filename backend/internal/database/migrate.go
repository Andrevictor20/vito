package database

import (
	"database/sql"
	"embed"
	"sort"
	"time"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// orderedMigrations lista os arquivos na ordem de aplicação (BACK-03).
func orderedMigrations() []string {
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return nil
	}
	var names []string
	for _, e := range entries {
		if !e.IsDir() {
			names = append(names, "migrations/"+e.Name())
		}
	}
	sort.Strings(names)
	return names
}

func ensureMigrationsTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at DATETIME NOT NULL
		)
	`)
	return err
}

func appliedVersions(db *sql.DB) (map[string]bool, error) {
	applied := map[string]bool{}
	rows, err := db.Query(`SELECT version FROM schema_migrations`)
	if err != nil {
		return applied, err
	}
	defer rows.Close()
	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			continue
		}
		applied[v] = true
	}
	return applied, rows.Err()
}

func recordMigration(db *sql.DB, version string) error {
	_, err := db.Exec(
		`INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)`,
		version, time.Now().UTC(),
	)
	return err
}

func hasTable(db *sql.DB, name string) bool {
	var found string
	err := db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, name).Scan(&found)
	return err == nil && found == name
}

func hasColumn(db *sql.DB, table, column string) bool {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return false
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, ctype string
		var notNull, pk int
		var dflt sql.NullString
		if err := rows.Scan(&cid, &name, &ctype, &notNull, &dflt, &pk); err != nil {
			continue
		}
		if name == column {
			return true
		}
	}
	return false
}

// runVersionedMigrations aplica migrações pendentes com rastreio (BACK-03).
// Bases legadas (tabelas já criadas pelo bootstrap antigo) são marcadas como
// migradas sem reexecução, pois o schema resultante é equivalente.
func runVersionedMigrations(db *sql.DB) error {
	if err := ensureMigrationsTable(db); err != nil {
		return err
	}
	applied, err := appliedVersions(db)
	if err != nil {
		return err
	}

	// Base legada: tabelas existem mas nada foi registrado -> carimba 001 e
	// aplica 002 de verdade apenas se a coluna ainda não existir.
	// Depois cai no loop para aplicar 003+ (sem retorno antecipado).
	if hasTable(db, "todos") && !applied["001_initial_schema.sql"] && !applied["002_todo_category.sql"] {
		if err := recordMigration(db, "001_initial_schema.sql"); err != nil {
			return err
		}
		if !hasColumn(db, "todos", "category") {
			content, err := migrationFS.ReadFile("migrations/002_todo_category.sql")
			if err != nil {
				return err
			}
			if _, err := db.Exec(string(content)); err != nil {
				return err
			}
		}
		if err := recordMigration(db, "002_todo_category.sql"); err != nil {
			return err
		}
		applied["001_initial_schema.sql"] = true
		applied["002_todo_category.sql"] = true
	}

	for _, name := range orderedMigrations() {
		version := name[len("migrations/"):]
		if applied[version] {
			continue
		}
		// ALTERs são rede de segurança: pula se a coluna-alvo já existe.
		if version == "002_todo_category.sql" && hasColumn(db, "todos", "category") {
			if err := recordMigration(db, version); err != nil {
				return err
			}
			continue
		}
		if version == "004_memory_cognition.sql" {
			// Colunas com guarda individual; CREATEs (FTS5, user_entities) são IF NOT EXISTS.
			cols := []struct{ name, ddl string }{
				{"importance", "ALTER TABLE memories ADD COLUMN importance INTEGER DEFAULT 3"},
				{"confidence", "ALTER TABLE memories ADD COLUMN confidence REAL DEFAULT 1.0"},
				{"access_count", "ALTER TABLE memories ADD COLUMN access_count INTEGER DEFAULT 0"},
				{"last_accessed_at", "ALTER TABLE memories ADD COLUMN last_accessed_at DATETIME"},
				{"superseded_by", "ALTER TABLE memories ADD COLUMN superseded_by TEXT DEFAULT ''"},
			}
			for _, c := range cols {
				if !hasColumn(db, "memories", c.name) {
					if _, err := db.Exec(c.ddl); err != nil {
						return err
					}
				}
			}
			content, err := migrationFS.ReadFile(name)
			if err != nil {
				return err
			}
			if _, err := db.Exec(string(content)); err != nil {
				return err
			}
			// Retro-preenche o FTS com memórias existentes.
			if _, err := db.Exec(`INSERT OR IGNORE INTO memories_fts(rowid, content, category) SELECT rowid, content, category FROM memories WHERE rowid NOT IN (SELECT rowid FROM memories_fts)`); err != nil {
				return err
			}
			if err := recordMigration(db, version); err != nil {
				return err
			}
			continue
		}
		if version == "003_trigger_observability.sql" {
			// Aplica coluna a coluna (cada ALTER é independente e idempotente).
			if !hasColumn(db, "triggers", "last_error") {
				if _, err := db.Exec("ALTER TABLE triggers ADD COLUMN last_error TEXT DEFAULT ''"); err != nil {
					return err
				}
			}
			if !hasColumn(db, "triggers", "last_seen_hashes") {
				if _, err := db.Exec("ALTER TABLE triggers ADD COLUMN last_seen_hashes TEXT DEFAULT '[]'"); err != nil {
					return err
				}
			}
			if err := recordMigration(db, version); err != nil {
				return err
			}
			continue
		}
		if version == "006_trigger_intent.sql" {
			if !hasColumn(db, "triggers", "user_intent") {
				if _, err := db.Exec("ALTER TABLE triggers ADD COLUMN user_intent TEXT DEFAULT ''"); err != nil {
					return err
				}
			}
			if !hasColumn(db, "triggers", "search_keywords") {
				if _, err := db.Exec("ALTER TABLE triggers ADD COLUMN search_keywords TEXT DEFAULT ''"); err != nil {
					return err
				}
			}
			if err := recordMigration(db, version); err != nil {
				return err
			}
			continue
		}
		content, err := migrationFS.ReadFile(name)
		if err != nil {
			return err
		}
		if _, err := db.Exec(string(content)); err != nil {
			return err
		}
		if err := recordMigration(db, version); err != nil {
			return err
		}
	}

	if _, err := db.Exec("UPDATE todos SET category = 'geral' WHERE category IS NULL OR category = ''"); err != nil {
		return err
	}
	if _, err := db.Exec("CREATE INDEX IF NOT EXISTS idx_todos_user_category ON todos(user_id, category)"); err != nil {
		return err
	}
	if err := MigratePendingItemsToTodos(db); err != nil {
		return err
	}
	return nil
}
