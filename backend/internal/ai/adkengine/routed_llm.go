package adkengine

import (
	"context"
	"fmt"
	"iter"
	"strings"
	"sync"
	"time"

	"google.golang.org/adk/v2/model"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

type turnContextKey struct{}

// TurnExecutionMeta armazena metadados de roteamento, streaming e estado por requisição no contexto Go.
type TurnExecutionMeta struct {
	UserID            string
	ThreadID          string
	TurnID            string
	BotID             string
	BotActionPolicies map[string]domain.ActionPolicy
	Channel           string
	FocusMode         string
	Effort            string
	AgentName         string
	OnDelta           func(ai.StreamDelta) error
	Mu                sync.Mutex
	CredentialSource  string
	ProviderKey       string
	ProviderUsed      string
	ModelUsed         string
	ModelDisplayName  string
	FallbackNotice    string
	FallbackReason    string
	TokensIn          int
	TokensOut         int
	FallbackUsed      bool
}

// WithTurnExecutionMeta anexa metadados do turno ao context.Context.
func WithTurnExecutionMeta(ctx context.Context, meta *TurnExecutionMeta) context.Context {
	return context.WithValue(ctx, turnContextKey{}, meta)
}

// TurnExecutionMetaFromContext recupera os metadados do turno do context.Context.
func TurnExecutionMetaFromContext(ctx context.Context) *TurnExecutionMeta {
	if ctx == nil {
		return nil
	}
	if v, ok := ctx.Value(turnContextKey{}).(*TurnExecutionMeta); ok {
		return v
	}
	return nil
}

// ServerPoolEntry representa um provedor nativo ADK v2 no pool do servidor.
type ServerPoolEntry struct {
	ProviderKey string
	DisplayName string
	ModelID     string
	Tier        int
	LLM         model.LLM
}

// RoutedLLM implementa google.golang.org/adk/v2/model.LLM integrando ModelResolver (BYOK)
// e ServerPool nativo ADK v2 (Sticky Thread + failover automático).
type RoutedLLM struct {
	serverPool    []ServerPoolEntry
	stickyMu      sync.RWMutex
	stickyThreads map[string]string
	defaultModel  string
	resolver      *service.ModelResolver
	providerRepo  domain.AIProviderRepository
	registry      *service.UserProviderRegistry
	traceRecorder ai.TraceRecorder
	backoff       time.Duration
}

// NewRoutedLLM cria uma instância de model.LLM configurada com os provedores do ServerPool do Vito.
func NewRoutedLLM(entries ...ServerPoolEntry) *RoutedLLM {
	r := &RoutedLLM{
		stickyThreads: make(map[string]string),
		defaultModel:  "gemini-2.5-flash",
	}
	if len(entries) > 0 {
		r.SetServerPool(entries)
	}
	return r
}

// SetServerPool configura os modelos nativos ADK v2 do servidor (Gemini + OpenRouter + Groq).
func (r *RoutedLLM) SetServerPool(entries []ServerPoolEntry) {
	r.serverPool = append([]ServerPoolEntry(nil), entries...)
	if len(r.serverPool) > 0 && strings.TrimSpace(r.serverPool[0].ModelID) != "" {
		r.defaultModel = r.serverPool[0].ModelID
	}
}

// ConfigureBYOK conecta ModelResolver, repositório, registry LRU e TraceRecorder ao RoutedLLM.
func (r *RoutedLLM) ConfigureBYOK(
	resolver *service.ModelResolver,
	providerRepo domain.AIProviderRepository,
	registry *service.UserProviderRegistry,
	traceRecorder ai.TraceRecorder,
) {
	r.resolver = resolver
	r.providerRepo = providerRepo
	r.registry = registry
	r.traceRecorder = traceRecorder
}

// SetRetryBackoffForTest configura o backoff de 429/5xx em testes determinísticos.
func (r *RoutedLLM) SetRetryBackoffForTest(d time.Duration) {
	r.backoff = d
}

// Name retorna o identificador do modelo padrão para o ADK.
func (r *RoutedLLM) Name() string {
	return r.defaultModel
}

// GenerateContent executa a chamada ao modelo selecionado (BYOK ou pool do servidor) com failover transparente (COG-02).
func (r *RoutedLLM) GenerateContent(ctx context.Context, req *model.LLMRequest, stream bool) iter.Seq2[*model.LLMResponse, error] {
	return func(yield func(*model.LLMResponse, error) bool) {
		meta := TurnExecutionMetaFromContext(ctx)
		if r.tryGenerateBYOK(ctx, req, stream, meta, yield) {
			return
		}
		if len(r.serverPool) > 0 {
			r.generateFromServerPool(ctx, req, stream, meta, yield)
			return
		}
		yield(nil, fmt.Errorf("nenhum provedor de IA configurado no RoutedLLM"))
	}
}
