package main

import (
	"log"
	"os"

	"github.com/andrevmp/vito/backend/internal/config"
	"github.com/andrevmp/vito/backend/internal/database"
)

// bootstrapDatabaseIntegrity verifica (e repara) o banco SQLite antes de abri-lo.
//
// O SQLite aceita "leaky pages": um arquivo corrompido só falha na ESCRITA que
// toca a página ruim. No Pi isso apareceu como "database disk image is
// malformed (267)" em parte das importações do histórico do WhatsApp — o
// shadow inbox deixava de ser reimportado e o Vito perdia mensagens do
// histórico.
//
// A restauração usa o snapshot criptografado (VACUUM INTO + AES-256-GCM) e
// acontece ANTES de abrir o banco: um banco corrompido faz o SQLite falhar
// justamente nas escritas.
func bootstrapDatabaseIntegrity(cfg *config.Config) {
	if cfg == nil || cfg.DBPath == ":memory:" || len(cfg.DataEncryptionKey) < 16 {
		return
	}
	backupDir := os.Getenv("BACKUP_DIR")
	if backupDir == "" {
		backupDir = "/app/data/backups"
		if cfg.Environment != "production" {
			backupDir = "./backups"
		}
	}

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
