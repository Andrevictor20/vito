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

// runVersionedMigrations aplica migrações SQL versionadas em ordem lexicográfica (BACK-03).
func runVersionedMigrations(db *sql.DB) error {
	if err := ensureMigrationsTable(db); err != nil {
		return err
	}
	applied, err := appliedVersions(db)
	if err != nil {
		return err
	}

	for _, name := range orderedMigrations() {
		version := name[len("migrations/"):]
		if applied[version] {
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

	if err := MigratePendingItemsToTodos(db); err != nil {
		return err
	}
	return nil
}
