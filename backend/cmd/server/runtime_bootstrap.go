package main

import (
	"log"
	"os"
	"runtime/debug"
	"strconv"
	"strings"

	"github.com/andrevmp/vito/backend/internal/platform/config"
	"github.com/andrevmp/vito/backend/internal/platform/database"
)

// resolveBackupDir resolve o diretório de snapshots criptografados do SQLite.
func resolveBackupDir(cfg *config.Config) string {
	if backupDir := os.Getenv("BACKUP_DIR"); backupDir != "" {
		return backupDir
	}
	if cfg != nil && cfg.Environment == "production" {
		return "/app/data/backups"
	}
	return "./backups"
}

// bootstrapDatabaseIntegrity verifica (e repara) o banco SQLite antes de abri-lo.
func bootstrapDatabaseIntegrity(cfg *config.Config) {
	if cfg == nil || cfg.DBPath == ":memory:" || len(cfg.DataEncryptionKey) < 16 {
		return
	}
	backupDir := resolveBackupDir(cfg)
	restored, detail, err := database.RestoreFromSnapshotIfCorrupted(cfg.DBPath, backupDir, cfg.DataEncryptionKey)
	switch {
	case err != nil:
		log.Printf("⚠️ [Vito DB] verificação de integridade falhou: %v", err)
	case restored:
		log.Printf("🛠️ [Vito DB] %s", detail)
	default:
		log.Printf("✅ [Vito DB] integridade do banco verificada (%s).", detail)
	}
}

// applyMemoryLimit define o teto de heap do Go (GOMEMLIMIT) para evitar OOM do PostgreSQL em hosts enxutos.
func applyMemoryLimit() {
	raw := strings.TrimSpace(os.Getenv("GOMEMLIMIT"))
	if raw == "" {
		raw = "256MiB"
	}
	limit, err := parseMemoryLimit(raw)
	if err != nil || limit <= 0 {
		log.Printf("⚠️ [Vito Server] GOMEMLIMIT inválido (%q); usando o padrão de 256MiB", raw)
		limit = 256 << 20
	}
	debug.SetMemoryLimit(limit)
	log.Printf("🧠 [Vito Server] Teto de heap do Go definido: %s (%.0f MB)", raw, float64(limit)/(1024*1024))
}

// parseMemoryLimit converte "256MiB" / "512M" / "1GiB" em bytes.
func parseMemoryLimit(raw string) (int64, error) {
	cleaned := strings.TrimSpace(strings.ToUpper(raw))
	multiplier := int64(1)
	switch {
	case strings.HasSuffix(cleaned, "MIB"):
		multiplier = 1 << 20
		cleaned = strings.TrimSuffix(cleaned, "MIB")
	case strings.HasSuffix(cleaned, "GIB"):
		multiplier = 1 << 30
		cleaned = strings.TrimSuffix(cleaned, "GIB")
	case strings.HasSuffix(cleaned, "MB"):
		multiplier = 1 << 20
		cleaned = strings.TrimSuffix(cleaned, "MB")
	case strings.HasSuffix(cleaned, "GB"):
		multiplier = 1 << 30
		cleaned = strings.TrimSuffix(cleaned, "GB")
	case strings.HasSuffix(cleaned, "M"):
		multiplier = 1 << 20
		cleaned = strings.TrimSuffix(cleaned, "M")
	case strings.HasSuffix(cleaned, "G"):
		multiplier = 1 << 30
		cleaned = strings.TrimSuffix(cleaned, "G")
	}
	value, err := strconv.ParseFloat(strings.TrimSpace(cleaned), 64)
	if err != nil {
		return 0, err
	}
	return int64(value * float64(multiplier)), nil
}
