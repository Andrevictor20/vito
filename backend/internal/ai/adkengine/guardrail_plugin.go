package adkengine

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/plugin"
	"google.golang.org/adk/v2/tool"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// TurnCollector acumula os artefatos ricos (ChatCards, Sources, ExecutedTools, HITL) durante a execução do Runner.
type TurnCollector struct {
	Mu                    sync.Mutex
	ExecutedTools         []domain.ExecutedTool
	Cards                 []domain.ChatCard
	Sources               []domain.SearchSource
	Reasoning             []string
	RequiresConfirmation  bool
	PendingConfirmationID string
	SuspendedPromptText   string
	WhatsAppMessage       *domain.ChatWhatsAppMessage
	GmailMessage          *domain.ChatGmailMessage
	Tainted               bool
}

type collectorContextKey struct{}

// GuardrailPlugin implementa BeforeModelCallback, BeforeToolCallback e AfterToolCallback nativos do Google ADK.
type GuardrailPlugin struct {
	bridge           *ToolsetBridge
	scopeGuard       domain.ScopeGuard
	confirmationGate *service.ConfirmationGateService
	traceRecorder    ai.TraceRecorder
}

// NewGuardrailPlugin cria o plugin de segurança e observabilidade Zero-Trust do ADK.
func NewGuardrailPlugin(
	bridge *ToolsetBridge,
	scopeGuard domain.ScopeGuard,
	confirmationGate *service.ConfirmationGateService,
	traceRecorder ai.TraceRecorder,
) *GuardrailPlugin {
	return &GuardrailPlugin{
		bridge:           bridge,
		scopeGuard:       scopeGuard,
		confirmationGate: confirmationGate,
		traceRecorder:    traceRecorder,
	}
}

// BuildADKPlugin empacota os callbacks em um *plugin.Plugin oficial do Google ADK v2.
func (g *GuardrailPlugin) BuildADKPlugin() (*plugin.Plugin, error) {
	return plugin.New(plugin.Config{
		Name:                "vito_zero_trust_guardrails",
		BeforeModelCallback: g.BeforeModel,
		BeforeToolCallback:  g.BeforeTool,
		AfterToolCallback:   g.AfterTool,
	})
}

// ApplyBeforeModelConfig aplica ThinkingBudget adaptativo, teto de 320 tokens na voz
// e separa o prefixo estático cacheável do contexto dinâmico do turno (COG-01).
func ApplyBeforeModelConfig(
	llmReq *model.LLMRequest,
	channel string,
	effort string,
	staticPrompt string,
	volatileContext string,
) {
	if llmReq == nil {
		return
	}
	if llmReq.Config == nil {
		llmReq.Config = &genai.GenerateContentConfig{}
	}

	// 1. Separação de Prefixo Estático Cacheável + Sufixo Dinâmico
	if staticPrompt != "" || volatileContext != "" {
		var parts []*genai.Part
		if staticPrompt != "" {
			parts = append(parts, genai.NewPartFromText(staticPrompt))
		}
		if volatileContext != "" {
			parts = append(parts, genai.NewPartFromText(volatileContext))
		}
		llmReq.Config.SystemInstruction = &genai.Content{
			Role:  "system",
			Parts: parts,
		}
	}

	isVoice := strings.Contains(strings.ToLower(channel), "voice")
	if isVoice {
		// COG-01: Canal voice mantém ThinkingBudget = 0 e MaxOutputTokens = 320
		zeroBudget := int32(0)
		llmReq.Config.MaxOutputTokens = 320
		llmReq.Config.ThinkingConfig = &genai.ThinkingConfig{
			ThinkingBudget: &zeroBudget,
		}
		return
	}

	// 2. ThinkingBudget adaptativo para canais de texto
	budget := computeAdaptiveThinkingBudget(llmReq, effort)
	llmReq.Config.ThinkingConfig = &genai.ThinkingConfig{
		IncludeThoughts: budget > 0,
		ThinkingBudget:  &budget,
	}
}

func computeAdaptiveThinkingBudget(llmReq *model.LLMRequest, effort string) int32 {
	switch strings.ToLower(strings.TrimSpace(effort)) {
	case "none", "0", "off":
		return 0
	case "low":
		return 512
	case "med", "medium":
		return 2048
	case "high":
		return 8192
	}

	// Em modo "auto" (padrão), analisa a complexidade do pedido do usuário
	var lastUserText string
	for i := len(llmReq.Contents) - 1; i >= 0; i-- {
		c := llmReq.Contents[i]
		if c != nil && c.Role == genai.RoleUser {
			for _, p := range c.Parts {
				if p != nil && p.Text != "" {
					lastUserText += " " + strings.ToLower(p.Text)
				}
			}
			if strings.TrimSpace(lastUserText) != "" {
				break
			}
		}
	}

	analyticalKeywords := []string{
		"analis", "planej", "compar", "finan", "orçament", "orcament",
		"gasto", "fatura", "semana", "resum", "estratég", "estrateg",
		"reorganiz", "conflit", "relatóri", "relatori", "parcela",
	}
	for _, kw := range analyticalKeywords {
		if strings.Contains(lastUserText, kw) {
			return 1024
		}
	}
	if len(lastUserText) > 140 {
		return 1024
	}
	return 0
}

// BeforeModel intercepta a requisição antes de chamar a LLM para aplicar Context Caching e ThinkingBudget.
func (g *GuardrailPlugin) BeforeModel(ctx agent.Context, llmReq *model.LLMRequest) (*model.LLMResponse, error) {
	meta := TurnExecutionMetaFromContext(ctx)
	channel := ""
	effort := "auto"
	if meta != nil {
		channel = meta.Channel
		meta.Mu.Lock()
		if meta.Effort != "" {
			effort = meta.Effort
		}
		if name := ctx.AgentName(); name != "" {
			meta.AgentName = name
		}
		meta.Mu.Unlock()
	}

	// Se uma ferramenta já foi suspensa pelo ConfirmationGate neste turno, interrompe novas chamadas à LLM
	if col := turnCollectorFromAgentContext(ctx); col != nil {
		col.Mu.Lock()
		suspended := col.RequiresConfirmation
		promptText := col.SuspendedPromptText
		col.Mu.Unlock()
		if suspended {
			return &model.LLMResponse{
				TurnComplete: true,
				Content: &genai.Content{
					Role:  genai.RoleModel,
					Parts: []*genai.Part{{Text: promptText}},
				},
			}, nil
		}
	}

	var staticPrompt, volatileCtx string
	if st := ctx.ReadonlyState(); st != nil {
		if sp, err := st.Get("static_system_prompt"); err == nil {
			staticPrompt, _ = sp.(string)
		}
		if vc, err := st.Get("volatile_turn_context"); err == nil {
			volatileCtx, _ = vc.(string)
		}
	}

	ApplyBeforeModelConfig(llmReq, channel, effort, staticPrompt, volatileCtx)
	return nil, nil
}

// BeforeTool intercepta toda chamada de ferramenta aplicando ScopeGuard (Taint Tracking) e ConfirmationGate HITL.
func (g *GuardrailPlugin) BeforeTool(ctx agent.Context, t tool.Tool, args map[string]any) (map[string]any, error) {
	if g.bridge == nil {
		return nil, nil
	}

	res, ok := g.bridge.ResolveCall(t.Name(), args)
	if !ok || res == nil {
		return nil, nil
	}

	execCtx := buildToolExecutionContextFromAgent(ctx)
	if col := turnCollectorFromAgentContext(ctx); col != nil {
		col.Mu.Lock()
		if col.Tainted {
			execCtx.TaintedByUntrustedInput = true
		}
		col.Mu.Unlock()
	}

	isWrite, _, preview := res.Toolset.IsWriteOperation(res.Operation, res.Params)

	// Política específica de Bot: 'off' retorna erro explicativo imediato ao modelo sem abrir HITL
	if execCtx.BotID != "" && len(execCtx.ActionPolicies) > 0 {
		spec, hasSpec := g.bridge.SpecForTool(t.Name())
		var pol domain.ActionPolicy
		hasPol := false
		if hasSpec {
			pol, hasPol = lookupActionPolicy(execCtx.ActionPolicies, spec.ActionKey)
		}
		if !hasPol {
			pol, hasPol = execCtx.ActionPolicies[res.Operation]
		}
		if hasPol && pol == domain.ActionPolicyOff {
			msg := fmt.Sprintf("A ação '%s' está desligada para este bot. Não é possível executá-la sem que o usuário a habilite nas Ações do bot.", res.Operation)
			return map[string]any{
				"status":          "ERROR",
				"summary_for_llm": msg,
				"result":          msg,
				"error":           "action_policy_off",
			}, nil
		}
	}

	allowed := true
	reason := ""
	if g.scopeGuard != nil {
		allowed, reason = g.scopeGuard.CanExecute(ctx, execCtx, res.Operation, isWrite)
	}

	if !allowed {
		var pendingID string
		if g.confirmationGate != nil {
			previewBytes, _ := json.Marshal(preview)
			p, err := g.confirmationGate.CreatePending(ctx, &service.CreatePendingRequest{
				UserID:         execCtx.UserID,
				ThreadID:       execCtx.ThreadID,
				Channel:        execCtx.Channel,
				ToolsetName:    string(res.Toolset.Name()),
				Operation:      res.Operation,
				ArgumentsJSON:  string(res.Params),
				PreviewJSON:    string(previewBytes),
				TaintedContext: execCtx.TaintedByUntrustedInput,
			})
			if err == nil && p != nil {
				pendingID = p.ID
			}
		}

		promptText, card, waMsg, gmMsg := FormatSuspendedAction(res.Operation, pendingID, reason, preview)
		if col := turnCollectorFromAgentContext(ctx); col != nil {
			col.Mu.Lock()
			col.RequiresConfirmation = true
			col.PendingConfirmationID = pendingID
			col.SuspendedPromptText = promptText
			col.Cards = append(col.Cards, card)
			col.ExecutedTools = append(col.ExecutedTools, domain.ExecutedTool{
				Tool:      string(res.Toolset.Name()),
				Operation: res.Operation,
				Status:    "AWAITING_USER_CONFIRMATION",
			})
			if waMsg != nil {
				col.WhatsAppMessage = waMsg
			}
			if gmMsg != nil {
				col.GmailMessage = gmMsg
			}
			col.Mu.Unlock()
		}

		if actions := ctx.Actions(); actions != nil {
			actions.SkipSummarization = true
		}

		return map[string]any{
			"status":                  "AWAITING_USER_CONFIRMATION",
			"summary_for_llm":         promptText,
			"result":                  promptText,
			"pending_confirmation_id": pendingID,
		}, nil
	}

	if meta := TurnExecutionMetaFromContext(ctx); meta != nil && meta.OnDelta != nil {
		_ = meta.OnDelta(ai.StreamDelta{
			Type:     "tool_call",
			ToolName: t.Name(),
		})
	}

	return nil, nil
}

// AfterTool coleta ChatCards, SearchSources, marca Taint Tracking e grava AITrace no RingBuffer.
func (g *GuardrailPlugin) AfterTool(ctx agent.Context, t tool.Tool, args, result map[string]any, err error) (map[string]any, error) {
	if result == nil {
		return nil, nil
	}
	if status, _ := result["status"].(string); status == "AWAITING_USER_CONFIRMATION" {
		return result, nil
	}

	toolsetName, _ := result["toolset_name"].(string)
	if toolsetName == "" {
		toolsetName = t.Name()
	}
	operation, _ := result["operation"].(string)
	if operation == "" {
		operation = t.Name()
	}
	status, _ := result["status"].(string)
	if status == "" {
		if err != nil {
			status = "ERROR"
		} else {
			status = "COMPLETED"
		}
	}

	tainted, _ := result["marks_context_as_tainted"].(bool)
	taintSource, _ := result["taint_source_label"].(string)

	execCtx := buildToolExecutionContextFromAgent(ctx)
	if tainted {
		if g.scopeGuard != nil {
			g.scopeGuard.MarkTainted(ctx, execCtx.TurnID, taintSource)
		}
		if st := ctx.State(); st != nil {
			_ = st.Set("tainted_by_untrusted_input", true)
		}
	}

	if col := turnCollectorFromAgentContext(ctx); col != nil {
		col.Mu.Lock()
		if tainted {
			col.Tainted = true
		}
		col.ExecutedTools = append(col.ExecutedTools, domain.ExecutedTool{
			Tool:      toolsetName,
			Operation: operation,
			Status:    status,
		})
		if rawCards, ok := result["cards"]; ok && rawCards != nil {
			if cards, ok := rawCards.([]domain.ChatCard); ok {
				col.Cards = append(col.Cards, cards...)
				for _, c := range cards {
					if c.Type == "whatsapp" {
						col.WhatsAppMessage = &domain.ChatWhatsAppMessage{
							ID:            c.ID,
							RecipientName: c.Title,
							Message:       c.Subtitle,
							Status:        "sent",
							SentAt:        time.Now().Format(time.RFC3339),
						}
					} else if c.Type == "gmail" {
						col.GmailMessage = &domain.ChatGmailMessage{
							ID:             c.ID,
							RecipientEmail: c.Subtitle,
							Subject:        c.Title,
							Status:         "sent",
							SentAt:         time.Now().Format(time.RFC3339),
						}
					}
				}
			}
		}
		if rawSources, ok := result["sources"]; ok && rawSources != nil {
			if sources, ok := rawSources.([]domain.SearchSource); ok {
				col.Sources = append(col.Sources, sources...)
			}
		}
		col.Mu.Unlock()
	}

	if g.traceRecorder != nil {
		meta := TurnExecutionMetaFromContext(ctx)
		provName, modName, credSrc, provKey, eff, fbReason := "", "", "server", "srv", "", ""
		var fbUsed bool
		if meta != nil {
			meta.Mu.Lock()
			provName = meta.ProviderUsed
			modName = meta.ModelUsed
			if meta.CredentialSource != "" {
				credSrc = meta.CredentialSource
			}
			if meta.ProviderKey != "" {
				provKey = meta.ProviderKey
			}
			eff = meta.Effort
			fbUsed = meta.FallbackUsed
			fbReason = meta.FallbackReason
			meta.Mu.Unlock()
		}
		g.traceRecorder.RecordAsync(ai.AITrace{
			UserID:            execCtx.UserID,
			ThreadID:          execCtx.ThreadID,
			TurnID:            execCtx.TurnID,
			Channel:           execCtx.Channel,
			AgentName:         ctx.AgentName(),
			TaskType:          ai.TaskToolUse,
			CredentialSource:  credSrc,
			ProviderKey:       provKey,
			Effort:            eff,
			ProviderName:      provName,
			ModelName:         modName,
			ToolsetCalled:     toolsetName,
			OperationCalled:   operation,
			FallbackTriggered: fbUsed,
			FallbackReason:    fbReason,
			TaintedTurn:       tainted,
			CreatedAt:         time.Now().UTC(),
		})
	}

	return result, nil
}

func turnCollectorFromAgentContext(ctx agent.Context) *TurnCollector {
	if ctx == nil {
		return nil
	}
	if v, ok := ctx.Value(collectorContextKey{}).(*TurnCollector); ok {
		return v
	}
	return nil
}
