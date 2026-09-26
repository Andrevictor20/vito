package config

import (
	"os"
)

// Config armazena as configurações do ambiente do servidor Kito.
type Config struct {
	Port        string
	Environment string
	DBPath      string
}

// Load carrega a configuração a partir de variáveis de ambiente com fallbacks seguros.
func Load() *Config {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	env := os.Getenv("APP_ENV")
	if env == "" {
		env = "development"
	}

	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/kito.db"
	}

	return &Config{
		Port:        port,
		Environment: env,
		DBPath:      dbPath,
	}
}
