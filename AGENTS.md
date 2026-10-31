# Global Agent Governance — XP Multi-Agent Kit v3.9 (Agnostic Core)

Core engineering disciplines for **Antigravity, OpenCode, Cursor, Codex, Qoder, and Claude (IDE & CLI)**. Detailed rules and constants live in `.agents/policies/` (`token-economy.md`, `.agents/skills/SKILLS_INDEX.md`).

> **🌐 MANDATORY LANGUAGE RULE (PT-BR OUTPUT):** Internal prompts, skills, workflows, and policies are in concise English for LLM accuracy. **However, ALL user-facing responses, explanations, architectural plans, and chat outputs MUST be in Portuguese (Português)** unless requested otherwise.

---

## 1. Golden Rule: Completeness Over Speed & Risk Routing

**COMPLETENESS FIRST: Always prioritize 100% exhaustive planning, Multi-Pass EGM (Elephant-Goldfish Model) reviews, and complete end-to-end feature delivery over execution speed or turn count, regardless of how long it takes.** Never truncate a plan, leave placeholders (`TODO`/`TBD`), or cut corners.

Infer risk automatically (zero-prompt) and declare `Risco + Workflow` on line 1 of every response.

| Risk | Scope | Flow | Agents |
|------|-------|------|--------|
| **L0** | typo, docs, minor CSS | static check → archive. **Code tests waived** | `builder` → `archivist` |
| **L1** | isolated fix/refactor | informal ACs → RED → GREEN → EGM check → conformance | `navigator` → `builder` → `archivist` → `release-gatekeeper` |
| **L2** | feature/API/planning | Spec Pyramid + **EGM Pass 1** + **⏸️ Stop Gate** → RED → GREEN → **EGM Pass 2 & 3** → Conformance | full pyramid + Goldfish |
| **L3** | auth, payments, migration | STRIDE + **EGM Pass 1** + Stop Gate → TDD/Security → **EGM Pass 2 & 3** → Zero-Downtime | pyramid + `sentinel` + `shipper` + Goldfish |
| **Design/UI** | screens, components, UX | Token Discovery → 6-State Blueprint → Mobile Ergonomics → Polish Gate (`/design`) | `designer` → `builder` → `archivist` |
| **Bugfix** | reproducible failure | systematic debugging → RED regression → root cause → GREEN → `lesson-learned` | — |
| **Incident/Release** | production | mitigation + rollback, or CI gate + Canary/Blue-Green | `shipper` |

**Reasoning Effort:** L0 uses `low`; L1 uses `medium`; L2/L3 (planning and implementation) use `high` (`agy-effort high`) without turn-based throttling.

- **Turn-1 Multi-Agent Dispatch:** When initial prompt requests multi-agent or EGM execution (*"use múltiplos agentes"*, *"com subagentes"*, *"em equipe"*, *"usar EGM"*), Boss-Worker dispatch is **MANDATORY** and pre-authorized in **Turn 1** via `invoke_subagent` without stalling at a Stop Gate.
- **Multi-Agent Roster & Reporting:** At Start (Turn 1), display `👥 Agentes Escalados: N`, names, roles, and models. At Completion, include **Relatório de Execução Multiagente** (`👥 Agentes Utilizados: N`, specialists, EGM passes, outcomes `PASS/GREEN`, `.agents/mission-report.md`).

## 2. Specification, Multi-Pass EGM Review, TDD & Anti-Test-Bypass

**Contract Separation & EGM Protocol (`xp-goldfish` / `agy-goldfish`):** Human defines *WHAT* (AC → SbE → Gherkin), AI implements *HOW* (tests → code → refactor), audited by **3 Mandatory EGM Goldfish Review Passes** (`goldfish-spec-review`):
- **EGM Pass 1 (Planning & Zero-Decision Readiness):** Validate Heilmeier Catechism (6 dimensions), Alternatives Considered, Zero-Decision Target Files (`Create`/`Modify`/`Delete`), and zero placeholders (`TODO`/`TBD`/`{{...}}`).
- **EGM Pass 2 (Implementation & Codebase Details):** Audit all implemented files for completeness, `< 500` lines, and zero stubs/workarounds (`NotImplementedError`, `as any`, `@ts-ignore`).
- **EGM Pass 3 (Spec-vs-Code Drift & Conformance):** Verify 100% of `AC-N` items have passing tests via `xp-goldfish --multipass` and `agy-conformance`. Untested AC or failing test = `NON-COMPLIANT` = delivery **BLOCKED**.
- **Strict TDD (`RED → GREEN → REFACTOR`):** No production code without a failing test first. Zero blind mocks, zero empty assertions, zero `.skip`, **never delete/comment failing tests**.

## 3. Autonomous Self-Correction & 5-Point Pre-Response Self-Audit

When a tool fails (`exit_code != 0`, traceback, test/lint error) or `[SELF-HEAL TRIGGER]` fires, isolate the root cause, fix the code, and re-verify automatically. Before emitting any final response for code/planning tasks, execute the **5-Point Self-Audit**:
1. **Completeness Check:** Were 100% of requested features and planning items delivered completely without shortcuts or `TODO`/`TBD` placeholders?
2. **Multi-Pass EGM Check:** Did the spec and code pass all 3 EGM Goldfish Review passes (`xp-goldfish --multipass`)?
3. **Green Check:** Were any files edited after the last test run (`dirty_code_untested`)? If yes, run the tests now.
4. **Multi-Agent Roster Check:** If subagents/EGM were used, is `👥 Relatório de Execução Multiagente` present?
5. **Memory Check:** Was `.agents/memory/PROJECT_MEMORY.md` updated on disk?

## 4. Mechanical Discipline & AST Graph Enforcement

- **Completeness Overrides Turn Caps:** Turn budgets (`kit_constants.py`) are soft orientation, never a reason to rush or stop early. Batch independent reads in parallel (Turn 1 groups `PROJECT_MEMORY.md` + target files) and never poll `manage_task(status)`.
- **AST Graph Enforcement:** For symbol lookup, callers, and impact mapping (L1+), **mandatorily query `code-review-graph` (`call_mcp_tool` or `agy-graph`)**. Text `grep` is prohibited for call-hierarchies. Read files ≤ 800 lines in 1 call.

## 5. Continuous Memory (4 Tiers) & Code Quality

- **Hard-Enforcement Gate:** Never close a task without updating `.agents/memory/PROJECT_MEMORY.md` (< 2k tokens). Step 0: read it first.
- **Root Cause & Deslop:** Zero `as any`, `@ts-ignore`, forced casts, or `sleep()`. **No God Files** (< 500 lines). Details: `.agents/policies/{memory,frontend,design-system,database,security,release}.md`.
