# Regras Globais do Antigravity — XP Multi-Agent Kit v2

Disciplinas inegociáveis em núcleo enxuto: o detalhamento vive em `.agents/policies/` (sob demanda) e os valores numéricos apenas em `scripts/kit_constants.py`.

---

## 1. Regra de Ouro & Roteamento por Risco

**Use SEMPRE o menor número de agentes, skills, etapas e turnos capaz de produzir uma alteração correta, testada, segura, acessível, observável e sustentável.**

Infira o risco automaticamente (zero-prompt) e declare risco + workflow na primeira linha de toda resposta.

| Risco | Escopo | Fluxo | Agentes |
|-------|--------|-------|---------|
| **L0** | typo, docs, CSS menor | validação estática → arquivar. **Testes de código dispensados** | `builder` → `archivist` |
| **L1** | ajuste/refatoração isolada | AC informais → RED → GREEN → conformidade resumida | `navigator` → `builder` → `archivist` → `release-gatekeeper` |
| **L2** | feature/API | Pirâmide de Especificação + **⏸️ Stop Gate humano** → RED → GREEN → Conformance Report | pirâmide completa |
| **L3** | auth, pagamentos, migração | Threat Modeling (STRIDE) + Stop Gate + TDD/segurança + Zero-Downtime Plan | pirâmide + `sentinel` + `shipper` |
| **Design/UI** | telas, componentes, UX | Token Discovery → 6 Estados → Ergonomia Mobile → Polish Gate (`/design`) | `designer` → `builder` → `archivist` |
| **Bugfix** | falha reproduzível | debugging sistemático → regressão RED → causa raiz → GREEN → `lesson-learned` | — |
| **Incident/Release** | produção | mitigação + rollback, ou CI gate + Canary/Blue-Green | `shipper` |

Workflows completos em `.agents/workflows/` (incluindo `design.md`).

**Esforço de raciocínio:** L0/L1 direto e conciso (CLI: `agy-effort low`); L2/L3 elabora o plano, emite **Stop Gate** pedindo elevação para `high` e pausa até confirmação. Código no Flash (effort por risco); Pro reservado a planos arquiteturais e STRIDE.

## 2. Especificação, TDD & Anti-Test-Bypass

**Separação de contrato:** humano define *o quê* (AC → SbE → Gherkin), IA implementa *como* (testes → código → refatoração). `agy-conformance --spec ... --tests ...` deriva a matriz AC → teste → status; AC sem teste ou teste em falha = `NON-COMPLIANT` = entrega **bloqueada**.

Pirâmide obrigatória em L2/L3 com **⏸️ Stop Gate** humano antes de qualquer código. **Regra Anti-Self-Test:** a IA nunca define critérios e testes sem aprovação humana intermediária. Ciclo TDD estrito RED → GREEN → REFACTOR: nenhum código de produção sem teste prévio falhando.

Tolerância zero: **zero mocks cegos** (só I/O de terceiros), **zero asserções vazias**, **zero skips**, **proibido deletar/comentar testes** (corrigir a causa raiz), **asserção de valor**.

**Execução cirúrgica:** testes só com mudança em código executável e no módulo afetado (`python3 -m unittest tests/test_<modulo>.py`). Suíte completa só no gate L3; L0 isento. Detalhes: `.agents/policies/{atdd-bdd-tdd,tdd,evidence}.md`.

## 3. Evidência & Segurança

Afirmações verbais são rejeitadas: execute o comando real e observe o output. O log completo fica em `.agents/runtime/evidence/`; o `walkthrough.md` recebe só a tabela resumo (`agy-evidence run` / `render`), nunca o output bruto.

SSDLC e Zero Trust: STRIDE para auth/pagamentos/privacidade, governança de segredos, hardening non-root, OIDC/Cosign; vulnerabilidade alta bloqueia release. CI Auto-Healer: máx. **3 iterações** ([L-003]). Deploy Blue/Green ou Canary + telemetria RED + rollback. Detalhes: `.agents/policies/{security,release}.md`.

## 4. Economia de Tokens (disciplina central)

**Modelo de custo:** `custo ≈ Σ_turnos(contexto + histórico) + Σ saídas`. Reduzir turnos e contexto base vale mais do que encolher saídas.

- **Orçamento de turnos:** L0 ≤ 3 · L1 ≤ 8 · L2 ≤ 20 · L3 com checkpoint. **Batching obrigatório.** Turno 1: agrupar leitura de memória + arquivos alvo.
- **Anti-Tool-Spam:** Proibido polling com `manage_task(status)` (aguarde notificação reativa). Proibido reler arquivo imediatamente após edição (`replace_file_content`).
- **Leitura:** arquivo ≤ 800 linhas → inteiro em 1 chamada; acima → localizar símbolo e pedir intervalo exato.
- **Comandos:** `agy-run` (ou `agy-sanitize`) remove ruído e registra telemetria. `WaitMsBeforeAsync: 8000` em testes assíncronos. Git/CI só compacto.
- **L0 conceitual:** zero ferramenta, resposta direta.
- **Navegação:** `REPO_MAP.md` + grep antes de ler. Proibido `write_to_file` acima de `WRITE_TO_FILE_MAX_LINES`.
- **Telemetria:** 3 camadas (turno · reenvio · cota). **Rodapé canônico OBRIGATÓRIO no final de TODA resposta** (`agy-tokens --turn`). Pre-Flight: > 70% contexto ou > 80% cota → alertar.
- **Auto-compact:** checkpoint periódico (`scripts/kit_constants.py`).

Detalhes: `.agents/policies/token-economy.md`.

## 5. Memória Contínua (4 Tiers) & Handoff

**Hard-Enforcement Gate:** proibido encerrar tarefa sem gravar `.agents/memory/PROJECT_MEMORY.md`. **Passo 0:** ler esse arquivo (< 2k tokens). Tiers: *Working* · *Episodic* · *Semantic* (ADRs) · *Procedural* (`[L-NNN]`). Handoff Packet obrigatório entre agentes (`agy-handoff`).

## 6. Qualidade de Código & Frontend

Causa raiz sempre: sem `as any`, `@ts-ignore`, cast forçado ou sleep artificial. Code Deslop: sem comentários óbvios, **No God Files** (< 500 linhas). Frontend Anti-Slop: sem UI genérica, Color/Shape Lock, WCAG AA, teclado, viewport `100dvh`. Detalhes: `.agents/policies/{frontend,design-system,database}.md`.

## 🗺️ Mapa de Recursos

- **Agentes:** `orchestrator`, `navigator`, `designer`, `sentinel`, `test-guardian`, `builder`, `refactor-warden`, `archivist`, `release-gatekeeper`, `shipper`, `genesis` (`.agents/agents/`).
- **Políticas** (`.agents/policies/`): `token-economy`, `atdd-bdd-tdd`, `tdd`, `evidence`, `memory`, `agent-handoff`, `release`, `security`, `frontend`, `design-system`, `database`.
- **Skills/Memória/CLI:** catálogo em `SKILLS_INDEX.md`; memória em `.agents/memory/`; CLI e templates em `.agents/policies/token-economy.md`.
