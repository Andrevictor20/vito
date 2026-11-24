package adkengine

import (
	"context"
	"fmt"
	"iter"
	"strings"
	"sync"
	"time"

	"google.golang.org/adk/v2/model"
	"google.golang.org/genai"

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
	AgentName        string
	OnDelta          func(ai.StreamDelta) error
	Mu               sync.Mutex
	CredentialSource string
	ProviderKey      string
	ProviderUsed     string
	ModelUsed        string
	ModelDisplayName string
	FallbackNotice   string
	FallbackReason   string
	TokensIn         int
	TokensOut        int
	FallbackUsed     bool
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

// RoutedLLM implementa google.golang.org/adk/v2/model.LLM integrando ModelResolver (BYOK),
// ServerPool nativo ADK v2 (Sticky Thread + failover automático) e ModelRouter opcional.
type RoutedLLM struct {
	router        *ai.ModelRouter
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

// NewRoutedLLM cria uma instância de model.LLM conectada ao ModelRouter/ServerPool do Vito.
func NewRoutedLLM(router *ai.ModelRouter) *RoutedLLM {
	return &RoutedLLM{
		router:        router,
		stickyThreads: make(map[string]string),
		defaultModel:  "gemini-2.5-flash",
	}
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
		if r.router == nil {
			yield(nil, fmt.Errorf("nenhum provedor de IA configurado no RoutedLLM"))
			return
		}

		started := time.Now()
		agentReq := convertADKToAgentChatRequest(req, meta)

		provider, err := r.router.SelectProvider(ctx, agentReq)
		if err != nil {
			yield(nil, fmt.Errorf("falha ao selecionar provedor no RoutedLLM: %w", err))
			return
		}

		chosenProvider := provider
		var onDelta func(ai.StreamDelta) error
		if meta != nil && meta.OnDelta != nil {
			onDelta = meta.OnDelta
		}

		stepResp, stepErr := r.invokeProviderStep(ctx, provider, agentReq, stream, onDelta, yield)

		// COG-02: Failover automático via SelectFallbackProviders no mesmo passo do runner.Runner
		if stepErr != nil {
			fallbacks := r.router.SelectFallbackProviders(ctx, agentReq, provider.Name())
			for _, fb := range fallbacks {
				stepResp, stepErr = r.invokeProviderStep(ctx, fb, agentReq, stream, onDelta, yield)
				if stepErr == nil && stepResp != nil {
					chosenProvider = fb
					if meta != nil {
						meta.Mu.Lock()
						meta.FallbackUsed = true
						meta.Mu.Unlock()
					}
					break
				}
			}
		}

		if stepErr != nil {
			yield(nil, fmt.Errorf("erro na chamada ao provedor de IA (%s): %w", chosenProvider.Name(), stepErr))
			return
		}

		if meta != nil && stepResp != nil {
			meta.Mu.Lock()
			if meta.CredentialSource == "" {
				meta.CredentialSource = "server"
			}
			if meta.ProviderKey == "" {
				meta.ProviderKey = string(domain.ProviderKeyServer)
			}
			meta.ProviderUsed = chosenProvider.Name()
			meta.ModelUsed = chosenProvider.ModelName()
			if meta.ModelDisplayName == "" {
				meta.ModelDisplayName = chosenProvider.ModelName()
			}
			meta.TokensIn += stepResp.TokensIn
			meta.TokensOut += stepResp.TokensOut
			meta.Mu.Unlock()
		}
		r.recordServerTrace(meta, chosenProvider, stepResp, started)

		llmResp := convertAgentChatToADKResponse(stepResp)
		yield(llmResp, nil)
	}
}

func (r *RoutedLLM) invokeProviderStep(
	ctx context.Context,
	p ai.AgentProvider,
	agentReq ai.AgentChatRequest,
	stream bool,
	onDelta func(ai.StreamDelta) error,
	yield func(*model.LLMResponse, error) bool,
) (*ai.AgentChatResponse, error) {
	if stream && onDelta != nil {
		return p.StreamChat(ctx, agentReq, func(d ai.StreamDelta) error {
			if d.ReasoningDelta != "" {
				outDelta := d
				if outDelta.Type == "" {
					outDelta.Type = "reasoning"
				}
				_ = onDelta(outDelta)
				partial := &model.LLMResponse{
					Partial: true,
					Content: &genai.Content{
						Role:  genai.RoleModel,
						Parts: []*genai.Part{{Text: d.ReasoningDelta, Thought: true}},
					},
				}
				if !yield(partial, nil) {
					return context.Canceled
				}
			}
			if d.TextDelta != "" {
				outDelta := d
				if outDelta.Type == "" {
					outDelta.Type = "text"
				}
				_ = onDelta(outDelta)
				partial := &model.LLMResponse{
					Partial: true,
					Content: &genai.Content{
						Role:  genai.RoleModel,
						Parts: []*genai.Part{{Text: d.TextDelta}},
					},
				}
				if !yield(partial, nil) {
					return context.Canceled
				}
			} else if d.ReasoningDelta == "" && len(d.ToolCalls) > 0 {
				outDelta := d
				if outDelta.Type == "" {
					outDelta.Type = "tool_call"
				}
				if outDelta.ToolName == "" {
					outDelta.ToolName = d.ToolCalls[0].Name
				}
				_ = onDelta(outDelta)
			}
			return nil
		})
	}

	stepResp, stepErr := p.Chat(ctx, agentReq)
	if stepErr == nil && stepResp != nil && onDelta != nil {
		if stepResp.Thought != "" {
			_ = onDelta(ai.StreamDelta{
				Type:           "reasoning",
				ReasoningDelta: stepResp.Thought,
			})
		} else {
			for _, thought := range stepResp.Reasoning {
				if thought != "" {
					_ = onDelta(ai.StreamDelta{
						Type:           "reasoning",
						ReasoningDelta: thought,
					})
				}
			}
		}
		if len(stepResp.ToolCalls) > 0 {
			_ = onDelta(ai.StreamDelta{
				Type:      "tool_call",
				ToolName:  stepResp.ToolCalls[0].Name,
				ToolCalls: stepResp.ToolCalls,
			})
		}
		if stepResp.Text != "" && len(stepResp.ToolCalls) == 0 {
			_ = onDelta(ai.StreamDelta{
				Type:      "text",
				TextDelta: stepResp.Text,
			})
		}
	}
	return stepResp, stepErr
}
