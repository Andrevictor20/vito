package database

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// CheckIntegrityFile verifica a integridade de um banco SQLite no disco.
//
// O `PRAGMA integrity_check` percorre todas as páginas do arquivo: é a única
// forma de detectar corrupção silenciosa (o SQLite aceita leaky pages e só
// falha quando a escrita toca a página ruim — sintoma observado no Pi:
// "database disk image is malformed (267)" em parte das importações).
func CheckIntegrityFile(path string) (bool, string, error) {
	if strings.TrimSpace(path) == "" || path == ":memory:" {
		return true, "banco em memória", nil
	}
	if _, err := os.Stat(path); err != nil {
		if os.IsNotExist(err) {
			// Banco ainda não existe: será criado limpo.
			return true, "banco ainda não existe", nil
		}
		return false, "", err
	}

	// Abre em modo SOMENTE LEITURA e sem WAL: não altera o arquivo examinado.
	dsn := fmt.Sprintf("file:%s?mode=ro&_pragma=busy_timeout(5000)", path)
	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return false, "", err
	}
	defer db.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	rows, err := db.QueryContext(ctx, "PRAGMA integrity_check;")
	if err != nil {
		// "file is not a database" (26) e "database disk image is malformed" (267)
		// significam arquivo corrompido — não erro de I/O.
		if isCorruptionError(err) {
			return false, "arquivo corrompido: " + err.Error(), nil
		}
		return false, "", err
	}
	defer rows.Close()

	var problems []string
	for rows.Next() {
		var line string
		if err := rows.Scan(&line); err != nil {
			return false, "", err
		}
		line = strings.TrimSpace(line)
		if line == "" || strings.EqualFold(line, "ok") {
			continue
		}
		problems = append(problems, line)
	}
	if err := rows.Err(); err != nil {
		if isCorruptionError(err) {
			return false, "arquivo corrompido: " + err.Error(), nil
		}
		return false, "", err
	}
	if len(problems) == 0 {
		return true, "ok", nil
	}
	summary := problems[0]
	if len(problems) > 1 {
		summary = fmt.Sprintf("%s (+%d outras)", summary, len(problems)-1)
	}
	return false, summary, nil
}

// isCorruptionError identifica os erros de corrupção do SQLite.
func isCorruptionError(err error) bool {
	if err == nil {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "not a database") ||
		strings.Contains(msg, "malformed") ||
		strings.Contains(msg, "corrupt") ||
		strings.Contains(msg, "database disk image")
}

// RestoreFromSnapshotIfCorrupted restaura o último snapshot criptografado
// quando o banco no disco está corrompido.
//
// Feito ANTES de abrir o banco (o chamador restaura e só então abre), porque
// um banco corrompido faz o SQLite falhar justamente nas escritas — o que
// impedia o shadow inbox de ser reimportado (o backfill perdia ~30% das
// mensagens e o histórico do Vito ficava incompleto).
//
// Devolve (restaurado, detalhe).
func RestoreFromSnapshotIfCorrupted(dbPath, backupDir, masterKey string) (bool, string, error) {
	ok, summary, err := CheckIntegrityFile(dbPath)
	if err != nil {
		// Não conseguir checar (ex.: permissão) não impede a tentativa de
		// restauração: um snapshot íntegro é sempre preferível a um banco
		// duvidoso.
		summary = "verificação indisponível: " + err.Error()
	}
	if ok {
		return false, summary, nil
	}

	snapshot, snapErr := latestSnapshot(backupDir)
	if snapErr != nil {
		return false, "banco corrompido (" + summary + ") e nenhum snapshot disponível: " + snapErr.Error(), nil
	}

	plain, err := DecryptSnapshot(snapshot, masterKey)
	if err != nil {
		return false, "banco corrompido (" + summary + ") e falha ao decriptografar o snapshot: " + err.Error(), nil
	}

	// Valida o snapshot ANTES de sobrescrever o banco: restaurar um snapshot
	// também corrompido perderia o histórico inteiro.
	tmpCheck := filepath.Join(os.TempDir(), fmt.Sprintf("vito-snapshot-check-%d.db", time.Now().UnixNano()))
	if err := os.WriteFile(tmpCheck, plain, 0600); err != nil {
		return false, "falha ao gravar o snapshot para validação: " + err.Error(), nil
	}
	defer os.Remove(tmpCheck)
	if ok, snapSummary, err := CheckIntegrityFile(tmpCheck); err != nil || !ok {
		return false, fmt.Sprintf("banco corrompido (%s) e o snapshot mais recente também está inválido (%s)", summary, snapSummary), nil
	}

	// Sobrescreve o banco e limpa o WAL (o WAL antigo pertence ao arquivo velho).
	if err := os.WriteFile(dbPath, plain, 0600); err != nil {
		return false, "falha ao restaurar o banco: " + err.Error(), nil
	}
	for _, suffix := range []string{"-wal", "-shm"} {
		_ = os.Remove(dbPath + suffix)
	}

	return true, fmt.Sprintf("banco corrompido (%s) restaurado do snapshot %s", summary, filepath.Base(snapshot)), nil
}

// latestSnapshot devolve o snapshot criptografado mais recente.
func latestSnapshot(backupDir string) (string, error) {
	entries, err := os.ReadDir(backupDir)
	if err != nil {
		return "", err
	}
	var files []string
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".db.enc") {
			continue
		}
		files = append(files, filepath.Join(backupDir, entry.Name()))
	}
	if len(files) == 0 {
		return "", fmt.Errorf("nenhum snapshot em %s", backupDir)
	}
	sort.Strings(files)
	return files[len(files)-1], nil
}
