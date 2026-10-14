package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Open conecta ao banco SQLite, aplica pragmas de performance e executa migrações.
func Open(dbPath string) (*sql.DB, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("falha ao criar diretório do banco %s: %w", dir, err)
	}

	// Opção A (escalável): WAL permite N leitores + 1 escritor; _txlock=immediate
	// serializa o início das escritas e o retry com backoff absorve o resíduo.
	dsn := fmt.Sprintf("%s?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=foreign_keys(ON)&_pragma=synchronous(NORMAL)&_txlock=immediate", dbPath)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("falha ao abrir conexão sqlite: %w", err)
	}

	if dbPath == ":memory:" {
		db.SetMaxOpenConns(1)
	} else {
		// Pool de leitores livres; escritas serializam via _txlock + retry.
		// Se o teto de 1 escritor estourar no futuro, a troca para Postgres é
		// plugável (repositórios falam via interfaces de domínio).
		db.SetMaxOpenConns(10)
		db.SetMaxIdleConns(4)
	}

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("falha no ping do sqlite: %w", err)
	}

	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("falha ao executar migrações: %w", err)
	}

	return db, nil
}

func runMigrations(db *sql.DB) error {
	// BACK-03: migracoes versionadas em migrations/*.sql (embed) com rastreio.
	// Bases legadas sao carimbadas como migradas (schema equivalente).
	return runVersionedMigrations(db)
}
