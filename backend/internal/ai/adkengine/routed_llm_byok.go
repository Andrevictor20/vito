package adkengine

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"google.golang.org/adk/v2/model"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

const defaultBYOKRetryBackoff = 2 * time.Second

func (r *RoutedLLM) tryGenerateBYOK(
	ctx context.Context,
	req *model.LLMRequest,
	stream bool,
	meta *TurnExecutionMeta,
	yield func(*model.LLMResponse, error) bool,
) bool {
	if r == nil || r.resolver == nil || meta == nil || strings.TrimSpace(meta.UserID) == "" {
		return false
	}

	needsTools := llmRequestHasTools(req)
	minLevel := 0
	for attempt := 0; attempt < 3; attempt++ {
		resolved, err := r.resolver.Resolve(ctx, service.ModelResolveRequest{
			UserID:       meta.UserID,
			ThreadID:     meta.ThreadID,
			BotID:        meta.BotID,
			Channel:      meta.Channel,
			RequireTools: needsTools,
			MinLevelIdx:  minLevel,
		})
		if err != nil || resolved == nil {
			return false
		}

		meta.Mu.Lock()
		if meta.Effort == "" || meta.Effort == domain.EffortAuto {
			meta.Effort = resolved.Effort
		}
		meta.Mu.Unlock()

		if resolved.Source != "byok" || resolved.VitoLLM == nil {
			return false
		}

		stepStart := time.Now()
		var buffered []*model.LLMResponse
		stepErr := consumeLLMStep(ctx, resolved.VitoLLM.LLM, req, stream, func(resp *model.LLMResponse) {
			if resp != nil {
				buffered = append(buffered, resp)
			}
		})

		if stepErr == nil {
			for _, resp := range buffered {
				if !yield(resp, nil) {
					break
				}
			}
			r.recordBYOKSuccess(meta, resolved, stepStart)
			return true
		}

		action, notice, reason, inheritNext := r.handleBYOKError(ctx, meta.UserID, resolved, stepErr, needsTools)
		if action == byokErrRetrySame {
			if waitErr := sleepWithContext(ctx, r.byokBackoff()); waitErr == nil {
				buffered = nil
				retryStart := time.Now()
				retryErr := consumeLLMStep(ctx, resolved.VitoLLM.LLM, req, stream, func(resp *model.LLMResponse) {
					if resp != nil {
						buffered = append(buffered, resp)
					}
				})
				if retryErr == nil {
					for _, resp := range buffered {
						if !yield(resp, nil) {
							break
						}
					}
					r.recordBYOKSuccess(meta, resolved, retryStart)
					return true
				}
				stepErr = retryErr
			}
		}

		meta.Mu.Lock()
		meta.FallbackUsed = true
		if reason != "" {
			meta.FallbackReason = reason
		}
		if notice != "" && meta.FallbackNotice == "" {
			meta.FallbackNotice = notice
		}
		meta.Mu.Unlock()

		if inheritNext && resolved.NextLevelIdx > minLevel {
			minLevel = resolved.NextLevelIdx
			continue
		}
		return false
	}
	return false
}

type byokErrorAction int

const (
	byokErrFallToServer byokErrorAction = iota
	byokErrRetrySame
	byokErrInheritNext
)

func (r *RoutedLLM) handleBYOKError(
	ctx context.Context,
	userID string,
	resolved *service.ResolvedModel,
	err error,
	needsTools bool,
) (action byokErrorAction, notice, reason string, inheritNext bool) {
	provName := service.ProviderDisplayName(resolved.ProviderKey)
	var httpErr *ProviderHTTPError
	if errors.As(err, &httpErr) && httpErr != nil {
		code := httpErr.StatusCode
		reason = fmt.Sprintf("byok_%d", code)
		if code == http.StatusUnauthorized || code == http.StatusForbidden {
			if r.providerRepo != nil {
				_ = r.providerRepo.UpdateStatus(ctx, userID, resolved.ProviderKey, domain.ProviderStatusInvalid)
			}
			if r.registry != nil {
				r.registry.InvalidateProvider(userID, resolved.ProviderKey)
			}
			notice = fmt.Sprintf("Sua chave do %s foi recusada. Usei o servidor nesta resposta.", provName)
			return byokErrFallToServer, notice, reason, false
		}
		if code == http.StatusNotFound {
			r.resolver.EvictModelFromCache(ctx, userID, resolved.ProviderKey, resolved.ModelID)
			notice = fmt.Sprintf("O modelo %s não está mais disponível no %s.", resolved.DisplayName, provName)
			return byokErrInheritNext, notice, reason, true
		}
		if code == http.StatusBadRequest && needsTools && looksLikeToolsRejected(httpErr.Body) {
			if r.registry != nil {
				r.registry.MarkToolsUnsupported(ctx, userID, resolved.ProviderKey, resolved.ModelID)
			}
			return byokErrInheritNext, "", "byok_tools_unsupported", true
		}
		if code == http.StatusTooManyRequests || code >= http.StatusInternalServerError {
			return byokErrRetrySame, "", reason, false
		}
		return byokErrFallToServer, "", reason, false
	}

	if errors.Is(err, context.DeadlineExceeded) || strings.Contains(strings.ToLower(err.Error()), "timeout") {
		return byokErrRetrySame, "", "byok_timeout", false
	}
	return byokErrFallToServer, "", "byok_error", false
}

func (r *RoutedLLM) recordBYOKSuccess(meta *TurnExecutionMeta, resolved *service.ResolvedModel, started time.Time) {
	meta.Mu.Lock()
	meta.CredentialSource = "byok"
	meta.ProviderKey = string(resolved.ProviderKey)
	meta.ProviderUsed = service.ProviderDisplayName(resolved.ProviderKey)
	meta.ModelUsed = resolved.ModelID
	meta.ModelDisplayName = resolved.DisplayName
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
			CredentialSource:  "byok",
			ProviderKey:       string(resolved.ProviderKey),
			Effort:            effort,
			ProviderName:      service.ProviderDisplayName(resolved.ProviderKey),
			ModelName:         resolved.ModelID,
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

func (r *RoutedLLM) recordServerTrace(meta *TurnExecutionMeta, provider ai.AgentProvider, resp *ai.AgentChatResponse, started time.Time) {
	if r == nil || r.traceRecorder == nil || meta == nil || provider == nil {
		return
	}
	meta.Mu.Lock()
	effort := meta.Effort
	agentName := meta.AgentName
	fbUsed := meta.FallbackUsed
	fbReason := meta.FallbackReason
	meta.Mu.Unlock()

	var tokIn, tokOut int
	if resp != nil {
		tokIn = resp.TokensIn
		tokOut = resp.TokensOut
	}
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
		ProviderName:      provider.Name(),
		ModelName:         provider.ModelName(),
		FallbackTriggered: fbUsed,
		FallbackReason:    fbReason,
		TokensIn:          tokIn,
		TokensOut:         tokOut,
		LatencyMs:         time.Since(started).Milliseconds(),
		StatusCode:        http.StatusOK,
		CreatedAt:         time.Now().UTC(),
	})
}

func consumeLLMStep(ctx context.Context, llm model.LLM, req *model.LLMRequest, stream bool, onResp func(*model.LLMResponse)) error {
	for resp, err := range llm.GenerateContent(ctx, req, stream) {
		if err != nil {
			return err
		}
		if resp != nil && onResp != nil {
			onResp(resp)
		}
	}
	return nil
}

func llmRequestHasTools(req *model.LLMRequest) bool {
	if req == nil || req.Config == nil {
		return false
	}
	for _, gt := range req.Config.Tools {
		if gt != nil && len(gt.FunctionDeclarations) > 0 {
			return true
		}
	}
	return false
}

func looksLikeToolsRejected(body string) bool {
	lower := strings.ToLower(body)
	return strings.Contains(lower, "tool") || strings.Contains(lower, "function")
}

func sleepWithContext(ctx context.Context, d time.Duration) error {
	if d <= 0 {
		return nil
	}
	timer := time.NewTimer(d)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (r *RoutedLLM) byokBackoff() time.Duration {
	if r != nil && r.backoff > 0 {
		return r.backoff
	}
	return defaultBYOKRetryBackoff
}
