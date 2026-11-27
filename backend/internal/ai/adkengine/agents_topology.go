package adkengine

import (
	"fmt"

	"google.golang.org/adk/v2/agent"
	"google.golang.org/adk/v2/agent/llmagent"
	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/tool"
	"google.golang.org/adk/v2/tool/loadmemorytool"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// TopologyOptions parametriza recursos opcionais na topologia multi-agente ADK.
type TopologyOptions struct {
	EnableLoadMemory bool
}

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
func BuildAgentTopology(llm model.LLM, bridge *ToolsetBridge) (*AgentTopology, error) {
	return BuildAgentTopologyWithOptions(llm, bridge, TopologyOptions{})
}

// BuildAgentTopologyWithOptions constrói a topologia multi-agente com suporte opcional à busca ativa de memória (`load_memory`).
func BuildAgentTopologyWithOptions(llm model.LLM, bridge *ToolsetBridge, opts TopologyOptions) (*AgentTopology, error) {
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
			domain.ToolsetFinance,
		)
		researchTools = bridge.BuildDomainTools(
			domain.ToolsetWebSearch,
		)
		workspaceTools = bridge.BuildDomainTools(
			domain.ToolsetMemoryProfile,
		)
		botsTools = bridge.BuildDomainTools(
			domain.ToolsetBots,
		)
		rootTools = bridge.BuildDomainTools(
			domain.ToolsetMemoryProfile,
			domain.ToolsetBots,
		)
	}
	if opts.EnableLoadMemory {
		workspaceTools = append(workspaceTools, loadmemorytool.New())
		rootTools = append(rootTools, loadmemorytool.New())
	}

	routineAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_routine_agent",
		Description: "Especialista em rotina pessoal: agenda (Google Calendar), tarefas, pendências, Vito Booking e reuniões.",
		Model:       llm,
		Instruction: "Você é o especialista de rotina do Vito. Gerencie compromissos na agenda, tarefas, pendências e links de agendamento com precisão em português. Use datas, compromissos e vínculos do contexto Nível 1 antes de perguntar detalhes óbvios. Se o pedido exigir também outro domínio (finanças, comunicações ou pesquisa), conclua sua etapa e devolva ao coordenador `vito_executive`.",
		Tools:       routineTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_routine_agent: %w", err)
	}

	commsAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_comms_agent",
		Description: "Especialista em comunicações omnichannel: mensagens de WhatsApp, e-mails do Gmail, rascunhos e busca de conversas.",
		Model:       llm,
		Instruction: "Você é o especialista de comunicações do Vito. Pesquise mensagens, redija rascunhos e prepare envios de WhatsApp e Gmail respeitando confirmação humana e aproveitando contatos/entidades vinculadas no contexto. Se o usuário também pediu ação de outro domínio, devolva ao coordenador após finalizar sua parte.",
		Tools:       commsTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_comms_agent: %w", err)
	}

	financeAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_finance_agent",
		Description: "Especialista financeiro Open Finance: Safe-to-Spend, cartões, faturas, parcelas, transações e orçamentos.",
		Model:       llm,
		Instruction: "Você é o especialista financeiro do Vito. Analise gastos, saldo livre (Safe-to-Spend), cartões, faturas e limites com rigor matemático sem inventar valores. Em perguntas de decisão (\"posso comprar?\", \"melhor cartão?\"), consulte o resumo financeiro, cartões e status de limites antes de concluir. Se houver ação complementar em agenda/tarefas, devolva ao `vito_executive`.",
		Tools:       financeTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_finance_agent: %w", err)
	}

	researchAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_research_agent",
		Description: "Especialista em pesquisa factual na web (SearXNG), leitura aprofundada de páginas (Jina Reader), cotações, notícias e preços.",
		Model:       llm,
		Instruction: "Você é o especialista de pesquisa factual do Vito. Consulte informações em tempo real na web e sintetize os fatos verificados com clareza, citando números e fontes reais sem inventar.",
		Tools:       researchTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_research_agent: %w", err)
	}

	workspaceAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_workspace_agent",
		Description: "Especialista em memória de longo prazo, perfil do usuário e integrações de produtividade e servidores MCP.",
		Model:       llm,
		Instruction: "Você é o especialista de memória e workspace do Vito. Quando precisar de fatos passados fora do contexto imediato, consulte a memória de longo prazo antes de responder e atualize preferências duradouras do usuário.",
		Tools:       workspaceTools,
	})
	if err != nil {
		return nil, fmt.Errorf("falha ao criar vito_workspace_agent: %w", err)
	}

	botsAgent, err := llmagent.New(llmagent.Config{
		Name:        "vito_bots_architect",
		Description: "Arquiteto de Bots proativos do Vito: cria bots via bot_create_bot, lista bots ativos e remove bots.",
		Model:       llm,
		Instruction: "Você é o arquiteto de bots do Vito. Quando o usuário pedir para criar um bot, chame imediatamente a ferramenta `bot_create_bot` preenchendo `title` e `goal` (o sistema cuida da confirmação humana automaticamente quando necessário). Nunca proponha apenas em texto nem afirme que o bot foi criado sem antes executar `bot_create_bot` com sucesso.",
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
		Instruction: "Você é o Vito, parceiro pessoal inteligente e secretário executivo do usuário. Responda sempre em português do Brasil com naturalidade e precisão. Use o contexto Nível 1 e `load_memory` (quando precisar de histórico antigo) para evitar perguntas repetidas. Orquestre sub-agentes especialistas sequencialmente quando a solicitação combinar múltiplos domínios (ex.: finanças + tarefa, e-mail + agenda). Quando o usuário pedir para criar, listar ou excluir um bot, invoque imediatamente `bot_create_bot`, `bot_list_bots` ou `bot_delete_bot` (ou delegue a `vito_bots_architect`). NUNCA afirme que criou, enviou ou excluiu algo sem antes receber confirmação real de execução da ferramenta correspondente.",
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
