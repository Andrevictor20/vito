package config_test

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/config"
)

func TestConfig_Validate(t *testing.T) {
	// 1. Em desenvolvimento, default é aceito
	cfgDev := &config.Config{
		Environment: "development",
		JWTSecret:   "vito-development-secret-change-in-production-12345",
	}
	if err := cfgDev.Validate(); err != nil {
		t.Errorf("esperava sucesso em desenvolvimento, mas obteve: %v", err)
	}

	// 2. Em produção com chave default -> DEVE falhar
	cfgProdDefault := &config.Config{
		Environment: "production",
		JWTSecret:   "vito-development-secret-change-in-production-12345",
	}
	if err := cfgProdDefault.Validate(); err == nil {
		t.Error("esperava erro ao usar JWT_SECRET default em produção, mas passou")
	}

	// 3. Em produção com chave curta (< 32 chars) -> DEVE falhar
	cfgProdShort := &config.Config{
		Environment: "production",
		JWTSecret:   "short-secret-123",
	}
	if err := cfgProdShort.Validate(); err == nil {
		t.Error("esperava erro ao usar JWT_SECRET curto em produção, mas passou")
	}

	// 4. Em produção com chave robusta (>= 32 chars) -> DEVE passar
	cfgProdRobust := &config.Config{
		Environment:       "production",
		JWTSecret:         "super-strong-robust-random-key-with-over-32-chars!",
		DataEncryptionKey: "another-strong-robust-key-with-over-32-chars!!",
	}
	if err := cfgProdRobust.Validate(); err != nil {
		t.Errorf("esperava sucesso com chave robusta em produção, mas obteve: %v", err)
	}

	// 5. Em produção sem DATA_ENCRYPTION_KEY -> DEVE falhar
	cfgProdNoData := &config.Config{
		Environment: "production",
		JWTSecret:   "super-strong-robust-random-key-with-over-32-chars!",
	}
	if err := cfgProdNoData.Validate(); err == nil {
		t.Error("esperava erro sem DATA_ENCRYPTION_KEY em produção, mas passou")
	}
}

func TestConfig_AllowedOrigins(t *testing.T) {
	dev := &config.Config{Environment: "development"}
	if got := dev.AllowedOrigins(); len(got) != 1 || got[0] != "*" {
		t.Errorf("dev deveria liberar *, veio %v", got)
	}

	env := &config.Config{Environment: "production", CorsAllowedOrigins: "https://a.com, https://b.com"}
	if got := env.AllowedOrigins(); len(got) != 2 {
		t.Errorf("env explícito deveria vencer, veio %v", got)
	}

	pub := &config.Config{Environment: "production", PublicBaseURL: "https://vito.rasppi.cloud"}
	if got := pub.AllowedOrigins(); len(got) != 1 || got[0] != "https://vito.rasppi.cloud" {
		t.Errorf("produção deveria cair para PUBLIC_BASE_URL, veio %v", got)
	}
}

func TestConfig_GroqDefaultModel(t *testing.T) {
	t.Setenv("GROQ_MODEL", "")
	cfg := config.Load()
	if cfg.GroqModel != "qwen/qwen3.8-27b" {
		t.Errorf("default Groq deveria ser qwen/qwen3.8-27b, veio %q", cfg.GroqModel)
	}

	t.Setenv("GROQ_MODEL", "custom/model")
	cfg2 := config.Load()
	if cfg2.GroqModel != "custom/model" {
		t.Errorf("env GROQ_MODEL deveria prevalecer, veio %q", cfg2.GroqModel)
	}
}

func TestConfig_MistralDefaultModel(t *testing.T) {
	t.Setenv("MISTRAL_API_KEY", "test-key")
	t.Setenv("MISTRAL_MODEL", "")
	cfg := config.Load()
	if cfg.MistralAPIKey != "test-key" {
		t.Errorf("MISTRAL_API_KEY deveria carregar, veio %q", cfg.MistralAPIKey)
	}
	if cfg.MistralModel != "ministral-8b-latest" {
		t.Errorf("default Mistral deveria ser ministral-8b-latest, veio %q", cfg.MistralModel)
	}
}
