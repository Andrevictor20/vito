# Regras Globais do Antigravity — XP Multi-Agent Kit v2

Instruções mestras, disciplinas inegociáveis e governança arquitetural do **XP Multi-Agent Kit v2**. Aplicadas estritamente a todo trabalho do Antigravity.

---

## 1. Estratégia de Execução & Roteamento por Risco (Regra de Ouro)
- **Regra de Ouro:** Use SEMPRE o menor número de agentes, skills e etapas para produzir uma alteração correta, testada, segura, acessível, observável e sustentável.
- **Roteamento Automático (Zero-Prompt):** Infira automaticamente o nível de risco e execute o fluxo correspondente sem esperar comandos do usuário:
  - **L0 (Trivial):** Typos, docs, CSS menor → `builder` → validação estática → `archivist` ([trivial.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/workflows/trivial.md)). **Fast-Path L0 & Isenção de Testes de Código:** Se o escopo da tarefa ou o `git diff` contiver apenas arquivos de documentação (`.md`, `.txt`, `.rst`, docstrings, comentários, `.gitignore`), a execução de suítes de testes de compilação/testes unitários de código de produção é FORMALMENTE DISPENSADA. Validação estática (markdown lint, formatação, git status) é suficiente, economizando de 5.000 a 15.000 tokens desnecessários.
  - **L1 (Small):** Ajustes e refatorações isoladas → `navigator` → `test-guardian` (RED) → `builder` (GREEN) → `archivist` → `release-gatekeeper` ([small.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/workflows/small.md)).
  - **L2 (Feature):** Novas funcionalidades/APIs → `navigator` + `designer`/`sentinel` → TDD Matriz → `builder` → `refactor-warden` → `archivist` → `release-gatekeeper` ([feature.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/workflows/feature.md)).
  - **L3 (Critical):** Auth, Pagamentos, Migrações estruturais → Threat Modeling (`sentinel`) → TDD + Segurança → `builder` → Zero-Downtime Plan → `archivist` → `shipper` ([critical.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/workflows/critical.md)).
  - **Bugfix:** `systematic-debugging` (4 fases) → Teste de Regressão RED → Fix Causa Raiz → GREEN → `lesson-learned` + `archivist` ([bugfix.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/workflows/bugfix.md)).
  - **Incident / Release:** Mitigação rápida e rollback ([incident.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/workflows/incident.md)) ou CI Gate rigoroso com Zero-Downtime Canary/Blue-Green ([release.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/workflows/release.md)).
- Toda resposta inicial deve declarar brevemente o **Nível de Risco** e o **Workflow** escolhido antes de iniciar a execução.
- **Modulação Adaptativa de Raciocínio & Gate Medium -> High (Regra [L-019]):** Para tarefas mecânicas ou conceituais L0/L1 (dúvidas, docs, CSS, refatoração isolada), responda de forma direta e concisa. No CLI, use o roteador inteligente (`agy-smart` ou `agy-effort`) ou perfis com reasoning effort reduzido (`agy-fast` com `--effort low` para economizar 3.000 a 8.000 tokens de raciocínio, `agy-deep` com `--effort high` para criticidade e salvaguarda de cota >80%). Na IDE, mantenha o seletor padrão sempre em `Medium`. Para tarefas de risco L2 (Feature) ou L3 (Crítico/Segurança/Arquitetura), o agente DEVE elaborar o plano de implementação em `Medium`, emitir obrigatoriamente um alerta explícito (Stop Gate) solicitando a elevação do modelo para `High` (ou `/effort high`) e PAUSAR a execução, iniciando a implementação estritamente após a confirmação do usuário.
- **Matriz Canônica de Modelo & Reasoning Effort (Regra de Ouro: Código SEMPRE em Flash):**
  - **Escrita de Código / Implementação:** O modelo utilizado para escrever código de produção DEVE ser SEMPRE o **Gemini 3.8 Flash**, variando o reasoning effort conforme o risco:
    - **L0 (Docs/Typos/CSS/Explicações):** `Gemini 3.8 Flash` com reasoning effort `low` (fast-path ativo, zero-tool para consultas conceituais).
    - **L1 (Small Refactor/Bugfix pontual):** `Gemini 3.8 Flash` com reasoning effort `medium` (testes direcionados ao módulo afetado, sem suíte completa).
    - **L2 (Features/APIs/Frontend):** `Gemini 3.8 Flash` com reasoning effort `high`.
    - **L3 (Critical/Security/Payments/Auth):** `Gemini 3.8 Flash` com reasoning effort `high` (substituindo o Pro por Flash High na escrita de código para economizar cota e maximizar velocidade).
  - **Uso Exclusivo do Gemini Pro (Apenas Planos de Implementação):** O modelo `Gemini Pro` é reservado ESTRITAMENTE para elaboração de **planos arquiteturais complexos**, Threat Modeling preliminar (STRIDE) e Stop Gates no Momento Zero. Assim que o plano for concluído e aprovado pelo usuário, a escrita do código DEVE retornar obrigatoriamente para o `Gemini 3.8 Flash` (variando o effort conforme o risco).


---

## 2. Test-Driven Development (TDD) & Anti-Test-Bypass Estrito
- **Ciclo ESTRITO:** RED -> GREEN -> REFACTOR ([tdd.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/policies/tdd.md)). Nenhum código de produção sem teste prévio falhando.
- **Matriz de Testes Multi-Camadas:** Unitários (lógica pura), Integração (DB, filas, HTTP), Contrato (schemas API), Regressão (bugs reproduzidos), E2E, Fuzzing e Segurança (SAST/DAST).
- **Anti-Test-Bypass (Tolerância Zero):**
  - **Isenção de Escopo em L0:** A obrigatoriedade de suíte de testes de backend aplica-se a código de produção (código-fonte executável). Alterações estritamente documentais e de estilo cosmético não exigem suíte completa de testes.
  - **Execução Cirúrgica e Sob Demanda (Targeted & On-Demand Testing):** Testes NUNCA devem ser executados de forma indiscriminada rodando a suíte inteira do projeto (`discover`, `pytest`, `npm test` geral) para alterações pontuais ou refatorações isoladas. Execute testes ESTRITAMENTE quando houver alteração de lógica em código executável e direcionados exclusivamente ao arquivo ou módulo afetado (ex: `python3 -m unittest tests/test_<modulo>.py`). A suíte completa é reservada exclusivamente para validação final de release (L3 / Pre-Release Gatekeeper) ou quando expressamente requisitada pelo usuário, poupando de 5.000 a 20.000 tokens de payload de ferramentas por ciclo.
  - **Zero Mocks Cegos:** Permitido mocar apenas I/O externo de terceiros; nunca mocar lógica interna para forçar passagem de teste.
  - **Zero Asserções Vazias:** Proibido testes sem `assert` ou com `assert(true)`.
  - **Zero Skips:** Proibido `.skip`, `xit`, `@pytest.mark.skip` ou flags como `--passWithNoTests`.
  - **Proibido Deletar/Comentar Testes:** Testes quebrados devem ser corrigidos na causa raiz do código de produção.
- **Evidência Obrigatória:** Relatório com output nativo de execução dos testes incluído em `walkthrough.md` ([evidence.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/policies/evidence.md)).

---

## 3. Evidência de Execução de Toolchain Nativa
- Afirmações verbais ("testes passaram") são estritamente rejeitadas.
- Execute os comandos reais (`npm test`, `pytest`, `cargo test`, linters) e observe o output real ([test-evidence-walkthrough](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/test-evidence-walkthrough/SKILL.md)). Nunca force exit codes artificiais.

---

## 4. Segurança SSDLC & Zero Trust
- Aplique **Threat Modeling (STRIDE)** para auth, pagamentos, privacidade e integrações ([security.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/policies/security.md), [threat-modeling](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/threat-modeling/SKILL.md)).
- Governança de segredos ([secrets-guardian](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/secrets-guardian/SKILL.md)), criptografia robusta, hardening de containers non-root e Zero Trust via OIDC/Cosign. Vulnerabilidades altas bloqueiam releases.

---

## 5. Protocolo de Handoff Estruturado
- Transições entre agentes e fechamentos de sessão exigem o **Handoff Packet Estruturado** ([agent-handoff.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/policies/agent-handoff.md)) com: `from_agent`, `to_agent`, `summary`, `files_touched`, `open_questions`, `next_steps` e `verification_evidence`.

---

## 6. Release Gatekeeper, CI/CD Auto-Healer & Deploy Zero-Downtime
- CI estrito, validação de segurança estática, commits atômicos ([atomic-commit-discipline](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/atomic-commit-discipline/SKILL.md)) e verificação completa antes de merge ([release.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/policies/release.md)).
- **CI/CD Auto-Healer & Loop de Autocorreção:** Monitoramento autônomo de esteiras remotas (GitHub Actions) e locais. Em caso de falha, extração cirúrgica de causa raiz (`agy-ci-heal`), correção sistemática no código/configuração e re-tentativa atômica limitada a **no máximo 3 iterações consecutivas** (Regra [L-003]) ([ci-auto-heal](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/ci-auto-heal/SKILL.md)).
- Deploys em produção utilizam Blue/Green ou Canary gradual com telemetria RED e gatilho de rollback automatizado ([zero-downtime-deployment](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/zero-downtime-deployment/SKILL.md)).

---

## 7. Memória Contínua em 4 Tiers & Persistência Forçada em Disco
- **Hard-Enforcement Gate:** PROIBIDO encerrar tarefas sem **gravar fisicamente em disco** o arquivo `.agents/memory/PROJECT_MEMORY.md`.
- **Fast Bootstrap (Passo 0):** Consulte `.agents/memory/PROJECT_MEMORY.md` no início da sessão ([project-memory](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/project-memory/SKILL.md)).
- **Auto-Onboarding (Passo 0-A):** Se ausente ou vazio, popule via `git log -n 10 --oneline`, manifestos do projeto, testes e crie o arquivo via template.
- **Hierarquia 4 Tiers:** *Working Memory* (sessão), *Episodic* (log recente + [archive/HISTORY.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/memory/archive/HISTORY.md)), *Semantic* (ADRs e arquitetura) e *Procedural* (lições aprendidas `[L-NNN]` via [lesson-learned](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/lesson-learned/SKILL.md)).
- **Telemetria de Tokens em 3 Camadas & Exibição Obrigatória em Rodapé:** Monitore ativamente a Janela de Mensagem, a Janela Móvel de 5 Horas e a Cota Semanal via `xp-tokens` ou `agy-tokens` (<usado>/<total>).
  - **Rodapé Obrigatório em Cada Resposta (IDE & CLI) — Universal para Todos os Modelos:** Toda resposta final enviada pelo assistente (no Antigravity CLI ou na IDE, tanto para modelos Google quanto Claude/OpenAI/outros) DEVE obrigatoriamente incluir no rodapé o bloco padronizado com o consumo desta mensagem (delta de entrada, ferramentas e resposta) e a telemetria acumulada em 3 camadas (`agy-tokens --turn`), seguindo com rigor absoluto o seguinte formato canônico (sem backticks extras nas métricas e mantendo alinhamento idêntico):
    ```text
    Consumo:  16.2k tokens (Entrada: 113 | Ferramentas: 15.1k | Resposta: 959)  
    Contexto: [▰▱▱▱▱▱▱▱▱▱] 6.0% usado (63.2k) • 94.0% livre de 1.05M  
    5h:       [▱▱▱▱▱▱▱▱▱▱] 1.0% usado (8.1k) • 99.0% restante (~791.9k) de 800.0k (renova em 4 h, 46 m)  
    Semana:   [▰▰▰▰▰▱▱▱▱▱] 50.9% usado (5.09M) • **49.1% restante (4.91M)** de 10.00M (renova em 5 d, 19 h)  
    Modelo:   Gemini 3.8 Flash (Effort: Medium) | Janela: 1.05M | Saída: 65.5k
    ```
    - **Modelos Google (Gemini):** O `token_tracker.py` usa dados ao vivo do Language Server RPC (`gemini-5h`, `gemini-weekly`).
    - **Modelos Terceiros (Claude e GPT):** O Antigravity Language Server RPC expõe dados oficiais e em tempo real sob o grupo `Claude and GPT models` (`3p-5h`, `3p-weekly`). O `token_tracker.py` lê essa cota real ao vivo (idêntica à UI oficial). Fallback estimado (`[Estimado · Provider]`) é usado estritamente quando o Language Server estiver indisponível ou para provedores sem integração direta (ex: DeepSeek local). O agente NUNCA deve omitir ou simplificar o rodapé.
  - **Relatório Exaustivo em Consultas de Consumo no Chat:** Sempre que o usuário perguntar no chat (IDE ou CLI) sobre consumo, cotas ou tokens ("quanto gastei", "meus dados de consumo", etc.), o agente DEVE fornecer o **máximo de informações possíveis**: modelo utilizado e limites (janela de contexto e saída máxima), consumo e margem livre na sessão, cota oficial ao vivo (Language Server) com percentual restante e tempo exato para refresh/renovação (5h e semanal), decomposição do consumo (System Prompt, Ferramentas, Respostas, Mensagens) e status geral de integridade.
  - **Pre-Flight Gate:** Se qualquer camada estiver crítica (>80% em 5h/Semana ou >70% em Contexto), alerte o usuário antes de iniciar tarefas substantivas. Se o usuário insistir em prosseguir, opere em **Modo Cirúrgico Atômico**: execute estritamente o que for cabível no orçamento restante, garantindo um checkpoint completo, testado e estável, sem deixar trabalho pela metade ([token-budget-tracker](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/token-budget-tracker/SKILL.md)).
- **Protocolo Anti-Flood, Sanitização Estrita & Zero-Tool para Consultas (L0):** Para perguntas conceituais, dúvidas teóricas, explicações ou bate-papo técnico, é ESTRITAMENTE PROIBIDO invocar ferramentas (`run_command`, `view_file`, `list_dir`, `grep_search`) — responda diretamente em texto puro, zerando o consumo de ferramentas. Ao executar ferramentas em tarefas práticas de código:
  - **Smart Tool Optimizer Ativo (PreToolUse Hook):** O hook nativo `smart-tool-optimizer` intercepta chamadas via `overwrite` e `deny`:
    - **Loop Detection & Anti-Repetição:** Bloqueia automaticamente com `deny` ferramentas executadas 3x consecutivas com os mesmos argumentos.
    - **Proteção de Workspace (`list_dir`):** Bloqueia listagens na raiz do workspace; exige uso do `REPO_MAP.md` ou caminhos específicos.
    - **Filtro de Ruído em `grep_search`:** Injeta automaticamente exclusões de diretórios ruidosos (`node_modules`, `.git`, `dist`, `__pycache__`, etc.) quando `Includes` estiver vazio.
    - **Clamp Cirúrgico em `view_file` & Anti-Fatiamento:** Teto calibrado de **máximo 60 linhas por leitura** (`EndLine - StartLine <= 60`) com detecção ativa de leitura contígua para evitar a armadilha do fatiamento cego $O(N^2)$.
    - **Sanitização Mandatória de `run_command`:** Injeção automática de `agy-sanitize` em comandos verbosos sem limitador.
    - **Bloqueio Ativo de `write_to_file` em Arquivos Existentes (>40 linhas):** Bloqueio com `deny` no hook PreToolUse forçando o uso obrigatório de `replace_file_content` com blocos atômicos (< 20 linhas), eliminando reenvios redundantes de arquivos completos no payload.
  - **Deduplicação Estrita de Mensagens Ephemerais de Hooks:** Bloqueio de injeções redundantes de diretrizes no mesmo turno/prompt, eliminando até 40.000 tokens desnecessários por sessão.
  - **Repo Map & Symbol-First Navigation (Passo 0 anti-exploração cega):** O agente DEVE consultar `.agents/memory/REPO_MAP.md` e localizar símbolos via `grep_search` cirúrgico antes de ler arquivos, eliminando cadeias exploratórias e o custo acumulado em sub-etapas.
  - **Proibição de `write_to_file` em Arquivos Existentes:** Sempre use `replace_file_content` com chunks atômicos (< 20 linhas) para evitar reenviar o arquivo completo no payload de contexto.
  - **Operações Git e CI/CD Ultra-Econômicas (< 1k tokens):** É TERMINANTEMENTE PROIBIDO despejar diffs ou logs brutos de esteiras no contexto. Use exclusivamente: status compacto (`git status -s` ou `agy-git-ops status`), diffs resumidos (`git diff --stat`, `git show --stat` ou `agy-compact --diff`), histórico oneline (`git log -n 5 --oneline`) e push silencioso (`git push --quiet`). Para monitoramento de CI/CD (GitHub Actions), NUNCA execute `gh run view --log` completo; use estritamente `agy-git-ops ci-status` ou extração cirúrgica de falha via `gh run view --log-failed | agy-compact --ci` (ou `agy-ci-heal`), poupando de 10.000 a 15.000 tokens por ciclo de release.
- **Saídas Efêmeras & Auto-Compact (15 Turnos / 40k Tokens):** O histórico de saídas de ferramentas antigas acumula e encarece exponencialmente a conversa. Ao atingir 15 turnos ou 40k tokens na sessão ativa, execute obrigatoriamente o checkpoint no [PROJECT_MEMORY.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/memory/PROJECT_MEMORY.md) e instrua a abertura de um chat limpo via Fast Bootstrap (Passo 0), eliminando até 75% do desperdício de tokens acumulados.

---

## 8. Frontend Anti-Slop, Design Systems & Copywriting de Conversão
- **Anti-Slop Framework:** Proibido UI genérica de IA e em-dashes (—) excessivos ([frontend.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/policies/frontend.md), [frontend-taste-engineering](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/frontend-taste-engineering/SKILL.md)).
- **Calibração Visual & Tokens:** Calibre Dials (VARIANCE/MOTION/DENSITY), aplique Color Consistency Lock e Shape Lock com raios concêntricos ($R_{inner} = R_{outer} - P$) ([design-system.md](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/policies/design-system.md), [design-tokens](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/design-tokens/SKILL.md)).
- **Copywriting & CRO:** Headlines orientadas a benefício ("E daí?"), redução de atrito e SEO semântico ([conversion-copywriting](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/conversion-copywriting/SKILL.md), [seo-content-engine](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/seo-content-engine/SKILL.md)).
- **UI Quality Gate:** Validação WCAG AA, navegação por teclado, viewport `100dvh` e responsividade real ([ui-quality-gate](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/ui-quality-gate/SKILL.md)).

---

## 9. Causa Raiz, Anti-Workarounds & Code Deslop
- **No Workarounds:** Corrija na fonte. Proibido mascarar erros com `as any`, `@ts-ignore`, casts forçados ou sleeps artificiais ([no-workarounds](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/no-workarounds/SKILL.md)).
- **Code Deslop:** Elimine comentários óbvios, código morto e imponha a regra *No God Files* (< 500 linhas por arquivo) ([code-deslop-review](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/code-deslop-review/SKILL.md), [refactor-watchdog](file:///home/andrevmp/Downloads/xp-multiagent-kit/.agents/skills/refactor-watchdog/SKILL.md)).

---

## 10. Arquitetura Modular, SDD, TDD & Regra Anti-God-Files
- **Engenharia Guiada por Especificação (SDD):** Toda nova funcionalidade deve derivar de uma especificação ou contrato formal antes da implementação ([spec-driven-development](file:///home/andrevmp/Downloads/vito/.agents/skills/spec-driven-development/SKILL.md)).
- **Ciclo TDD Rigoroso:** RED (teste falhando) -> GREEN (código mínimo) -> REFACTOR ([tdd-safety-net](file:///home/andrevmp/Downloads/vito/.agents/skills/tdd-safety-net/SKILL.md)). Proibido escrever código de produção sem teste nativo correspondente.
- **Estruturação Modular & No God Files:**
  - Arquivos devem ser estritamente focados e coesos, com teto recomendado de **200 a 300 linhas** e **limite máximo absoluto de 500 linhas** ([refactor-watchdog](file:///home/andrevmp/Downloads/vito/.agents/skills/refactor-watchdog/SKILL.md), [.agents/rules/modular-architecture.md](file:///home/andrevmp/Downloads/vito/.agents/rules/modular-architecture.md)).
  - **Backend (Go):** Clean Architecture estrita: `internal/domain` (entidades/interfaces), `internal/database` (sqlite), `internal/repository` (persistência), `internal/service` (casos de uso), `internal/ai` (adaptadores IA) e `internal/handler` (HTTP/JSON).
  - **Mobile (React Native):** Componentes atômicos reaproveitáveis (< 150 linhas), telas desacopladas (< 250 linhas) e custom hooks isolados.

---

## 🗺️ Mapa de Diretórios e Recursos do Kit
- **Agentes (`.agents/agents/`):** `orchestrator`, `navigator`, `designer`, `sentinel`, `test-guardian`, `builder`, `refactor-warden`, `archivist`, `release-gatekeeper`, `shipper`, `genesis`.
- **Workflows (`.agents/workflows/`):** `trivial.md` (L0), `small.md` (L1), `feature.md` (L2), `critical.md` (L3), `spec-driven.md` (SDD), `migration.md`, `performance-benchmark.md`, `bugfix.md`, `incident.md`, `release.md`.
- **Políticas (`.agents/policies/`):** `tdd.md`, `release.md`, `memory.md`, `frontend.md`, `design-system.md`, `security.md`, `database.md`, `evidence.md`, `agent-handoff.md`.
- **Memória (`.agents/memory/`):** `PROJECT_MEMORY.md`, `archive/HISTORY.md`, `TOKEN_TELEMETRY.md`.
- **Skills (`.agents/skills/`):** 71 skills especializadas carregadas sob demanda.
