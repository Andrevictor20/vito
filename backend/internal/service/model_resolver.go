package service

import (
	"context"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

const (
	ModelPrefServerAuto = "srv:auto"
)

// ModelResolveRequest descreve o contexto para resolução da precedência de modelo e esforço (§4).
type ModelResolveRequest struct {
	UserID       string
	ThreadID     string
	BotID        string
	Channel      string
	RequireTools bool
	MinLevelIdx  int // usado em fallback após 404/recusa de tools para pular níveis já falhos
}

// ResolvedModel representa o modelo efetivamente selecionado para a chamada ADK.
type ResolvedModel struct {
	VitoLLM           *VitoLLM
	Source            string // "byok" | "server"
	ProviderKey       domain.ProviderKey
	ModelID           string
	DisplayName       string
	Effort            string
	SupportsReasoning bool
	UsedLevel         string // "thread" | "bot" | "default" | "server"
	NextLevelIdx      int
}

// ModelResolver resolve a preferência de modelo (thread -> bot -> padrão -> srv:auto).
type ModelResolver struct {
	providerRepo domain.AIProviderRepository
	settingsRepo domain.AISettingsRepository
	convRepo     *repository.ConversationStoreRepository
	triggerRepo  *repository.TriggerRepositorySQLite
	registry     *UserProviderRegistry
}

// NewModelResolver cria o resolvedor de modelos BYOK vs Servidor do Vito.
func NewModelResolver(
	providerRepo domain.AIProviderRepository,
	settingsRepo domain.AISettingsRepository,
	convRepo *repository.ConversationStoreRepository,
	triggerRepo *repository.TriggerRepositorySQLite,
	registry *UserProviderRegistry,
) *ModelResolver {
	return &ModelResolver{
		providerRepo: providerRepo,
		settingsRepo: settingsRepo,
		convRepo:     convRepo,
		triggerRepo:  triggerRepo,
		registry:     registry,
	}
}

// Resolve seleciona o modelo e esforço aplicáveis ao turno seguindo a precedência da §4.
func (r *ModelResolver) Resolve(ctx context.Context, req ModelResolveRequest) (*ResolvedModel, error) {
	if r == nil {
		return serverAutoResolved(domain.EffortAuto, 3), nil
	}

	var threadPref, threadEffort string
	if r.convRepo != nil && strings.TrimSpace(req.ThreadID) != "" {
		if th, err := r.convRepo.GetThreadByID(ctx, req.ThreadID); err == nil && th != nil && (req.UserID == "" || th.UserID == req.UserID) {
			threadPref = strings.TrimSpace(th.ModelPref)
			threadEffort = strings.TrimSpace(th.EffortPref)
		}
	}

	var botPref, botEffort string
	if r.triggerRepo != nil && strings.TrimSpace(req.BotID) != "" && strings.TrimSpace(req.UserID) != "" {
		if tr, err := r.triggerRepo.GetByID(req.BotID, req.UserID); err == nil && tr != nil {
			botPref = strings.TrimSpace(tr.ModelPref)
			botEffort = strings.TrimSpace(tr.EffortPref)
		}
	}

	var defPref, defEffort string
	if r.settingsRepo != nil && strings.TrimSpace(req.UserID) != "" {
		if st, err := r.settingsRepo.GetSettings(req.UserID); err == nil && st != nil {
			defPref = strings.TrimSpace(st.DefaultModel)
			defEffort = strings.TrimSpace(st.DefaultEffort)
		}
	}

	effort := firstNonEmptyEffort(threadEffort, botEffort, defEffort, domain.EffortAuto)

	// Canal de voz permanece no Vito Auto (servidor) nesta entrega (§4).
	if strings.Contains(strings.ToLower(req.Channel), "voice") {
		return serverAutoResolved(effort, 3), nil
	}

	if r.providerRepo == nil || r.registry == nil || strings.TrimSpace(req.UserID) == "" || req.UserID == "anonymous" {
		return serverAutoResolved(effort, 3), nil
	}

	levels := []struct {
		name string
		pref string
	}{
		{name: "thread", pref: threadPref},
		{name: "bot", pref: botPref},
		{name: "default", pref: defPref},
	}

	providerCache := make(map[domain.ProviderKey]*domain.UserAIProvider)
	for idx, lvl := range levels {
		if idx < req.MinLevelIdx || lvl.pref == "" {
			continue
		}
		if strings.EqualFold(lvl.pref, ModelPrefServerAuto) {
			return serverAutoResolved(effort, idx+1), nil
		}

		pk, modelID, ok := ParseModelPref(lvl.pref)
		if !ok || !domain.IsBYOKProviderKey(pk) {
			continue
		}

		prov, loaded := providerCache[pk]
		if !loaded {
			p, err := r.providerRepo.GetByUserAndKey(ctx, req.UserID, pk)
			if err != nil {
				providerCache[pk] = nil
				continue
			}
			prov = p
			providerCache[pk] = prov
		}
		if prov == nil || prov.Status != domain.ProviderStatusOK {
			continue
		}

		modelInfo, found := findProviderModel(prov.Models, modelID)
		if !found {
			continue
		}
		if req.RequireTools && (modelInfo.QualityTier == 1 || !modelInfo.SupportsTools) {
			continue
		}

		vllm, err := r.registry.GetOrCreate(ctx, req.UserID, prov, modelInfo)
		if err != nil || vllm == nil {
			continue
		}

		return &ResolvedModel{
			VitoLLM:           vllm,
			Source:            "byok",
			ProviderKey:       pk,
			ModelID:           modelInfo.ID,
			DisplayName:       vllm.DisplayName,
			Effort:            effort,
			SupportsReasoning: modelInfo.Reasoning,
			UsedLevel:         lvl.name,
			NextLevelIdx:      idx + 1,
		}, nil
	}

	return serverAutoResolved(effort, len(levels)), nil
}

// EvictModelAndMarkInvalid trata erro 404 (modelo removido pelo provedor) removendo do cache do usuário.
func (r *ModelResolver) EvictModelFromCache(ctx context.Context, userID string, key domain.ProviderKey, modelID string) {
	if r == nil {
		return
	}
	if r.registry != nil {
		r.registry.InvalidateModel(userID, key, modelID)
	}
	if r.providerRepo == nil {
		return
	}
	prov, err := r.providerRepo.GetByUserAndKey(ctx, userID, key)
	if err != nil || prov == nil {
		return
	}
	filtered := make([]domain.ProviderModelInfo, 0, len(prov.Models))
	for _, m := range prov.Models {
		if m.ID != modelID {
			filtered = append(filtered, m)
		}
	}
	if len(filtered) != len(prov.Models) {
		fetched := time.Now().UTC()
		if prov.ModelsFetchedAt != nil {
			fetched = *prov.ModelsFetchedAt
		}
		_ = r.providerRepo.UpdateModels(ctx, userID, key, filtered, fetched)
	}
}

// ParseModelPref divide "<provider_key>:<model_id>" validando ambos os lados.
func ParseModelPref(pref string) (domain.ProviderKey, string, bool) {
	trimmed := strings.TrimSpace(pref)
	if trimmed == "" {
		return "", "", false
	}
	idx := strings.Index(trimmed, ":")
	if idx <= 0 || idx >= len(trimmed)-1 {
		return "", "", false
	}
	pk := domain.ProviderKey(strings.ToLower(strings.TrimSpace(trimmed[:idx])))
	modelID := strings.TrimSpace(trimmed[idx+1:])
	if modelID == "" {
		return "", "", false
	}
	return pk, modelID, true
}

func findProviderModel(models []domain.ProviderModelInfo, modelID string) (domain.ProviderModelInfo, bool) {
	for _, m := range models {
		if m.ID == modelID {
			return m, true
		}
	}
	return domain.ProviderModelInfo{}, false
}

func firstNonEmptyEffort(vals ...string) string {
	for _, v := range vals {
		trimmed := strings.ToLower(strings.TrimSpace(v))
		if trimmed != "" {
			return trimmed
		}
	}
	return domain.EffortAuto
}

func serverAutoResolved(effort string, nextIdx int) *ResolvedModel {
	return &ResolvedModel{
		Source:       "server",
		ProviderKey:  domain.ProviderKeyServer,
		ModelID:      "auto",
		DisplayName:  "Vito Auto",
		Effort:       effort,
		UsedLevel:    "server",
		NextLevelIdx: nextIdx,
	}
}
