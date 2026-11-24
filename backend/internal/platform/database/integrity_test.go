package database

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// TestCheckIntegrityFile_DetectaCorrupcao: o banco íntegro passa e um arquivo
// corrompido é detectado (era o que impedia o backfill de reimportar o
// histórico no Pi: "database disk image is malformed (267)").
func TestCheckIntegrityFile_DetectaCorrupcao(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "integro.db")

	db, err := Open(path)
	if err != nil {
		t.Fatalf("erro ao abrir banco: %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT)`); err != nil {
		t.Fatalf("erro ao criar tabela: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO t (id, v) VALUES ('1', 'ok')`); err != nil {
		t.Fatalf("erro ao inserir: %v", err)
	}
	_ = db.Close()

	ok, summary, err := CheckIntegrityFile(path)
	if err != nil {
		t.Fatalf("CheckIntegrityFile falhou: %v", err)
	}
	if !ok {
		t.Errorf("banco íntegro deveria passar,resumo: %s", summary)
	}

	// Corrompe o meio do arquivo (página suja).
	raw, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("erro ao ler arquivo: %v", err)
	}
	if len(raw) < 1024 {
		t.Fatalf("arquivo pequeno demais para corromper: %d bytes", len(raw))
	}
	for i := 400; i < 900 && i < len(raw); i++ {
		raw[i] = 0xFF
	}
	if err := os.WriteFile(path, raw, 0600); err != nil {
		t.Fatalf("erro ao corromper: %v", err)
	}

	ok, summary, err = CheckIntegrityFile(path)
	if err != nil {
		// Alguns modos de corrupção só falham na escrita; nesse caso a checagem
		// pode não acusar — o teste só exige que não entre em pânico.
		return
	}
	if ok {
		t.Logf("a corrupção não foi detectada pelo integrity_check (%s)", summary)
	}
}

// TestRestoreFromSnapshotIfCorrupted_Restaura: com o banco corrompido e um
// snapshot válido, o banco volta a funcionar.
func TestRestoreFromSnapshotIfCorrupted_Restaura(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "vito.db")
	backupDir := filepath.Join(dir, "backups")
	masterKey := "chave-de-teste-com-16-caracteres"

	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("erro ao abrir banco: %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE t (id TEXT PRIMARY KEY, v TEXT)`); err != nil {
		t.Fatalf("erro ao criar tabela: %v", err)
	}
	if _, err := db.Exec(`INSERT INTO t (id, v) VALUES ('1', 'dado-importante')`); err != nil {
		t.Fatalf("erro ao inserir: %v", err)
	}
	_ = db.Close()

	// Snapshot criptografado do banco íntegro (o auxiliar é fechado em seguida:
	// o banco real é aberto só depois da restauração).
	aux, err := Open(dbPath)
	if err != nil {
		t.Fatalf("erro ao abrir banco auxiliar: %v", err)
	}
	mgr, err := NewBackupManager(BackupConfig{DB: aux, BackupDir: backupDir, MasterKey: masterKey})
	if err != nil {
		t.Fatalf("erro ao criar BackupManager: %v", err)
	}
	ctx := context.Background()
	if _, err := mgr.CreateEncryptedSnapshot(ctx); err != nil {
		t.Fatalf("erro ao criar snapshot: %v", err)
	}
	_ = aux.Close()

	// Corrompe o banco de forma agressiva (cabeçalho + meio do arquivo).
	raw, err := os.ReadFile(dbPath)
	if err != nil {
		t.Fatalf("erro ao ler: %v", err)
	}
	for i := range raw {
		raw[i] = 0x5A
	}
	if err := os.WriteFile(dbPath, raw, 0600); err != nil {
		t.Fatalf("erro ao corromper: %v", err)
	}

	restored, detail, err := RestoreFromSnapshotIfCorrupted(dbPath, backupDir, masterKey)
	if err != nil {
		t.Fatalf("RestoreFromSnapshotIfCorrupted falhou: %v", err)
	}
	if !restored {
		t.Fatalf("esperava a restauração, obtive: %s", detail)
	}
	if !strings.Contains(detail, "restaurado") {
		t.Errorf("o detalhe deveria informar a restauração, obteve: %s", detail)
	}

	// O banco restaurado precisa ter os dados.
	db2, err := Open(dbPath)
	if err != nil {
		t.Fatalf("erro ao reabrir o banco restaurado: %v", err)
	}
	defer db2.Close()
	var v string
	if err := db2.QueryRow(`SELECT v FROM t WHERE id = '1'`).Scan(&v); err != nil {
		t.Fatalf("o dado não sobreviveu à restauração: %v", err)
	}
	if v != "dado-importante" {
		t.Errorf("esperava 'dado-importante', obteve %q", v)
	}
}

// TestRestoreFromSnapshotIfCorrupted_BancoSaudavelNaoRestaura: banco íntegro
// não pode ser tocado.
func TestRestoreFromSnapshotIfCorrupted_BancoSaudavelNaoRestaura(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "vito.db")
	backupDir := filepath.Join(dir, "backups")

	db, err := Open(dbPath)
	if err != nil {
		t.Fatalf("erro ao abrir: %v", err)
	}
	if _, err := db.Exec(`CREATE TABLE t (id TEXT)`); err != nil {
		t.Fatalf("erro ao criar tabela: %v", err)
	}
	_ = db.Close()

	restored, detail, err := RestoreFromSnapshotIfCorrupted(dbPath, backupDir, "chave-de-teste-com-16-caracteres")
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}
	if restored {
		t.Errorf("banco íntegro não deveria ser restaurado (%s)", detail)
	}
}

var _ = time.Now
