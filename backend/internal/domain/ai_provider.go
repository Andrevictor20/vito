package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrAIProviderNotFound = errors.New("provedor de IA não encontrado")
	ErrInvalidProviderKey = errors.New("provedor de IA inválido")
)

// ProviderKey identifica um provedor de IA (servidor ou BYOK).
type ProviderKey string

const (
	ProviderKeyServer     ProviderKey = "srv"
	ProviderKeyAnthropic  ProviderKey = "anthropic"
	ProviderKeyGoogle     ProviderKey = "google"
	ProviderKeyOpenAI     ProviderKey = "openai"
	ProviderKeyGroq       ProviderKey = "groq"
	ProviderKeyOpenRouter ProviderKey = "openrouter"
	ProviderKeyCustom     ProviderKey = "custom"
)

const (
	ProviderStatusOK      = "ok"
	ProviderStatusInvalid = "invalid"
)

const (
	EffortAuto = "auto"
	EffortLow  = "low"
	EffortMed  = "med"
	EffortHigh = "high"
)

// IsBYOKProviderKey valida se a chave pertence a um provedor externo suportado no banco.
func IsBYOKProviderKey(k ProviderKey) bool {
	switch k {
	case ProviderKeyAnthropic, ProviderKeyGoogle, ProviderKeyOpenAI,
		ProviderKeyGroq, ProviderKeyOpenRouter, ProviderKeyCustom:
		return true
	default:
		return false
	}
}

// AllProviderCatalogKeys retorna os 7 provedores exibidos no catálogo do app.
func AllProviderCatalogKeys() []ProviderKey {
	return []ProviderKey{
		ProviderKeyServer,
		ProviderKeyAnthropic,
		ProviderKeyGoogle,
		ProviderKeyOpenAI,
		ProviderKeyGroq,
		ProviderKeyOpenRouter,
		ProviderKeyCustom,
	}
}

// ProviderModelInfo descreve um modelo retornado pelo catálogo do provedor e suas capacidades.
type ProviderModelInfo struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Note           string `json:"note,omitempty"`
	SupportsTools  bool   `json:"supports_tools"`
	SupportsVision bool   `json:"supports_vision"`
	Reasoning      bool   `json:"reasoning"`
	QualityTier    int    `json:"quality_tier"`
	MaxContext     int    `json:"max_context"`
}

// UserAIProvider representa um provedor externo conectado pelo usuário (nunca serializa KeyCiphertext em JSON).
type UserAIProvider struct {
	ID              string              `json:"id"`
	UserID          string              `json:"user_id"`
	ProviderKey     ProviderKey         `json:"provider_key"`
	BaseURL         string              `json:"base_url,omitempty"`
	KeyCiphertext   string              `json:"-"`
	KeyLast4        string              `json:"key_last4"`
	Status          string              `json:"status"`
	VerifiedAt      *time.Time          `json:"verified_at,omitempty"`
	ModelsJSON      string              `json:"-"`
	Models          []ProviderModelInfo `json:"models,omitempty"`
	ModelsFetchedAt *time.Time          `json:"models_fetched_at,omitempty"`
	CreatedAt       time.Time           `json:"created_at"`
	UpdatedAt       time.Time           `json:"updated_at"`
}

// UserAIProviderSummary representa o resumo público de um provedor conectado (sem qualquer segredo).
type UserAIProviderSummary struct {
	ID              string              `json:"id"`
	ProviderKey     ProviderKey         `json:"provider_key"`
	BaseURL         string              `json:"base_url,omitempty"`
	KeyLast4        string              `json:"key_last4"`
	Status          string              `json:"status"`
	Connected       bool                `json:"connected"`
	ModelCount      int                 `json:"model_count"`
	VerifiedAt      *time.Time          `json:"verified_at,omitempty"`
	Models          []ProviderModelInfo `json:"models,omitempty"`
	ModelsFetchedAt *time.Time          `json:"models_fetched_at,omitempty"`
}

// ToSummary converte UserAIProvider no DTO público seguro sem expor KeyCiphertext.
func (p *UserAIProvider) ToSummary() UserAIProviderSummary {
	if p == nil {
		return UserAIProviderSummary{}
	}
	models := make([]ProviderModelInfo, len(p.Models))
	copy(models, p.Models)
	return UserAIProviderSummary{
		ID:              p.ID,
		ProviderKey:     p.ProviderKey,
		BaseURL:         p.BaseURL,
		KeyLast4:        p.KeyLast4,
		Status:          p.Status,
		Connected:       true,
		ModelCount:      len(models),
		VerifiedAt:      p.VerifiedAt,
		Models:          models,
		ModelsFetchedAt: p.ModelsFetchedAt,
	}
}

// AIPreferences representa as preferências globais de modelo e esforço de raciocínio do usuário.
type AIPreferences struct {
	DefaultModel  string `json:"default_model"`
	DefaultEffort string `json:"default_effort"`
}

// ModelPreferenceUpdate representa o payload de atualização de preferência de modelo/esforço.
type ModelPreferenceUpdate struct {
	ModelPref  string `json:"model_pref"`
	EffortPref string `json:"effort_pref"`
}

// AIProviderRepository define o contrato de persistência para provedores BYOK de IA.
type AIProviderRepository interface {
	Upsert(ctx context.Context, provider *UserAIProvider) error
	GetByUserAndKey(ctx context.Context, userID string, key ProviderKey) (*UserAIProvider, error)
	ListByUser(ctx context.Context, userID string) ([]UserAIProviderSummary, error)
	UpdateStatus(ctx context.Context, userID string, key ProviderKey, status string) error
	UpdateModels(ctx context.Context, userID string, key ProviderKey, models []ProviderModelInfo, fetchedAt time.Time) error
	Delete(ctx context.Context, userID string, key ProviderKey) error
}
