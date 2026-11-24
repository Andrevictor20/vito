package adkengine

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/agent/llmagent"
	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/tool"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// AgentTopology encapsula o coordenador raiz (vito_executive) e os 6 sub-agentes especialistas de domínio.
type AgentTopology struct {
	RootAgent      agent.Agent
	RoutineAgent   agent.Agent
	CommsAgent     agent.Agent
	FinanceAgent   agent.Agent
	ResearchAgent  agent.Agent
	WorkspaceAgent agent.Agent
	BotsAgent      agent.Agent
}

// BuildAgentTopology constrói a árvore Multi-Agente do Google ADK v2 para o Vito (COG-03).
// Para perguntas diretas de 1 domínio, o vito_executive possui acesso direto às functiontools registradas
// para resolução em 1 RTT (< 800ms na voz), e também conta com os 6 sub-agentes especialistas de domínio
// para delegação e orquestração multi-domínio.
func BuildAgentTopology(llm model.LLM, bridge *ToolsetBridge) (*AgentTopology, error) {
	if llm == nil {
		return nil, fmt.Errorf("model.LLM é obrigatório para construir a topologia de agentes")
	}

	var routineTools, commsTools, financeTools, researchTools, workspaceTools, botsTools, rootTools []tool.Tool
	if bridge != nil {
		routineTools = bridge.BuildDomainTools(
			domain.ToolsetCalendar,
			domain.ToolsetTaskPending,
			domain.ToolsetMeetingBooking,
		)
		commsTools = bridge.BuildDomainTools(
			domain.ToolsetWhatsApp,
			domain.ToolsetGmail,
		)
		financeTools = bridge.BuildDomainTools(
			domain.ToolsetName("finance_manager"),
		)
		researchTools = bridge.BuildDomainTools(
			domain.ToolsetWebSearch,
		)
		workspaceTools = bridge.BuildDomainTools(
			domain.ToolsetMemoryProfile,
		)
		botsTools = bridge.BuildDomainTools(
			domain.ToolsetRadarTrigger,
		)
		rootTools = bridge.BuildDomainTools(
			domain.ToolsetMemoryProfile,
		)
	}

	routineAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_routine_agent",
		Description: "Especialista em rotina pessoal: agenda (Google Calendar), tarefas, pendências, Vito Booking e reuniões.",
		Model:       llm,
		Instruction: "Você é o especialista de rotina do Vito. Gerencie compromissos na agenda, tarefas, pendências e links de agendamento com precisão em português.",
		Tools:       routineTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_routine_agent: %w", err)
	}

	commsAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_comms_agent",
		Description: "Especialista em comunicações omnichannel: mensagens de WhatsApp, e-mails do Gmail, rascunhos e busca de conversas.",
		Model:       llm,
		Instruction: "Você é o especialista de comunicações do Vito. Pesquise mensagens, redija rascunhos e prepare envios de WhatsApp e Gmail respeitando confirmação humana.",
		Tools:       commsTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_comms_agent: %w", err)
	}

	financeAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_finance_agent",
		Description: "Especialista financeiro Open Finance: Safe-to-Spend, cartões, faturas, parcelas, transações e orçamentos.",
		Model:       llm,
		Instruction: "Você é o especialista financeiro do Vito. Analise gastos, saldo livre (Safe-to-Spend), cartões e faturas com rigor matemático sem inventar valores.",
		Tools:       financeTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_finance_agent: %w", err)
	}

	researchAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_research_agent",
		Description: "Especialista em pesquisa factual na web (SearXNG), leitura aprofundada de páginas (Jina Reader), cotações, notícias e preços.",
		Model:       llm,
		Instruction: "Você é o especialista de pesquisa factual do Vito. Consulte informações em tempo real na web e sintetize os fatos verificados com clareza.",
		Tools:       researchTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_research_agent: %w", err)
	}

	workspaceAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_workspace_agent",
		Description: "Especialista em memória de longo prazo, perfil do usuário e integrações de produtividade e servidores MCP.",
		Model:       llm,
		Instruction: "Você é o especialista de memória e workspace do Vito. Consulte e atualize preferências e integrações conectadas do usuário.",
		Tools:       workspaceTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_workspace_agent: %w", err)
	}

	botsAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_bots_architect",
		Description: "Arquiteto de Bots proativos do Vito: sugere bots prontos do catálogo, propõe novos bots com função, habilidade e ações, lista e gerencia bots ativos.",
		Model:       llm,
		Instruction: "Você é o arquiteto de bots do Vito. Quando o usuário pedir para criar um bot, verifique se existe um bot pronto compatível primeiro; caso contrário, proponha o bot com função, gatilho, habilidade sugerida e ações.",
		Tools:       botsTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_bots_architect: %w", err)
	}

	subAgents := []agent.Agent{
		routineAgent,
		commsAgent,
		financeAgent,
		researchAgent,
		workspaceAgent,
		botsAgent,
	}

	rootAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_executive",
		Description: "Coordenador executivo pessoal Vito: conversa natural, memória rápida e orquestração multi-domínio via sub-agentes especialistas.",
		Model:       llm,
		Instruction: "Você é o Vito, parceiro pessoal inteligente e secretário executivo do usuário. Responda sempre em português do Brasil com naturalidade e precisão, delegando operações de domínio aos sub-agentes especialistas.",
		Tools:       rootTools,
		SubAgents:   subAgents,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_executive: %w", err)
	}

	return &AgentTopology{
		RootAgent:      rootAgent,
		RoutineAgent:   routineAgent,
		CommsAgent:     commsAgent,
		FinanceAgent:   financeAgent,
		ResearchAgent:  researchAgent,
		WorkspaceAgent: workspaceAgent,
		BotsAgent:      botsAgent,
	}, nil
}

func (f *ADKLoopFacade) tryHandlePendingConfirmation(
	ctx context.Context,
	req domain.UnifiedAssistantRequest,
	userID, threadID, turnID string,
	startTime time.Time,
	onDelta func(ai.StreamDelta) error,
) (*domain.UnifiedAssistantResponse, bool, error) {
	if f.cfg.ConfirmationGate == nil {
		return nil, false, nil
	}

	userMsg := strings.TrimSpace(req.Message)
	isConfirm := req.ConfirmPendingID != "" || service.IsExplicitSendConfirmationText(userMsg)
	isCancel := req.RejectPendingID != "" || service.IsExplicitSendCancellationText(userMsg)

	if !isConfirm && !isCancel {
		return nil, false, nil
	}

	var pending *service.PendingConfirmationRecord
	var err error
	if req.ConfirmPendingID != "" {
		pending, err = f.cfg.ConfirmationGate.GetByID(ctx, req.ConfirmPendingID, userID)
		if err != nil || pending == nil {
			if err == nil {
				err = service.ErrConfirmationNotFound
			}
			return nil, true, err
		}
	} else if req.RejectPendingID != "" {
		pending, err = f.cfg.ConfirmationGate.GetByID(ctx, req.RejectPendingID, userID)
		if err != nil || pending == nil {
			if err == nil {
				err = service.ErrConfirmationNotFound
			}
			return nil, true, err
		}
	} else {
		pending, err = f.cfg.ConfirmationGate.GetLatestPending(ctx, userID, threadID)
	}
	if err != nil || pending == nil {
		return nil, false, nil
	}

	emitStreamFinal := func(msg string) {
		if onDelta != nil {
			if msg != "" {
				_ = onDelta(ai.StreamDelta{TextDelta: msg})
			}
			_ = onDelta(ai.StreamDelta{Done: true})
		}
	}

	if isCancel {
		_ = f.cfg.ConfirmationGate.CancelWithReason(ctx, pending.ID, userID, userMsg)
		cancelMsg := FormatCancelledAction(pending.Operation)
		f.recordSimpleTurns(ctx, threadID, turnID, userID, req.Channel, userMsg, cancelMsg, startTime)
		emitStreamFinal(cancelMsg)
		return &domain.UnifiedAssistantResponse{
			ThreadID:  threadID,
			TurnID:    turnID,
			Text:      cancelMsg,
			Reply:     cancelMsg,
			Message:   cancelMsg,
			Telemetry: domain.TurnTelemetry{LatencyMs: time.Since(startTime).Milliseconds()},
		}, true, nil
	}

	resumed, err := f.cfg.ConfirmationGate.Resume(ctx, pending.ID, userID)
	if err != nil {
		return nil, false, err
	}
	if f.cfg.Registry == nil {
		return nil, false, fmt.Errorf("registry de toolsets não configurado")
	}
	toolset, ok := f.cfg.Registry.Get(domain.ToolsetName(resumed.ToolsetName))
	if !ok || toolset == nil {
		return nil, false, fmt.Errorf("toolset '%s' não encontrado", resumed.ToolsetName)
	}

	execCtx := &domain.ToolExecutionContext{
		UserID:                  userID,
		ThreadID:                threadID,
		TurnID:                  turnID,
		Channel:                 req.Channel,
		FocusMode:               req.FocusMode,
		AutonomyLevel:           "confirmed",
		TaintedByUntrustedInput: resumed.TaintedContext,
	}

	rawArgs := json.RawMessage(resumed.ArgumentsJSON)
	var env domain.ToolOperationEnvelope
	if err := json.Unmarshal(rawArgs, &env); err == nil && len(env.Params) > 0 {
		rawArgs = env.Params
	}

	res, execErr := toolset.Execute(ctx, execCtx, resumed.Operation, rawArgs)
	if execErr != nil {
		errMsg := FormatActionError(resumed.Operation, execErr)
		f.recordSimpleTurns(ctx, threadID, turnID, userID, req.Channel, userMsg, errMsg, startTime)
		emitStreamFinal(errMsg)
		return &domain.UnifiedAssistantResponse{
			ThreadID:  threadID,
			TurnID:    turnID,
			Text:      errMsg,
			Reply:     errMsg,
			Message:   errMsg,
			Telemetry: domain.TurnTelemetry{LatencyMs: time.Since(startTime).Milliseconds()},
		}, true, nil
	}

	resBytes, _ := json.Marshal(res)
	_ = f.cfg.ConfirmationGate.SaveExecutionResult(ctx, resumed.ID, string(resBytes))

	successMsg := res.SummaryForLLM
	if strings.TrimSpace(successMsg) == "" {
		successMsg = fmt.Sprintf("Ação '%s' executada com sucesso.", resumed.Operation)
	}

	resp := &domain.UnifiedAssistantResponse{
		ThreadID:  threadID,
		TurnID:    turnID,
		Text:      successMsg,
		Reply:     successMsg,
		Message:   successMsg,
		Cards:     res.Cards,
		Telemetry: domain.TurnTelemetry{LatencyMs: time.Since(startTime).Milliseconds()},
	}
	ExtractToolEntities(resumed.Operation, res.Data).ApplyToResponse(resp)
	for _, c := range res.Cards {
		if c.Type == "whatsapp" {
			resp.WhatsAppMessage = &domain.ChatWhatsAppMessage{
				ID:            c.ID,
				RecipientName: c.Title,
				Message:       c.Subtitle,
				Status:        "sent",
				SentAt:        time.Now().Format(time.RFC3339),
			}
		} else if c.Type == "gmail" {
			resp.GmailMessage = &domain.ChatGmailMessage{
				ID:             c.ID,
				RecipientEmail: c.Subtitle,
				Subject:        c.Title,
				Status:         "sent",
				SentAt:         time.Now().Format(time.RFC3339),
			}
		}
	}

	f.recordSimpleTurns(ctx, threadID, turnID, userID, req.Channel, userMsg, successMsg, startTime)
	emitStreamFinal(successMsg)
	return resp, true, nil
}
