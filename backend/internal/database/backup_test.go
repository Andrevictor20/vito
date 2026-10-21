package database

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestBackupManager_EncryptedSnapshotRoundtripAndRotation(t *testing.T) {
	tmpDir := t.TempDir()
	dbPath := filepath.Join(tmpDir, "vito.db")
	backupDir := filepath.Join(tmpDir, "backups")

	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	// Insere um registro real para comprovar integridade do snapshot
	_, err = db.Exec(`INSERT INTO users (id, name, email, password_hash, created_at, updated_at) VALUES ('u-bkp-1', 'Andre Backup', 'backup@vito.ai', 'hash123', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`)
	if err != nil {
		t.Fatalf("falha ao inserir usuário no banco: %v", err)
	}

	masterKey := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	mgr, err := NewBackupManager(BackupConfig{
		DB:         db,
		BackupDir:  backupDir,
		MasterKey:  masterKey,
		MaxBackups: 2,
		Interval:   1 * time.Hour,
	})
	if err != nil {
		t.Fatalf("NewBackupManager falhou: %v", err)
	}

	ctx := context.Background()
	encPath1, err := mgr.CreateEncryptedSnapshot(ctx)
	if err != nil {
		t.Fatalf("CreateEncryptedSnapshot 1 falhou: %v", err)
	}

	rawBytes, err := os.ReadFile(encPath1)
	if err != nil {
		t.Fatalf("falha ao ler arquivo de backup criptografado: %v", err)
	}
	if strings.Contains(string(rawBytes), "SQLite format 3") {
		t.Fatal("arquivo de backup NÃO está criptografado (header SQLite em texto claro detectado)")
	}
	if !strings.HasPrefix(string(rawBytes), BackupMagicHeader) {
		t.Fatalf("esperava magic header %q no arquivo criptografado", BackupMagicHeader)
	}

	// Descriptografa e valida que é um banco SQLite íntegro contendo o registro
	decryptedBytes, err := DecryptSnapshot(encPath1, masterKey)
	if err != nil {
		t.Fatalf("DecryptSnapshot falhou: %v", err)
	}
	if !strings.HasPrefix(string(decryptedBytes), "SQLite format 3") {
		t.Fatal("snapshot descriptografado não possui assinatura SQLite válida")
	}

	restoredPath := filepath.Join(tmpDir, "restored.db")
	if err := os.WriteFile(restoredPath, decryptedBytes, 0600); err != nil {
		t.Fatalf("falha ao salvar banco restaurado: %v", err)
	}
	restoredDB, err := Open(restoredPath)
	if err != nil {
		t.Fatalf("falha ao abrir banco restaurado: %v", err)
	}
	defer restoredDB.Close()

	var email string
	if err := restoredDB.QueryRow(`SELECT email FROM users WHERE id = 'u-bkp-1'`).Scan(&email); err != nil {
		t.Fatalf("usuário não encontrado no backup restaurado: %v", err)
	}
	if email != "backup@vito.ai" {
		t.Fatalf("esperava email backup@vito.ai, obteve %s", email)
	}

	// Chave incorreta deve falhar na autenticação GCM
	if _, err := DecryptSnapshot(encPath1, "wrong-master-key-000000000000000000000000000000"); err == nil {
		t.Fatal("DecryptSnapshot deveria falhar com chave incorreta")
	}

	// Testa rotação (MaxBackups = 2): criar mais 2 backups deve manter apenas os 2 mais recentes
	time.Sleep(10 * time.Millisecond)
	if _, err := mgr.CreateEncryptedSnapshot(ctx); err != nil {
		t.Fatalf("CreateEncryptedSnapshot 2 falhou: %v", err)
	}
	time.Sleep(10 * time.Millisecond)
	if _, err := mgr.CreateEncryptedSnapshot(ctx); err != nil {
		t.Fatalf("CreateEncryptedSnapshot 3 falhou: %v", err)
	}

	entries, err := os.ReadDir(backupDir)
	if err != nil {
		t.Fatalf("falha ao listar diretório de backups: %v", err)
	}
	var count int
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".db.enc") {
			count++
		}
	}
	if count != 2 {
		t.Fatalf("esperava exatamente 2 backups retidos após rotação, encontrou %d", count)
	}
}
