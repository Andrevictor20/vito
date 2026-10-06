package config

import (
	"os"
	"strings"
)

// Config armazena as configurações do ambiente do servidor Vito.
type Config struct {
	Port               string
	Environment        string
	DBPath             string
	JWTSecret          string
	GeminiAPIKey       string
	GeminiModel        string
	OpenRouterAPIKey   string
	GroqAPIKey         string
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
}

// Load carrega a configuração a partir de variáveis de ambiente com fallbacks seguros.
func Load() *Config {
	loadEnvFile(".env", "../.env", "./backend/.env")

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

	geminiModel := os.Getenv("GEMINI_MODEL")
	if geminiModel == "" {
		geminiModel = "gemini-2.5-flash"
	}

	googleRedirectURL := os.Getenv("GOOGLE_REDIRECT_URL")
	if googleRedirectURL == "" {
		googleRedirectURL = "https://vito.rasppi.cloud/api/v1/auth/google/callback"
	}

	return &Config{
		Port:               port,
		Environment:        env,
		DBPath:             dbPath,
		JWTSecret:          jwtSecret,
		GeminiAPIKey:       geminiKey,
		GeminiModel:        geminiModel,
		OpenRouterAPIKey:   os.Getenv("OPENROUTER_API_KEY"),
		GroqAPIKey:         os.Getenv("GROQ_API_KEY"),
		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  googleRedirectURL,
	}
}

func loadEnvFile(paths ...string) {
	for _, p := range paths {
		data, err := os.ReadFile(p)
		if err != nil {
			continue
		}
		lines := strings.Split(string(data), "\n")
		for _, line := range lines {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			parts := strings.SplitN(line, "=", 2)
			if len(parts) == 2 {
				key := strings.TrimSpace(parts[0])
				val := strings.TrimSpace(parts[1])
				val = strings.Trim(val, `"'`)
				if os.Getenv(key) == "" {
					_ = os.Setenv(key, val)
				}
			}
		}
		break
	}
}
