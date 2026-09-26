# 🧠 Project Memory & Context Snapshot

> **Última Atualização:** 2026-09-26 17:50
> **Status Geral do Projeto:** BOOTSTRAPPING
> **Versão / Marco Atual:** v0.1.0 (Genesis — Scaffold Inicial)

---

## 1. Quick Project Summary (Semantic)
- **Propósito:** Kito — Secretária Executiva com IA Pessoal e Familiar (estilo Toki) self-hosted no Raspberry Pi 4.
- **Tech Stack:** Go (Backend) + React Native / Expo (Mobile TypeScript) + SQLite (WAL + sqlite-vec) + Docker Multi-arch (ARM64/AMD64)
- **Arquitetura Chave:** Monorepo (`/backend` em Go + `/mobile` em Expo). RAG pessoal isolado por usuário, gateway de IA com free-tiers (Google AI Studio, OpenRouter, Groq) e conectividade via Cloudflare Tunnels.
- **Especificação Detalhada:** [docs/specs/MVP_SPEC.md](file:///home/andrevmp/Downloads/kito/docs/specs/MVP_SPEC.md)
- **Comandos Essenciais:**
  - Build Backend: `cd backend && go build -v ./...`
  - Testes Backend: `cd backend && go test -v ./...`
  - Mobile Dev Server: `cd mobile && npx expo start`
  - Docker Compose: `docker compose up -d --build`

---

## 2. Current Health & System Status
- **CI/CD Status:** CONFIGURED (pipeline inicial ativo)
- **Quality Gate / Rules:** TDD Estrito + SSDLC Zero-Trust + Multi-Arch Docker
- **Última Execução / Evidência:** EV-SPEC-20260926-01 (especificação arquitetural formalizada)
- **Ambiente Ativo:** Local / Development (Raspberry Pi 4 target: `linux/arm64`)

---

## 3. Recent Changes & Activity Log (Episodic - Sliding Window: 5 Entregas)

| Data | Tipo | Descrição | Arquivos | Evidência |
|:---|:---|:---|:---|:---|
| 2026-09-26 | `FEAT` | Fase 1 concluída: Scaffold Monorepo com Backend Go (TDD GREEN), Mobile Expo TypeScript, Dockerfile multi-arch e Makefile | `backend/`, `mobile/`, `Makefile`, `docker-compose.yml` | `PASS (make test)` |
| 2026-09-26 | `DOCS` | Especificação formal do MVP e plano em 5 fases em `docs/specs/MVP_SPEC.md` | `docs/specs/MVP_SPEC.md`, `.agents/memory/PROJECT_MEMORY.md` | `PASS (EV-SPEC-20260926-01)` |
| 2026-09-26 | `FEAT` | Integração completa do XP Multi-Agent Kit v2 (symlinks, REPO_MAP, TOKEN_TELEMETRY, rules, hooks de auto-refresh) | `.agents/`, `.githooks/post-commit`, `.gitignore` | `PASS (commit 0e775c5)` |
| 2026-09-26 | `CHORE` | Bootstrap inicial: memória do projeto, git hooks, CI/CD pipeline e ignore rules | `.agents/`, `.githooks/`, `.github/workflows/ci.yml`, `AGENTS.md`, `.gitignore`, `scripts/setup-hooks.sh` | `PASS (commit 843cbc7)` |

---

## 4. Active Backlog & Immediate Handoff (Working / Episodic)
- [x] **[P1 - Fase 1] Scaffold do Monorepo:** Criar estrutura `/backend` (Go module, Dockerfile multi-arch) e `/mobile` (Expo TypeScript).
- [ ] **[P1 - Fase 2] Backend Core:** Models SQLite, migrações, autenticação JWT e endpoints de agenda/tarefas.
- [ ] **[P1 - Fase 3] AI Gateway:** Parser multimodal (áudio/texto/prints) e RAG vetorial isolado por usuário.
- [ ] **[P1 - Fase 4] Mobile UI:** Telas da agenda, botão de voz e aprovação de eventos.
- [ ] **[P1 - Fase 5] Deploy Raspberry Pi 4:** Docker Compose e Cloudflare Tunnels (`kito.rasppi.cloud`).

---

## 5. Architectural Decisions & Domain Models (Semantic Memory)
- **2026-09-26 — Stack Oficial:** Go + React Native (Expo) + SQLite (com `sqlite-vec`) + Docker multi-arch (`linux/arm64`, `linux/amd64`). Detalhes em [docs/specs/MVP_SPEC.md](file:///home/andrevmp/Downloads/kito/docs/specs/MVP_SPEC.md).
- **2026-09-26 — IA com Custo Zero:** Failover em cascata: Google AI Studio (Gemini 2.5 Flash) -> OpenRouter (`:free`) -> Groq Cloud (Llama 3.3 70B + Whisper).
- **2026-09-26 — RAG Multi-Tenant:** Cada usuário possui espaço vetorial e histórico semântico estritamente isolado por `user_id`.

---

## 6. Gotchas, Hurdles & Learned Playbooks (Procedural Memory)
- **[L-001]** (Adicionar lições aprendidas ao longo do projeto)

---

## 7. Technical Debts & Known Blockers
- Nenhum bloqueio ativo no scaffold inicial.

---

> ⚠️ **ISOLAMENTO DE MEMÓRIA:** Este arquivo pertence **exclusivamente** ao projeto `kito`.
> Não misture com a memória do XP Multi-Agent Kit (`~/.gemini/config/`) ou de outros projetos.
> Cada projeto tem seu próprio `.agents/memory/PROJECT_MEMORY.md` independente.
