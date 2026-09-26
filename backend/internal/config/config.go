package config

import (
	"os"
)

// Config armazena as configurações do ambiente do servidor Kito.
type Config struct {
	Port             string
	Environment      string
	DBPath           string
	JWTSecret        string
	GeminiAPIKey     string
	OpenRouterAPIKey string
	GroqAPIKey       string
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
		dbPath = "./data/vito.db"
	}

	jwtSecret := os.Getenv("JWT_SECRET")
	if jwtSecret == "" {
		jwtSecret = "vito-development-secret-change-in-production-12345"
	}

	geminiKey := os.Getenv("GEMINI_API_KEY")
	if geminiKey == "" {
		geminiKey = os.Getenv("GOOGLE_AI_API_KEY")
	}

	return &Config{
		Port:             port,
		Environment:      env,
		DBPath:           dbPath,
		JWTSecret:        jwtSecret,
		GeminiAPIKey:     geminiKey,
		OpenRouterAPIKey: os.Getenv("OPENROUTER_API_KEY"),
		GroqAPIKey:       os.Getenv("GROQ_API_KEY"),
	}
}
