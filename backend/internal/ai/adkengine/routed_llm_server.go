package adkengine

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"google.golang.org/adk/v2/model"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

func (r *RoutedLLM) generateFromServerPool(
	ctx context.Context,
	req *model.LLMRequest,
	stream bool,
	meta *TurnExecutionMeta,
	yield func(*model.LLMResponse, error) bool,
) {
	ordered := r.orderServerPoolForTurn(meta)
	if len(ordered) == 0 {
		yield(nil, fmt.Errorf("pool do servidor vazio no RoutedLLM"))
		return
	}

	var lastErr error
	for idx, entry := range ordered {
		if entry.LLM == nil {
			continue
		}
		started := time.Now()
		yieldedAny := false
		stepReq := cloneLLMRequestWithModel(req, entry.ModelID)

		stepErr := consumeLLMStep(ctx, entry.LLM, stepReq, stream, func(resp *model.LLMResponse) {
			if resp != nil {
				yieldedAny = true
				yield(resp, nil)
			}
		})
		if stepErr == nil {
			if idx > 0 && meta != nil {
				meta.Mu.Lock()
				meta.FallbackUsed = true
				if meta.FallbackReason == "" {
					meta.FallbackReason = "server_pool_failover"
				}
				meta.Mu.Unlock()
			}
			r.rememberStickyProvider(meta, entry.ProviderKey)
			r.recordServerPoolSuccess(meta, entry, started)
			return
		}
		if yieldedAny {
			yield(nil, stepErr)
			return
		}
		lastErr = stepErr
	}

	if lastErr == nil {
		lastErr = fmt.Errorf("nenhum provedor do pool do servidor disponível")
	}
	yield(nil, fmt.Errorf("erro na chamada ao pool do servidor: %w", lastErr))
}

func (r *RoutedLLM) orderServerPoolForTurn(meta *TurnExecutionMeta) []ServerPoolEntry {
	if len(r.serverPool) <= 1 || meta == nil || strings.TrimSpace(meta.ThreadID) == "" {
		return r.serverPool
	}
	r.stickyMu.RLock()
	stickyKey := r.stickyThreads[meta.ThreadID]
	r.stickyMu.RUnlock()
	if stickyKey == "" {
		return r.serverPool
	}
	out := make([]ServerPoolEntry, 0, len(r.serverPool))
	for _, entry := range r.serverPool {
		if entry.ProviderKey == stickyKey {
			out = append(out, entry)
		}
	}
	for _, entry := range r.serverPool {
		if entry.ProviderKey != stickyKey {
			out = append(out, entry)
		}
	}
	return out
}

func (r *RoutedLLM) rememberStickyProvider(meta *TurnExecutionMeta, providerKey string) {
	if r == nil || meta == nil || strings.TrimSpace(meta.ThreadID) == "" || providerKey == "" {
		return
	}
	r.stickyMu.Lock()
	if r.stickyThreads == nil {
		r.stickyThreads = make(map[string]string)
	}
	if len(r.stickyThreads) > 256 {
		clear(r.stickyThreads)
	}
	r.stickyThreads[meta.ThreadID] = providerKey
	r.stickyMu.Unlock()
}

func (r *RoutedLLM) recordServerPoolSuccess(meta *TurnExecutionMeta, entry ServerPoolEntry, started time.Time) {
	if meta == nil {
		return
	}
	meta.Mu.Lock()
	if meta.CredentialSource == "" {
		meta.CredentialSource = "server"
	}
	if meta.ProviderKey == "" {
		meta.ProviderKey = string(domain.ProviderKeyServer)
	}
	meta.ProviderUsed = entry.DisplayName
	meta.ModelUsed = entry.ModelID
	if meta.ModelDisplayName == "" {
		meta.ModelDisplayName = entry.ModelID
	}
	effort := meta.Effort
	agentName := meta.AgentName
	fbUsed := meta.FallbackUsed
	fbReason := meta.FallbackReason
	tokensIn := meta.TokensIn
	tokensOut := meta.TokensOut
	meta.Mu.Unlock()

	if r.traceRecorder != nil {
		r.traceRecorder.RecordAsync(ai.AITrace{
			UserID:            meta.UserID,
			ThreadID:          meta.ThreadID,
			TurnID:            meta.TurnID,
			Channel:           meta.Channel,
			AgentName:         agentName,
			TaskType:          ai.TaskToolUse,
			CredentialSource:  "server",
			ProviderKey:       string(domain.ProviderKeyServer),
			Effort:            effort,
			ProviderName:      entry.DisplayName,
			ModelName:         entry.ModelID,
			FallbackTriggered: fbUsed,
			FallbackReason:    fbReason,
			TokensIn:          tokensIn,
			TokensOut:         tokensOut,
			LatencyMs:         time.Since(started).Milliseconds(),
			StatusCode:        http.StatusOK,
			CreatedAt:         time.Now().UTC(),
		})
	}
}

func cloneLLMRequestWithModel(req *model.LLMRequest, modelID string) *model.LLMRequest {
	if req == nil {
		return &model.LLMRequest{Model: modelID}
	}
	cp := *req
	if strings.TrimSpace(modelID) != "" {
		cp.Model = modelID
	}
	return &cp
}
