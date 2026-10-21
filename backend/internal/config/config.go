package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config armazena as configurações do ambiente do servidor Vito.
type Config struct {
	Port                         string
	Environment                  string
	DBPath                       string
	JWTSecret                    string
	DataEncryptionKey            string
	GeminiAPIKey                 string
	GeminiModel                  string
	OpenRouterAPIKey             string
	OpenRouterModel              string
	GroqAPIKey                   string
	GroqModel                    string
	MistralAPIKey                string
	MistralModel                 string
	GoogleClientID               string
	GoogleClientSecret           string
	GoogleRedirectURL            string
	ShortIoAPIKey                string
	ShortIoDomain                string
	TurnstileSecretKey           string
	PublicBaseURL                string
	CorsAllowedOrigins           string
	SMTPHost                     string
	SMTPPort                     int
	SMTPUser                     string
	SMTPPassword                 string
	SMTPFrom                     string
	EvolutionAPIURL              string
	EvolutionAPIKey              string
	WhatsAppContextScope         string
	WhatsAppContextWindowSize    int
	WhatsAppContextRetentionDays int
	WhatsAppBackfillEnabled      bool
}

// Load carrega a configuração a partir de variáveis de ambiente com fallbacks seguros.
func Load() *Config {
	loadEnvFile(".env", "../.env", "./backend/.env")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8180"
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

	// Modelos de fallback via env (bug §8.7/8): sem IDs hardcoded inválidos.
	// Groq aposentou llama-3.3-70b-versatile em 16/08/2026 (free/dev);
	// default atual: openai/gpt-oss-20b (rápido, JSON object mode, free).
	groqModel := os.Getenv("GROQ_MODEL")
	if groqModel == "" {
		groqModel = "openai/gpt-oss-20b"
	}
	openRouterModel := os.Getenv("OPENROUTER_MODEL")
	if openRouterModel == "" {
		openRouterModel = "nvidia/nemotron-3.5-lightning:free"
	}
	// Mistral La Plateforme (4º elo): default pequeno e rápido (IDs 2512 válidos).
	mistralModel := os.Getenv("MISTRAL_MODEL")
	if mistralModel == "" {
		mistralModel = "ministral-8b-latest"
	}

	dataKey := os.Getenv("DATA_ENCRYPTION_KEY")
	if dataKey == "" {
		dataKey = jwtSecret
	}

	googleRedirectURL := os.Getenv("GOOGLE_REDIRECT_URL")
	if googleRedirectURL == "" {
		googleRedirectURL = "https://vito.rasppi.cloud/api/v1/auth/google/callback"
	}

	shortIoKey := os.Getenv("SHORTIO_API_KEY")
	if shortIoKey == "" {
		shortIoKey = os.Getenv("SHORT_IO_API_KEY")
	}

	shortIoDomain := os.Getenv("SHORTIO_DOMAIN")
	if shortIoDomain == "" {
		shortIoDomain = os.Getenv("SHORT_IO_DOMAIN")
	}

	smtpPort := 587
	if pStr := os.Getenv("SMTP_PORT"); pStr != "" {
		if pVal, err := strconv.Atoi(pStr); err == nil && pVal > 0 {
			smtpPort = pVal
		}
	}
	smtpPass := strings.ReplaceAll(os.Getenv("SMTP_PASS"), " ", "")
	smtpFrom := os.Getenv("SMTP_FROM")
	if smtpFrom == "" && os.Getenv("SMTP_USER") != "" {
		smtpFrom = fmt.Sprintf("Vito Assistente <%s>", os.Getenv("SMTP_USER"))
	}

	return &Config{
		Port:                         port,
		Environment:                  env,
		DBPath:                       dbPath,
		JWTSecret:                    jwtSecret,
		DataEncryptionKey:            dataKey,
		GeminiAPIKey:                 geminiKey,
		GeminiModel:                  geminiModel,
		OpenRouterAPIKey:             os.Getenv("OPENROUTER_API_KEY"),
		OpenRouterModel:              openRouterModel,
		GroqAPIKey:                   os.Getenv("GROQ_API_KEY"),
		GroqModel:                    groqModel,
		MistralAPIKey:                os.Getenv("MISTRAL_API_KEY"),
		MistralModel:                 mistralModel,
		GoogleClientID:               os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:           os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:            googleRedirectURL,
		ShortIoAPIKey:                shortIoKey,
		ShortIoDomain:                shortIoDomain,
		TurnstileSecretKey:           os.Getenv("CLOUDFLARE_TURNSTILE_SECRET_KEY"),
		PublicBaseURL:                getEnvOrDefault("PUBLIC_BASE_URL", "https://vito.rasppi.cloud"),
		CorsAllowedOrigins:           os.Getenv("CORS_ALLOWED_ORIGINS"),
		SMTPHost:                     os.Getenv("SMTP_HOST"),
		SMTPPort:                     smtpPort,
		SMTPUser:                     os.Getenv("SMTP_USER"),
		SMTPPassword:                 smtpPass,
		SMTPFrom:                     smtpFrom,
		EvolutionAPIURL:              getEnvOrDefault("EVOLUTION_API_URL", "http://127.0.0.1:8085"),
		EvolutionAPIKey:              getEnvOrDefault("EVOLUTION_API_KEY", "vito_evo_key_default_change_in_prod"),
		WhatsAppContextScope:         getEnvOrDefault("WHATSAPP_CONTEXT_SCOPE_DEFAULT", "all"),
		WhatsAppContextWindowSize:    getEnvIntDefault("WHATSAPP_CONTEXT_WINDOW_DEFAULT", 12),
		WhatsAppContextRetentionDays: getEnvIntDefault("WHATSAPP_CONTEXT_RETENTION_DAYS", 30),
		WhatsAppBackfillEnabled:      getEnvBoolDefault("WHATSAPP_BACKFILL_ENABLED", true),
	}
}

func getEnvIntDefault(key string, fallback int) int {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(v)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvBoolDefault(key string, fallback bool) bool {
	switch strings.ToLower(strings.TrimSpace(os.Getenv(key))) {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}

func getEnvOrDefault(key, fallback string) string {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	return v
}

// AllowedOrigins resolve as origens CORS: env explícito, PublicBaseURL em produção, * em development.
func (c *Config) AllowedOrigins() []string {
	if strings.TrimSpace(c.CorsAllowedOrigins) != "" {
		var out []string
		for _, o := range strings.Split(c.CorsAllowedOrigins, ",") {
			if trimmed := strings.TrimSpace(o); trimmed != "" {
				out = append(out, trimmed)
			}
		}
		if len(out) > 0 {
			return out
		}
	}
	if !strings.EqualFold(c.Environment, "production") {
		return []string{"*"}
	}
	if strings.TrimSpace(c.PublicBaseURL) != "" {
		return []string{strings.TrimSpace(c.PublicBaseURL)}
	}
	return []string{}
}

// Validate verifica a integridade de segurança da configuração, impedindo que segredos fracos sejam usados em produção.
func (c *Config) Validate() error {
	if strings.EqualFold(c.Environment, "production") {
		if c.JWTSecret == "vito-development-secret-change-in-production-12345" || len(c.JWTSecret) < 32 {
			return errors.New("em ambiente de produção (APP_ENV=production), JWT_SECRET deve ser configurado com no mínimo 32 caracteres seguros")
		}
		if strings.TrimSpace(c.DataEncryptionKey) == "" || len(c.DataEncryptionKey) < 32 {
			return errors.New("em ambiente de produção (APP_ENV=production), DATA_ENCRYPTION_KEY deve ser configurado com no mínimo 32 caracteres seguros")
		}
	}
	return nil
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
