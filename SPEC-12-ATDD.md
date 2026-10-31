# SPEC-12-ATDD: Inteligência Conversacional do Vito (Cérebro Único & Loop de Agente)

> **Status:** APPROVED (Stop Gate pré-autorizado via execução multiagente)
> **Risco:** L2 (Feature / API)
> **Referência:** `planning/12_INTELIGENCIA_CONVERSACIONAL_DIAGNOSTICO_E_PLANO.md` (Rev. 8)
> **Autor:** XP Multi-Agent Swarm (orchestrator + navigator)

---

## 1. Contexto & Diagnóstico (Causas C1 a C8)

O assistente Vito apresentava respostas mecânicas e parecia um chatbot de frases prontas devido a limitações estruturais:
- **C1:** Funil único `ParseIntent` forçando JSON rígido em toda mensagem conversacional.
- **C2:** Histórico injetado como texto corrido no system prompt em vez de turnos reais `user`/`assistant`.
- **C3:** Bug crítico na voz: `VitoVoiceOverlay.tsx` nunca transmitia o histórico ao backend.
- **C4:** Ausência de busca na web e coletores verticais integrados no fluxo do chat.
- **C5:** Personas contraditórias ("tom executivo sem emojis" vs. "caloroso e humano").
- **C6:** Degradação silenciosa em fallbacks para modelos pequenos sem piso de qualidade.
- **C7:** Memória curta (12 msgs no app, 8 turnos/45min no WhatsApp) sem consolidação episódica/temática.
- **C8:** Risco de contenção de concorrência no SQLite do Raspberry Pi 4 e saturação de tokens de schema.

---

## 2. Critérios de Aceitação Verificáveis (ATDD)

### AC-1: Camada de Abstração de Provedor (`backend/internal/ai/agent_contracts.go`)
- **Given:** A necessidade de desacoplar o motor conversacional de provedores específicos.
- **When:** O sistema inicializa a camada de IA.
- **Then:** Deve existir a interface `AgentProvider` com métodos `Chat`, `StreamChat`, `SupportsTools`, `SupportsVision`, `QualityTier`, `MaxContextTokens` e `Name`.
- **Metric:** Compilação com tipos definidos; `QualityTier` retorna 3 para Gemini 2.5 Flash, 2 para Groq Llama3 70B, 1 para modelos pequenos.

### AC-2: Contrato dos 8 Domain Toolsets & Tipos de Domínio (`backend/internal/domain/agent_toolset.go`)
- **Given:** A necessidade de reduzir o schema de ~50 ações para 8 Macro-Ferramentas.
- **When:** O modelo requisita uma ação estruturada.
- **Then:** As 8 ferramentas devem ser: `calendar_manager`, `task_and_pending_manager`, `meeting_and_booking_manager`, `whatsapp_assistant`, `gmail_assistant`, `radar_and_trigger_manager`, `memory_and_profile`, `web_and_vertical_search`.
- **Metric:** `DomainToolset.Name()` e `DomainToolset.Execute()` implementados; schema JSON unificado sob `ToolOperationEnvelope`.

### AC-3: Esquema do Banco de Dados SQLite (`022_memory_hierarchy.sql`)
- **Given:** O banco SQLite do Vito na versão de migração 021.
- **When:** A migração `022_memory_hierarchy.sql` é aplicada via `database.Open`.
- **Then:** Devem ser criadas ou alteradas sem erro as tabelas:
  1. `user_ai_settings` (colunas: `persona_style`, `preferred_voice`, `emoji_policy`, `response_length`);
  2. `conversation_threads` e `conversation_turns`;
  3. `pending_confirmations`;
  4. `user_memories` e `user_memories_fts`;
  5. `memory_episodes`, `memory_thematic_summaries`, `memory_episode_facts`;
  6. `memory_hierarchy_fts` (índice virtual FTS5) e seus triggers de sincronização;
  7. `ai_traces` para telemetria leve.
- **Metric:** `runMigrations` executa com sucesso (`err == nil`) e `sqlite_master` reflete todas as tabelas e índices.

### AC-4: Roteamento Inteligente com Fio Fixado (`backend/internal/ai/router.go`)
- **Given:** Uma requisição para o assistente com categoria de tarefa (chat, tool_use, grounding, etc.).
- **When:** O `ModelRouter` seleciona o provedor.
- **Then:** Operações com ferramentas de escrita NUNCA usam provedores com `QualityTier < 2`.
- **And:** Se uma tarefa escalar para o modelo forte (Tier 3), o fio de conversa (`thread_id`) deve manter o modelo fixado (*Sticky Thread*) por N minutos (default 10 min).
- **Metric:** Testes unitários comprovam que requisições subsequentes na mesma thread usam o provedor fixado.

### AC-5: Loop de Agente ReAct Padronizado (`backend/internal/service/agent_loop.go`)
- **Given:** Uma mensagem de usuário que requer consulta ou execução de ferramentas.
- **When:** O `AgentLoop.Run` ou `RunStream` é executado.
- **Then:** Executa no máximo 5 passos iterativos: (Modelo $\to$ Tool Call $\to$ Execução $\to$ Feedback de Tool $\to$ Resposta Final).
- **And:** Emite eventos em tempo real (`reasoning`, `status`, `token`, `card`, `done`).
- **Metric:** Resposta final contém `text`, `reasoning`, `tool_calls` e `cards` no contrato `UnifiedAssistantResponse`.

### AC-6: Confirmação Determinística (*Confirmation Gate* `SUSPENDED` $\to$ `RESUMED`)
- **Given:** Uma macro-ferramenta invocada para operação de escrita (`IsWriteOperation == true`).
- **When:** A operação não possui confirmação explícita prévia no prompt do usuário.
- **Then:** O executor suspende a ação, grava o rascunho em `pending_confirmations` com status `SUSPENDED`, e devolve `tool_result` sintético `AWAITING_USER_CONFIRMATION` gerando um `ChatCard` interativo.
- **And:** Quando o usuário envia confirmação com `confirm_pending_id`, a máquina de estados muda para `RESUMED` e executa a operação de forma determinística em Go.
- **Metric:** Nenhuma escrita externa é disparada sem confirmação; estado idempotente testado.

### AC-7: Taint Tracking contra Injeção Indireta de Prompt (`backend/internal/service/scope_guard.go`)
- **Given:** Uma chamada a ferramenta que lê dados externos não confiáveis (web search, e-mails recebidos, mensagens de terceiros no WhatsApp).
- **When:** O resultado da ferramenta é incorporado ao contexto do turno.
- **Then:** O turno é marcado como `TaintedByUntrustedInput = true`.
- **And:** Qualquer operação de escrita subsequente no mesmo turno ou decorrente dos dados lidos é terminantemente bloqueada a menos que passe pelo Confirmation Gate humano.
- **Metric:** Teste com prompt injetado simulado em e-mail/web bloqueia criação ou envio automático.

### AC-8: Implementação e Registro das 8 Macro-Ferramentas (`backend/internal/service/toolsets/`)
- **Given:** O registro central de ferramentas `ToolsetsRegistry`.
- **When:** O agente busca as ferramentas disponíveis.
- **Then:** Todos os 8 adaptadores de domínio delegam corretamente para os serviços existentes do Vito (`calendar_service.go`, `todo_service.go`, `whatsapp_service.go`, `gmail_service.go`, etc.) gerando `ChatCard`s ricos.
- **Metric:** Cobertura de testes unitários para cada um dos 8 toolsets.

### AC-9: Busca Unificada e Coletores Verticais (`backend/internal/service/toolsets/search_toolset.go`)
- **Given:** Uma consulta sobre preços, finanças, notícias, vagas ou web aberta.
- **When:** `web_and_vertical_search` é acionado.
- **Then:** Se a consulta for financeira, comercial ou notícias, utiliza os coletores verticais (`collectors_finance.go`, `collectors_shopping.go`, `news_fetcher.go`); para web geral, utiliza o wrapper com Gemini Grounding ou fallback SearXNG.
- **Metric:** O retorno contém `sources` estruturadas (`title`, `url`, `snippet`) e `text` sanitizado com `WrapUntrustedContent`.

### AC-10: Memória Hierárquica v2 & Consolidador Pós-Sessão (`memory_consolidation_worker.go`)
- **Given:** Uma conversa concluída ou inativa por mais de 150 segundos (debounce).
- **When:** O worker em background analisa os novos turnos da conversa.
- **Then:** Extrai fatos atômicos para `user_memories`, gera um episódio em `memory_episodes` com data e participantes, e atualiza o resumo temático correspondente em `memory_thematic_summaries`.
- **Metric:** Não há contenção com o `writer_queue` do SQLite; FTS5 sincronizado.

### AC-11: Ponte com Workers Proativos & WhatsApp Conversation Bridge
- **Given:** Uma notificação gerada por um worker proativo (ex: `morning_briefing_worker`, `reminder_worker`, `trigger_worker`).
- **When:** O alerta é despachado para o usuário.
- **Then:** A mensagem é registrada no `ConversationStore` como um turno `assistant` com `origin = "proactive_worker"`.
- **And:** Quando o usuário responde no Chat ou WhatsApp referenciando a mensagem ("adia isso", "me explica melhor"), o modelo tem o contexto do alerta no histórico.
- **Metric:** Continuidade de turnos proativos verificada em teste de integração.

### AC-12: Correção do Bug C3 da Voz & Contrato Unificado nos Clientes
- **Given:** O componente `VitoVoiceOverlay.tsx` no Mobile.
- **When:** O usuário fala com o assistente por voz.
- **Then:** O histórico de conversa (`history` e `thread_id`) é enviado no payload de `assistantAudio`.
- **And:** O cliente Desktop e Mobile compartilham o contrato `UnifiedAssistantResponse` com suporte a `ChatCard`s e SSE stream.
- **Metric:** Paridade de contrato Mobile/Desktop validada; `VitoVoiceOverlay.tsx` envia histórico real.

---

## 3. Specification by Example (SbE)

### Tabela SbE 1: Roteamento de Tarefa e Piso de Modelo (`ModelRouter`)
| Categoria da Tarefa | Provedor Candidato | QualityTier | Permitido? | Razão |
|---|---|---|---|---|
| `chat` (conversa pura) | `Groq Llama 3 8B` | 1 | ✅ Sim | Conversa geral aceita tier leve |
| `tool_use` (leitura) | `Groq Llama 3 8B` | 1 | ✅ Sim | Leitura segura permitida |
| `tool_use` (escrita) | `Groq Llama 3 8B` | 1 | ❌ Não | Proibido escrita em modelos Tier 1 |
| `tool_use` (escrita) | `Gemini 2.5 Flash` | 3 | ✅ Sim | Tier 3 apto para escrita |
| `tool_use` (escrita) | `Groq Llama 3 70B` | 2 | ✅ Sim | Tier 2 apto para escrita |
| `grounding` | Qualquer sem web | - | ❌ Não | Exige provedor ou tool de busca |

### Tabela SbE 2: Confirmation Gate e Taint Tracking
| Operação | Contexto Tainted? | Confirmação Fornecida? | Status Retornado | Executa em Go? |
|---|---|---|---|---|
| `calendar.list` | Não | Não | `COMPLETED` | ✅ Imediato |
| `calendar.create` | Não | Não | `AWAITING_USER_CONFIRMATION` | ⏸️ Suspenso (Card gerado) |
| `calendar.create` | Não | Sim (`confirm_id`) | `COMPLETED` | ✅ Executado pós-aprovação |
| `gmail.read` | Não | Não | `COMPLETED` (Taints context) | ✅ Contexto vira Tainted |
| `whatsapp.send` | Sim (Tainted) | Não | `AWAITING_USER_CONFIRMATION` | ⏸️ Suspenso Obrigatório |
| `todo.delete` | Sim (Tainted) | Sim (`confirm_id`) | `COMPLETED` | ✅ Executado com confirmação |

---

## 4. Cenários Gherkin

### Cenário 1: Conversa natural com histórico contínuo em turnos reais
```gherkin
Funcionalidade: Memória de curto prazo em turnos reais
  Dado que o usuário inicia uma conversa no App Mobile
  Quando o usuário diz "Olá, meu nome é Carlos e estou em Florianópolis"
  E o assistente responde confirmando a saudação
  E em seguida o usuário pergunta "Qual é o meu nome e onde estou?"
  Então a resposta do assistente deve conter "Carlos" e "Florianópolis"
  E as mensagens anteriores devem ter sido enviadas como turnos reais no payload
```

### Cenário 2: Escrita segura com bloqueio no Confirmation Gate
```gherkin
Funcionalidade: Interrupção determinística de escrita
  Dado que o usuário diz "Crie uma tarefa de pagar o aluguel amanhã às 10h"
  Quando o Loop de Agente processa a intenção
  Então a ferramenta "task_and_pending_manager" identifica a operação como escrita
  E o status da operação é marcado como "AWAITING_USER_CONFIRMATION"
  E um registro em "pending_confirmations" é persistido com status "SUSPENDED"
  E a resposta da API inclui requires_confirmation=true e um ChatCard do tipo "todo"
  E nenhuma tarefa foi criada no banco de dados ainda
```

### Cenário 3: Confirmação e retomada idempotente
```gherkin
Funcionalidade: Retomada de ação suspensa
  Dado uma confirmação pendente com ID "conf-123" para criação de evento
  Quando o usuário envia a requisição com confirm_pending_id = "conf-123"
  Então o status em "pending_confirmations" transiciona de "SUSPENDED" para "RESUMED"
  E o evento é criado no Google Calendar / SQLite
  E a resposta informa que o evento foi agendado com sucesso
```

### Cenário 4: Pesquisa vertical com fontes estruturadas
```gherkin
Funcionalidade: Grounding e busca vertical factual
  Dado que o usuário pergunta "Qual a cotação do dólar hoje e notícias de tecnologia?"
  Quando a ferramenta "web_and_vertical_search" é executada
  Então o coletor de finanças ou search subagent é acionado
  E a resposta final cita a cotação real obtida
  E a propriedade "sources" do JSON inclui pelo menos uma fonte com título e URL válida
```

---

## 5. Invariantes de Arquitetura & Governança

1. **Zero Mocks Cego:** Apenas chamadas de I/O de rede externa (Gemini API, SearXNG externo) são mockadas em testes unitários. O SQLite em memória e os serviços locais rodam código real.
2. **No God Files:** Nenhum arquivo criado ou alterado ultrapassará 500 linhas. Módulos grandes são decompostos em subarquivos focados.
3. **Paridade Mobile & Desktop:** O contrato da API `/api/v1/assistant/*` e os componentes visuais de cartões devem operar identicamente em ambas as plataformas.
4. **Idempotência de Confirmações:** Uma confirmação pendente só pode ser executada uma única vez; tentativas subsequentes retornam erro de duplicidade.
