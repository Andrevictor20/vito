package service

import (
	"context"
	"errors"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/ai/byok"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
)

const (
	verifyTimeoutSeconds  = 10 * time.Second
	modelsCacheMaxAge     = 24 * time.Hour
	connectTestRateLimit  = 5
	connectTestRateWindow = time.Minute
)

var (
	ErrAIProviderRateLimited = errors.New("Muitas tentativas em sequência. Aguarde um minuto e tente novamente.")
	ErrProviderAuthRejected  = errors.New("chave recusada pelo provedor")
)

// ProviderCatalogItem descreve cada provedor exibido na tela #s-ai (servidor + 6 BYOK).
type ProviderCatalogItem struct {
	ProviderKey     domain.ProviderKey         `json:"provider_key"`
	DisplayName     string                     `json:"display_name"`
	Company         string                     `json:"company"`
	Connected       bool                       `json:"connected"`
	Status          string                     `json:"status"`
	BaseURL         string                     `json:"base_url,omitempty"`
	KeyLast4        string                     `json:"key_last4,omitempty"`
	ModelCount      int                        `json:"model_count"`
	VerifiedAt      *time.Time                 `json:"verified_at,omitempty"`
	ModelsFetchedAt *time.Time                 `json:"models_fetched_at,omitempty"`
	Models          []domain.ProviderModelInfo `json:"models,omitempty"`
}

// SelectableModelGroup agrupa modelos selecionáveis no ModelPickerSheet (§5).
type SelectableModelGroup struct {
	ProviderKey domain.ProviderKey         `json:"provider_key"`
	DisplayName string                     `json:"display_name"`
	Models      []domain.ProviderModelInfo `json:"models"`
}

// BotProviderPrefCleaner limpa ou atualiza preferências de provedor/modelo em bots.
type BotProviderPrefCleaner interface {
	ClearProviderPrefs(ctx context.Context, userID, providerKey string) error
	UpdateTriggerModelPref(ctx context.Context, userID, triggerID, modelPref, effortPref string) error
}

// AIProviderService gerencia conexão, verificação, catálogo de modelos e preferências BYOK.
type AIProviderService struct {
	repo             domain.AIProviderRepository
	settingsRepo     domain.AISettingsRepository
	convRepo         *repository.ConversationStoreRepository
	triggerRepo      BotProviderPrefCleaner
	vault            *AIKeyVault
	registry         *UserProviderRegistry
	blockedLocalPort int
	verifyClient     *http.Client
	nowFn            func() time.Time

	rateMu   sync.Mutex
	attempts map[string][]time.Time
}

// NewAIProviderService cria o serviço de provedores BYOK.
func NewAIProviderService(
	repo domain.AIProviderRepository,
	settingsRepo domain.AISettingsRepository,
	convRepo *repository.ConversationStoreRepository,
	triggerRepo BotProviderPrefCleaner,
	vault *AIKeyVault,
	registry *UserProviderRegistry,
	blockedLocalPort int,
) *AIProviderService {
	return &AIProviderService{
		repo:             repo,
		settingsRepo:     settingsRepo,
		convRepo:         convRepo,
		triggerRepo:      triggerRepo,
		vault:            vault,
		registry:         registry,
		blockedLocalPort: blockedLocalPort,
		nowFn:            time.Now,
		attempts:         make(map[string][]time.Time),
	}
}

// SetVerifyHTTPClientForTest injeta um *http.Client para testes determinísticos com httptest.Server.
func (s *AIProviderService) SetVerifyHTTPClientForTest(client *http.Client) {
	s.verifyClient = client
}

// Connect valida formato, verifica chave em /models (timeout 10s), cifra no cofre e persiste.
func (s *AIProviderService) Connect(ctx context.Context, userID string, key domain.ProviderKey, apiKey, baseURL string) (*domain.UserAIProviderSummary, error) {
	if err := s.checkRateLimit(userID); err != nil {
		return nil, err
	}
	if err := ValidateProviderKeyFormat(key, apiKey, baseURL); err != nil {
		return nil, err
	}
	if key == domain.ProviderKeyCustom {
		if _, err := byok.ValidateCustomBaseURL(baseURL, s.blockedLocalPort); err != nil {
			return nil, err
		}
	}

	models, err := s.fetchAndVerifyModels(ctx, key, strings.TrimSpace(apiKey), strings.TrimSpace(baseURL))
	if err != nil {
		return nil, err
	}

	ciphertext, err := s.vault.Seal(userID, key, strings.TrimSpace(apiKey))
	if err != nil {
		return nil, fmt.Errorf("falha ao cifrar chave no cofre: %w", err)
	}

	now := s.nowFn().UTC()
	record := &domain.UserAIProvider{
		UserID:          userID,
		ProviderKey:     key,
		BaseURL:         strings.TrimRight(strings.TrimSpace(baseURL), "/"),
		KeyCiphertext:   ciphertext,
		KeyLast4:        Last4(apiKey),
		Status:          domain.ProviderStatusOK,
		VerifiedAt:      &now,
		Models:          models,
		ModelsFetchedAt: &now,
		CreatedAt:       now,
		UpdatedAt:       now,
	}
	if err := s.repo.Upsert(ctx, record); err != nil {
		return nil, err
	}
	if s.registry != nil {
		s.registry.InvalidateProvider(userID, key)
	}

	summary := record.ToSummary()
	return &summary, nil
}

// Test verifica uma chave já conectada atualizando status ('ok' | 'invalid') e cache de modelos.
func (s *AIProviderService) Test(ctx context.Context, userID string, key domain.ProviderKey) (*domain.UserAIProviderSummary, error) {
	if err := s.checkRateLimit(userID); err != nil {
		return nil, err
	}
	prov, err := s.repo.GetByUserAndKey(ctx, userID, key)
	if err != nil {
		return nil, err
	}
	apiKey, err := s.vault.Open(userID, key, prov.KeyCiphertext)
	if err != nil {
		return nil, fmt.Errorf("falha ao decifrar chave: %w", err)
	}

	models, verifyErr := s.fetchAndVerifyModels(ctx, key, apiKey, prov.BaseURL)
	apiKey = ""
	if verifyErr != nil {
		if errors.Is(verifyErr, ErrProviderAuthRejected) {
			_ = s.repo.UpdateStatus(ctx, userID, key, domain.ProviderStatusInvalid)
			if s.registry != nil {
				s.registry.InvalidateProvider(userID, key)
			}
		}
		return nil, verifyErr
	}

	now := s.nowFn().UTC()
	_ = s.repo.UpdateStatus(ctx, userID, key, domain.ProviderStatusOK)
	_ = s.repo.UpdateModels(ctx, userID, key, models, now)
	if s.registry != nil {
		s.registry.InvalidateProvider(userID, key)
	}

	prov.Status = domain.ProviderStatusOK
	prov.VerifiedAt = &now
	prov.Models = models
	prov.ModelsFetchedAt = &now
	summary := prov.ToSummary()
	return &summary, nil
}

// Remove apaga a chave conectada e limpa preferências que apontavam para esse provedor (AI-07).
func (s *AIProviderService) Remove(ctx context.Context, userID string, key domain.ProviderKey) error {
	if err := s.repo.Delete(ctx, userID, key); err != nil {
		return err
	}
	if s.settingsRepo != nil {
		_ = s.settingsRepo.ClearProviderPrefs(ctx, userID, string(key))
	}
	if s.convRepo != nil {
		_ = s.convRepo.ClearProviderPrefs(ctx, userID, string(key))
	}
	if s.triggerRepo != nil {
		_ = s.triggerRepo.ClearProviderPrefs(ctx, userID, string(key))
	}
	if s.registry != nil {
		s.registry.InvalidateProvider(userID, key)
	}
	return nil
}

// ListProviders retorna o catálogo completo (Servidor do Vito + 6 provedores BYOK) sem expor segredos.
func (s *AIProviderService) ListProviders(ctx context.Context, userID string) ([]ProviderCatalogItem, error) {
	connected, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	byKey := make(map[domain.ProviderKey]domain.UserAIProviderSummary, len(connected))
	for _, c := range connected {
		byKey[c.ProviderKey] = c
	}

	catalog := make([]ProviderCatalogItem, 0, 7)
	for _, pk := range domain.AllProviderCatalogKeys() {
		name, company := providerCatalogMeta(pk)
		if pk == domain.ProviderKeyServer {
			catalog = append(catalog, ProviderCatalogItem{
				ProviderKey: pk,
				DisplayName: name,
				Company:     company,
				Connected:   true,
				Status:      domain.ProviderStatusOK,
				ModelCount:  1,
				Models: []domain.ProviderModelInfo{{
					ID:             "auto",
					Name:           "Vito Auto",
					SupportsTools:  true,
					SupportsVision: true,
					Reasoning:      true,
					QualityTier:    3,
					MaxContext:     1048576,
				}},
			})
			continue
		}
		item := ProviderCatalogItem{
			ProviderKey: pk,
			DisplayName: name,
			Company:     company,
			Status:      "disconnected",
		}
		if c, ok := byKey[pk]; ok {
			filtered := filterChatProviderModels(c.Models)
			item.Connected = true
			item.Status = c.Status
			item.BaseURL = c.BaseURL
			item.KeyLast4 = c.KeyLast4
			item.ModelCount = len(filtered)
			item.VerifiedAt = c.VerifiedAt
			item.ModelsFetchedAt = c.ModelsFetchedAt
			item.Models = filtered
		}
		catalog = append(catalog, item)
	}
	return catalog, nil
}

// GetProviderModels retorna os modelos em cache ou atualiza via API se forceRefresh ou > 24h (§3).
func (s *AIProviderService) GetProviderModels(ctx context.Context, userID string, key domain.ProviderKey, forceRefresh bool) ([]domain.ProviderModelInfo, error) {
	prov, err := s.repo.GetByUserAndKey(ctx, userID, key)
	if err != nil {
		return nil, err
	}
	stale := prov.ModelsFetchedAt == nil || s.nowFn().UTC().Sub(*prov.ModelsFetchedAt) > modelsCacheMaxAge
	if (forceRefresh || stale) && prov.Status == domain.ProviderStatusOK {
		apiKey, openErr := s.vault.Open(userID, key, prov.KeyCiphertext)
		if openErr == nil {
			models, fetchErr := s.fetchAndVerifyModels(ctx, key, apiKey, prov.BaseURL)
			apiKey = ""
			if fetchErr == nil {
				now := s.nowFn().UTC()
				_ = s.repo.UpdateModels(ctx, userID, key, models, now)
				return models, nil
			}
		}
	}
	return prov.Models, nil
}

// ListSelectableModels retorna os grupos de modelos disponíveis (Servidor do Vito + provedores status=='ok').
func (s *AIProviderService) ListSelectableModels(ctx context.Context, userID string) ([]SelectableModelGroup, error) {
	groups := []SelectableModelGroup{{
		ProviderKey: domain.ProviderKeyServer,
		DisplayName: "Servidor do Vito",
		Models: []domain.ProviderModelInfo{{
			ID:             "auto",
			Name:           "Vito Auto",
			Note:           "Usa a cota do servidor e escolhe o melhor modelo para cada tarefa",
			SupportsTools:  true,
			SupportsVision: true,
			Reasoning:      true,
			QualityTier:    3,
			MaxContext:     1048576,
		}},
	}}

	connected, err := s.repo.ListByUser(ctx, userID)
	if err != nil {
		return nil, err
	}
	for _, c := range connected {
		filtered := filterChatProviderModels(c.Models)
		if c.Status != domain.ProviderStatusOK || len(filtered) == 0 {
			continue
		}
		name, _ := providerCatalogMeta(c.ProviderKey)
		groups = append(groups, SelectableModelGroup{
			ProviderKey: c.ProviderKey,
			DisplayName: name,
			Models:      filtered,
		})
	}
	return groups, nil
}

func filterChatProviderModels(models []domain.ProviderModelInfo) []domain.ProviderModelInfo {
	if len(models) == 0 {
		return nil
	}
	out := make([]domain.ProviderModelInfo, 0, len(models))
	for _, m := range models {
		if byok.IsNonChatModelID(m.ID) {
			continue
		}
		out = append(out, m)
	}
	return out
}

func (s *AIProviderService) fetchAndVerifyModels(ctx context.Context, key domain.ProviderKey, apiKey, baseURL string) ([]domain.ProviderModelInfo, error) {
	verifyURL, err := byok.VerifyEndpoint(string(key), baseURL)
	if err != nil {
		return nil, err
	}

	reqCtx, cancel := context.WithTimeout(ctx, verifyTimeoutSeconds)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(reqCtx, http.MethodGet, verifyURL, nil)
	if err != nil {
		return nil, fmt.Errorf("falha ao montar requisição de verificação: %s", byok.RedactSecrets(err.Error()))
	}
	applyVerifyAuthHeader(httpReq, key, apiKey)

	client := s.httpClientForVerify(key)
	resp, err := client.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("não foi possível conectar ao provedor: %s", byok.RedactSecrets(err.Error()))
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(io.LimitReader(resp.Body, byok.DefaultSSRFMaxBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("falha ao ler resposta do provedor: %s", byok.RedactSecrets(err.Error()))
	}

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		name, _ := providerCatalogMeta(key)
		return nil, fmt.Errorf("%w: O %s recusou esta chave. Confira se ela está ativa.", ErrProviderAuthRejected, name)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("provedor retornou HTTP %d: %s", resp.StatusCode, byok.RedactSecrets(strings.TrimSpace(string(body))))
	}

	parsed, err := byok.ParseProviderModels(string(key), body)
	if err != nil {
		return nil, fmt.Errorf("falha ao interpretar catálogo de modelos: %s", byok.RedactSecrets(err.Error()))
	}
	if len(parsed) == 0 && key == domain.ProviderKeyCustom {
		return nil, errors.New("endpoint compatível respondeu sem nenhum modelo de chat")
	}
	out := make([]domain.ProviderModelInfo, 0, len(parsed))
	for _, pm := range parsed {
		caps := byok.LookupModelCapabilities(string(key), pm.ID)
		if pm.QualityTier > 0 {
			caps.QualityTier = pm.QualityTier
		}
		if pm.MaxContext > 0 {
			caps.MaxContext = pm.MaxContext
		}
		out = append(out, domain.ProviderModelInfo{
			ID:             pm.ID,
			Name:           pm.Name,
			Note:           pm.Note,
			SupportsTools:  pm.SupportsTools,
			SupportsVision: pm.SupportsVision,
			Reasoning:      pm.Reasoning,
			QualityTier:    caps.QualityTier,
			MaxContext:     caps.MaxContext,
		})
	}
	return out, nil
}

func (s *AIProviderService) httpClientForVerify(key domain.ProviderKey) *http.Client {
	if s.verifyClient != nil {
		return s.verifyClient
	}
	if key == domain.ProviderKeyCustom {
		return byok.NewSafeHTTPClient(verifyTimeoutSeconds, byok.DefaultSSRFMaxBodyBytes, s.blockedLocalPort)
	}
	return &http.Client{
		Timeout: verifyTimeoutSeconds,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
}

func (s *AIProviderService) checkRateLimit(userID string) error {
	s.rateMu.Lock()
	defer s.rateMu.Unlock()
	now := s.nowFn()
	cutoff := now.Add(-connectTestRateWindow)
	var kept []time.Time
	for _, ts := range s.attempts[userID] {
		if ts.After(cutoff) {
			kept = append(kept, ts)
		}
	}
	if len(kept) >= connectTestRateLimit {
		s.attempts[userID] = kept
		return ErrAIProviderRateLimited
	}
	s.attempts[userID] = append(kept, now)
	return nil
}

func applyVerifyAuthHeader(req *http.Request, key domain.ProviderKey, apiKey string) {
	switch key {
	case domain.ProviderKeyAnthropic:
		req.Header.Set("x-api-key", apiKey)
		req.Header.Set("anthropic-version", "2023-06-01")
	case domain.ProviderKeyGoogle:
		req.Header.Set("x-goog-api-key", apiKey)
	default:
		req.Header.Set("Authorization", "Bearer "+apiKey)
	}
}
