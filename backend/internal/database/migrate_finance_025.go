package database

import "database/sql"

// applyFinanceByokBackupMigration aplica a 025 de forma idempotente garantindo
// a tabela de backup opaco BYOK cifrado no cliente sem sobrescrever registros existentes.
func applyFinanceByokBackupMigration(db *sql.DB, scriptPath string) error {
	content, err := migrationFS.ReadFile(scriptPath)
	if err != nil {
		return err
	}
	if _, err := db.Exec(string(content)); err != nil {
		return err
	}
	return nil
}
