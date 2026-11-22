package service

import (
	"context"
	"errors"
	"strings"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// GetPreferences retorna default_model e default_effort do usuário.
func (s *AIProviderService) GetPreferences(ctx context.Context, userID string) (*domain.AIPreferences, error) {
	return s.settingsRepo.GetPreferences(ctx, userID)
}

// UpdatePreferences atualiza o modelo e esforço padrão do usuário.
func (s *AIProviderService) UpdatePreferences(ctx context.Context, userID, defaultModel, defaultEffort string) (*domain.AIPreferences, error) {
	cleanModel := strings.TrimSpace(defaultModel)
	if err := s.validateModelPreference(ctx, userID, cleanModel); err != nil {
		return nil, err
	}
	cleanEffort := normalizePrefEffort(defaultEffort)
	if err := s.settingsRepo.UpdatePreferences(ctx, userID, cleanModel, cleanEffort); err != nil {
		return nil, err
	}
	return &domain.AIPreferences{DefaultModel: cleanModel, DefaultEffort: cleanEffort}, nil
}

// UpdateThreadModelPref atualiza a preferência de modelo/esforço da conversa.
func (s *AIProviderService) UpdateThreadModelPref(ctx context.Context, userID, threadID, modelPref, effortPref string) error {
	cleanModel := strings.TrimSpace(modelPref)
	if err := s.validateModelPreference(ctx, userID, cleanModel); err != nil {
		return err
	}
	return s.convRepo.UpdateThreadModelPref(ctx, userID, threadID, cleanModel, normalizePrefEffort(effortPref))
}

// UpdateTriggerModelPref atualiza a preferência de modelo/esforço do bot/trigger.
func (s *AIProviderService) UpdateTriggerModelPref(ctx context.Context, userID, triggerID, modelPref, effortPref string) error {
	cleanModel := strings.TrimSpace(modelPref)
	if err := s.validateModelPreference(ctx, userID, cleanModel); err != nil {
		return err
	}
	return s.triggerRepo.UpdateTriggerModelPref(ctx, userID, triggerID, cleanModel, normalizePrefEffort(effortPref))
}

func (s *AIProviderService) validateModelPreference(ctx context.Context, userID, pref string) error {
	if pref == "" || strings.EqualFold(pref, ModelPrefServerAuto) {
		return nil
	}
	pk, modelID, ok := ParseModelPref(pref)
	if !ok || !domain.IsBYOKProviderKey(pk) {
		return errors.New("preferência de modelo inválida (use '<provedor>:<modelo>' ou 'srv:auto')")
	}
	prov, err := s.repo.GetByUserAndKey(ctx, userID, pk)
	if err != nil || prov == nil || prov.Status != domain.ProviderStatusOK {
		return errors.New("provedor selecionado não está conectado e ativo")
	}
	if _, found := findProviderModel(prov.Models, modelID); !found {
		return errors.New("modelo não encontrado no catálogo do provedor")
	}
	return nil
}

func normalizePrefEffort(effort string) string {
	switch strings.ToLower(strings.TrimSpace(effort)) {
	case domain.EffortLow:
		return domain.EffortLow
	case domain.EffortMed, "medium":
		return domain.EffortMed
	case domain.EffortHigh:
		return domain.EffortHigh
	default:
		return domain.EffortAuto
	}
}

// ProviderDisplayName retorna o nome amigável do catálogo para um ProviderKey.
func ProviderDisplayName(pk domain.ProviderKey) string {
	name, _ := providerCatalogMeta(pk)
	return name
}

func providerCatalogMeta(pk domain.ProviderKey) (name, company string) {
	switch pk {
	case domain.ProviderKeyServer:
		return "Servidor do Vito", "Cota do servidor"
	case domain.ProviderKeyAnthropic:
		return "Claude", "Anthropic"
	case domain.ProviderKeyGoogle:
		return "Gemini", "Google"
	case domain.ProviderKeyOpenAI:
		return "OpenAI", "OpenAI"
	case domain.ProviderKeyGroq:
		return "Groq", "Groq"
	case domain.ProviderKeyOpenRouter:
		return "OpenRouter", "OpenRouter"
	case domain.ProviderKeyCustom:
		return "Endpoint compatível", "OpenAI-compat"
	default:
		return string(pk), string(pk)
	}
}
