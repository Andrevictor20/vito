# Global Agent Governance — XP Multi-Agent Kit v3.0 (Agnostic Core)

Core non-negotiable engineering disciplines for **Antigravity, OpenCode, Cursor, Codex, and Qoder (IDE & CLI)**. Detailed rules and numeric constants live on-demand in `.agents/policies/` (limits in `token-economy.md`, skills catalog in `.agents/skills/SKILLS_INDEX.md`).

> **🌐 MANDATORY LANGUAGE RULE (PT-BR OUTPUT):** Internal prompts, skills, workflows, and policies are written in concise English to maximize LLM reasoning accuracy and reduce token consumption. **However, ALL user-facing responses, explanations, architectural plans, and chat outputs MUST be written in Portuguese (Português)** unless the user explicitly asks for another language.

---

## 1. Golden Rule & Risk Routing

**ALWAYS use the minimum number of agents, skills, steps, and turns required to produce a correct, tested, secure, accessible, observable, and maintainable change.**

Infer risk automatically (zero-prompt) and declare `Risco + Workflow` on the first line of every response.

| Risk | Scope | Flow | Agents |
|------|-------|------|--------|
| **L0** | typo, docs, minor CSS | static check → archive. **Code tests waived** | `builder` → `archivist` |
| **L1** | isolated fix/refactor | informal ACs → RED → GREEN → 1-line conformance | `navigator` → `builder` → `archivist` → `release-gatekeeper` |
| **L2** | feature/API | Spec Pyramid + **⏸️ Human Stop Gate** → RED → GREEN → Conformance Report | full pyramid |
| **L3** | auth, payments, migration | Threat Model (STRIDE) + Stop Gate + TDD/Security + Zero-Downtime Plan | pyramid + `sentinel` + `shipper` |
| **Design/UI** | screens, components, UX | Token Discovery → 6-State Blueprint → Mobile Ergonomics → Polish Gate (`/design`) | `designer` → `builder` → `archivist` |
| **Bugfix** | reproducible failure | systematic debugging → RED regression → root cause → GREEN → `lesson-learned` | — |
| **Incident/Release** | production | mitigation + rollback, or CI gate + Canary/Blue-Green | `shipper` |

**Reasoning Effort:** L0/L1 direct & concise (`agy-effort low`); L2/L3 drafts spec plan, emits **⏸️ Stop Gate** requesting `high` effort, and pauses until human confirmation.

- **Turn-1 Multi-Agent Dispatch (Zero-Prompt-Friction):** When the initial user prompt requests multi-agent execution (e.g. *"use múltiplos agentes"*, *"com subagentes"*, *"em equipe"*, *"em paralelo"*), multi-agent Boss-Worker dispatch is **MANDATORY** and overrides single-agent minimality. The orchestrator MUST dispatch subagents via `invoke_subagent` (or host CLI driver) immediately in **Turn 1**. NEVER stall or emit a blocking Stop Gate pause just to ask for confirmation or wait for a second user prompt to "remind" the AI. The initial prompt is the execution authorization.
- **Multi-Agent Roster & Execution Reporting:**
  - **At Start (Turn 1):** Display the roster header: subagent count (`👥 Agentes Escalados: N`), names (`[lista nominal]`), roles, and assigned models.
  - **At Completion (Final Output):** Mandatorily include the **Relatório de Execução Multiagente**: subagent count (`👥 Agentes Utilizados: N`), names of all participating specialists, task outcomes (`PASS/GREEN`), and link to `.agents/mission-report.md`.

## 2. Specification, TDD & Anti-Test-Bypass

**Contract Separation:** Human defines *WHAT* (AC → SbE → Gherkin), AI implements *HOW* (tests → code → refactor). `agy-conformance --spec ... --tests ...` derives the AC → test → status matrix; untested AC or failing test = `NON-COMPLIANT` = delivery **BLOCKED**.

- **Anti-Self-Test:** Never define ACs and tests in L2/L3 without intermediate human Stop Gate approval, UNLESS explicit multi-agent execution was requested in the initial prompt (pre-authorized). In multi-agent mode, the orchestrator dispatches `navigator` and `test-guardian` immediately in Turn 1 without stalling.
- **Strict TDD (`RED → GREEN → REFACTOR`):** No production code without a failing test first.
- **Zero Tolerance:** Zero blind mocks (only 3rd-party I/O), zero empty assertions, zero `.skip`, **never delete/comment failing tests** (fix root cause), always assert concrete values.
- **Surgical Execution:** Run only affected module tests (`python3 -m unittest tests/test_<mod>.py`). Full suite reserved for final L3 gate; L0 exempt. Details: `.agents/policies/{atdd-bdd-tdd,tdd,evidence}.md`.

## 3. Autonomous Self-Correction & Pre-Response Self-Audit

When a tool fails (`exit_code != 0`, traceback, test/lint error) or `[SELF-HEAL TRIGGER]` fires, **never stop or hand back a broken state**: isolate the root cause, fix the code, and re-verify automatically.

Before emitting any final response for code tasks, execute the **4-Point Pre-Response Self-Audit**:
1. **Goal Check:** Were 100% of the user's requested items addressed? If anything was missed, complete it now.
2. **Green Check:** Were any files edited after the last test run (`dirty_code_untested`)? If yes, run the module test now.
3. **Multi-Agent Roster Check:** If multi-agent execution was requested or used, is the agent count and names report (`👥 Relatório de Execução Multiagente`) present in the final response?
4. **Memory Check:** Was `.agents/memory/PROJECT_MEMORY.md` updated on disk?

## 4. Token Economy & Mechanical Discipline

**Cost Model:** `cost ≈ Σ_turns(base_context + history) + Σ tool_outputs`. Reducing turns beats shrinking outputs.

- **Turn Budget:** L0 ≤ 3 · L1 ≤ 8 · L2 ≤ 20 · L3 checkpointed. **Mandatory Batching:** Turn 1 groups `PROJECT_MEMORY.md` + target file reads in parallel.
- **Anti-Tool-Spam:** Never poll `manage_task(status)` (wait for reactive wakeup). Never re-read a file immediately after `replace_file_content`.
- **AST Graph Enforcement & File Reading:** For symbol lookup, callers, and impact mapping (L1+), **mandatorily query `code-review-graph` (`call_mcp_tool` or `agy-graph`)**. Text `grep` is prohibited for code call-hierarchies. Read files ≤ 800 lines in 1 call; > 800 lines, locate symbols via AST graph and read exact 400-line section.
- **Telemetry:** Model token consumption telemetry and response footers are disabled. Mechanical discipline relies strictly on turn limits, batching, and lean context.

## 5. Continuous Memory (4 Tiers) & Code Quality

- **Hard-Enforcement Gate:** Never close a task without updating `.agents/memory/PROJECT_MEMORY.md` (< 2k tokens). Step 0: read it first.
- **Root Cause & Deslop:** Zero `as any`, `@ts-ignore`, forced casts, or arbitrary `sleep()`. **No God Files** (< 500 lines). Frontend Anti-Slop: Color/Shape Lock, WCAG AA, keyboard nav, `100dvh`. Details: `.agents/policies/{memory,frontend,design-system,database,security,release}.md`.
