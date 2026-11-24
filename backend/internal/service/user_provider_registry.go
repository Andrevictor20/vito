package service

import (
	"container/list"
	"context"
	"errors"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/ai/byok"
	"net/http"
	"strings"
	"sync"
	"time"

	"google.golang.org/adk/v2/model"

	"github.com/andrevmp/vito/backend/internal/domain"
)

const (
	defaultRegistryCapacity = 32
	defaultRegistryTTL      = 30 * time.Minute
)

// LLMBuildSpec descreve os parâmetros para instanciar um adk/v2/model.LLM por usuário.
type LLMBuildSpec struct {
	ProviderKey       domain.ProviderKey
	ModelID           string
	BaseURL           string
	APIKey            string
	SupportsReasoning bool
	SupportsTools     bool
	HTTPClient        *http.Client
}

// LLMFactory abstrai a criação de adaptadores model.LLM (implementado em adkengine para evitar ciclo).
type LLMFactory interface {
	BuildLLM(ctx context.Context, spec LLMBuildSpec) (model.LLM, error)
}

// VitoLLM combina model.LLM com metadados de capacidade e origem BYOK.
type VitoLLM struct {
	LLM            model.LLM
	ProviderKey    domain.ProviderKey
	ModelID        string
	DisplayName    string
	SupportsTools  bool
	SupportsVision bool
	Reasoning      bool
	QualityTier    int
	MaxContext     int
}

type registryCacheEntry struct {
	key       string
	userID    string
	provider  domain.ProviderKey
	modelID   string
	vitoLLM   *VitoLLM
	createdAt time.Time
	elem      *list.Element
}

// UserProviderRegistry mantém cache LRU (32 itens, TTL 30m) de instâncias model.LLM por usuário.
type UserProviderRegistry struct {
	vault            *AIKeyVault
	factory          LLMFactory
	repo             domain.AIProviderRepository
	capacity         int
	ttl              time.Duration
	blockedLocalPort int
	nowFn            func() time.Time
	testHTTPClient   *http.Client

	mu      sync.Mutex
	entries map[string]*registryCacheEntry
	lru     *list.List
}

// NewUserProviderRegistry cria o registro LRU+TTL de instâncias model.LLM BYOK.
func NewUserProviderRegistry(
	vault *AIKeyVault,
	factory LLMFactory,
	repo domain.AIProviderRepository,
	blockedLocalPort int,
) *UserProviderRegistry {
	return &UserProviderRegistry{
		vault:            vault,
		factory:          factory,
		repo:             repo,
		capacity:         defaultRegistryCapacity,
		ttl:              defaultRegistryTTL,
		blockedLocalPort: blockedLocalPort,
		nowFn:            time.Now,
		entries:          make(map[string]*registryCacheEntry),
		lru:              list.New(),
	}
}

// SetTTLForTest permite configurar o TTL do cache em testes determinísticos.
func (r *UserProviderRegistry) SetTTLForTest(ttl time.Duration) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if ttl > 0 {
		r.ttl = ttl
	}
}

// SetHTTPClientForTest injeta um *http.Client para rotear chamadas de provedores não-custom em testes.
func (r *UserProviderRegistry) SetHTTPClientForTest(client *http.Client) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.testHTTPClient = client
}

// GetOrCreate retorna uma instância cacheada de VitoLLM ou decifra a chave no cofre e instancia uma nova.
func (r *UserProviderRegistry) GetOrCreate(
	ctx context.Context,
	userID string,
	provider *domain.UserAIProvider,
	info domain.ProviderModelInfo,
) (*VitoLLM, error) {
	if r == nil || r.vault == nil || r.factory == nil {
		return nil, errors.New("UserProviderRegistry não configurado")
	}
	if provider == nil || strings.TrimSpace(userID) == "" || strings.TrimSpace(info.ID) == "" {
		return nil, errors.New("parâmetros inválidos para instanciar modelo do usuário")
	}

	cacheKey := registryCacheKey(userID, provider.ProviderKey, info.ID)
	now := r.nowFn()

	r.mu.Lock()
	if entry, ok := r.entries[cacheKey]; ok {
		if now.Sub(entry.createdAt) < r.ttl {
			r.lru.MoveToFront(entry.elem)
			vllm := entry.vitoLLM
			r.mu.Unlock()
			return vllm, nil
		}
		r.removeLocked(entry)
	}
	r.mu.Unlock()

	plaintextKey, err := r.vault.Open(userID, provider.ProviderKey, provider.KeyCiphertext)
	if err != nil {
		return nil, fmt.Errorf("falha ao abrir chave no cofre: %w", err)
	}

	var httpClient *http.Client
	if provider.ProviderKey == domain.ProviderKeyCustom {
		if _, err := byok.ValidateCustomBaseURL(provider.BaseURL, r.blockedLocalPort); err != nil {
			return nil, err
		}
		httpClient = byok.NewSafeHTTPClient(byok.DefaultSSRFTimeout, byok.DefaultSSRFMaxBodyBytes, r.blockedLocalPort)
	} else {
		r.mu.Lock()
		httpClient = r.testHTTPClient
		r.mu.Unlock()
	}

	spec := LLMBuildSpec{
		ProviderKey:       provider.ProviderKey,
		ModelID:           info.ID,
		BaseURL:           provider.BaseURL,
		APIKey:            plaintextKey,
		SupportsReasoning: info.Reasoning,
		SupportsTools:     info.SupportsTools,
		HTTPClient:        httpClient,
	}
	plaintextKey = ""

	llm, err := r.factory.BuildLLM(ctx, spec)
	spec.APIKey = ""
	if err != nil {
		return nil, err
	}

	display := strings.TrimSpace(info.Name)
	if display == "" {
		display = info.ID
	}
	vllm := &VitoLLM{
		LLM:            llm,
		ProviderKey:    provider.ProviderKey,
		ModelID:        info.ID,
		DisplayName:    display,
		SupportsTools:  info.SupportsTools,
		SupportsVision: info.SupportsVision,
		Reasoning:      info.Reasoning,
		QualityTier:    info.QualityTier,
		MaxContext:     info.MaxContext,
	}

	r.mu.Lock()
	defer r.mu.Unlock()
	if existing, ok := r.entries[cacheKey]; ok {
		r.removeLocked(existing)
	}
	entry := &registryCacheEntry{
		key:       cacheKey,
		userID:    userID,
		provider:  provider.ProviderKey,
		modelID:   info.ID,
		vitoLLM:   vllm,
		createdAt: r.nowFn(),
	}
	entry.elem = r.lru.PushFront(entry)
	r.entries[cacheKey] = entry
	for r.lru.Len() > r.capacity {
		oldest := r.lru.Back()
		if oldest == nil {
			break
		}
		if oldEntry, ok := oldest.Value.(*registryCacheEntry); ok {
			r.removeLocked(oldEntry)
		}
	}
	return vllm, nil
}

// InvalidateUser remove todas as instâncias em cache de um usuário.
func (r *UserProviderRegistry) InvalidateUser(userID string) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, entry := range r.entries {
		if entry.userID == userID {
			r.removeLocked(entry)
		}
	}
}

// InvalidateProvider remove todas as instâncias em cache de um provedor do usuário.
func (r *UserProviderRegistry) InvalidateProvider(userID string, key domain.ProviderKey) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, entry := range r.entries {
		if entry.userID == userID && entry.provider == key {
			r.removeLocked(entry)
		}
	}
}

// InvalidateModel remove um modelo específico do cache do usuário.
func (r *UserProviderRegistry) InvalidateModel(userID string, key domain.ProviderKey, modelID string) {
	if r == nil {
		return
	}
	cacheKey := registryCacheKey(userID, key, modelID)
	r.mu.Lock()
	defer r.mu.Unlock()
	if entry, ok := r.entries[cacheKey]; ok {
		r.removeLocked(entry)
	}
}

// MarkToolsUnsupported marca supports_tools=false em cache e no catálogo persistido quando um modelo rejeitar tools.
func (r *UserProviderRegistry) MarkToolsUnsupported(ctx context.Context, userID string, key domain.ProviderKey, modelID string) {
	if r == nil {
		return
	}
	r.InvalidateModel(userID, key, modelID)
	if r.repo == nil {
		return
	}
	prov, err := r.repo.GetByUserAndKey(ctx, userID, key)
	if err != nil || prov == nil {
		return
	}
	changed := false
	for i := range prov.Models {
		if prov.Models[i].ID == modelID && prov.Models[i].SupportsTools {
			prov.Models[i].SupportsTools = false
			changed = true
		}
	}
	if changed {
		fetched := time.Now().UTC()
		if prov.ModelsFetchedAt != nil {
			fetched = *prov.ModelsFetchedAt
		}
		_ = r.repo.UpdateModels(ctx, userID, key, prov.Models, fetched)
	}
}

func (r *UserProviderRegistry) removeLocked(entry *registryCacheEntry) {
	if entry == nil {
		return
	}
	delete(r.entries, entry.key)
	if entry.elem != nil {
		r.lru.Remove(entry.elem)
	}
}

func registryCacheKey(userID string, key domain.ProviderKey, modelID string) string {
	return userID + "|" + string(key) + "|" + modelID
}
