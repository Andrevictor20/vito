# 🧠 Project Memory & Context Snapshot

> **Última Atualização:** 2026-09-26 17:50
> **Status Geral do Projeto:** BOOTSTRAPPING
> **Versão / Marco Atual:** v0.1.0 (Genesis — Scaffold Inicial)

---

## 1. Quick Project Summary (Semantic)
- **Propósito:** Vito — Secretário Executivo com IA Pessoal e Familiar self-hosted no Raspberry Pi 4.
- **Tech Stack:** Go (Backend) + React Native / Expo (Mobile TypeScript) + SQLite (WAL + sqlite-vec) + Docker Multi-arch (ARM64/AMD64)
- **Arquitetura Chave:** Monorepo (`/backend` em Go + `/mobile` em Expo). RAG pessoal isolado por usuário, gateway de IA com free-tiers (Google AI Studio, OpenRouter, Groq) e conectividade via Cloudflare Tunnels.
- **Especificação Detalhada:** [docs/specs/MVP_SPEC.md](file:///home/andrevmp/Downloads/vito/docs/specs/MVP_SPEC.md)
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
| 2026-09-26 | `UPGRADE` | Upgrade oficial do Mobile para Expo SDK 57 (React 19, React Native 0.86) compatível com Expo Go atual de 2026 | `mobile/package.json`, `mobile/package-lock.json` | `PASS (npx tsc 0 errors + sdkVersion 57.0.0 confirmado)` |
| 2026-09-26 | `FIX/FEAT` | Correção de sintaxe no Dockerfile (comentário `#`) para destravar CI/CD no GH Actions e adição do Watchtower (intervalo de 60s, cleanup e label enable) no `docker-compose.prod.yml` para auto-update no Raspberry Pi 4 | `backend/Dockerfile`, `docker-compose.prod.yml` | `PASS (docker build local 20/20 FINISHED)` |
| 2026-09-26 | `FEAT` | Zero-Token Scope Guard (Tier 0) para rejeição instantânea de matemática e off-topic, integração de chaves Gemini/Groq/OpenRouter no `.env`, modelos atualizados e compatibilidade retroativa mobile (`prompt`/`text`, `reply`/`message`) | `backend/internal/service/scope_guard.go`, `assistant_service.go`, `main.go`, `mobile/` | `PASS (TestAssistantService_ScopeGuard_BlocksOffTopicAndMath + curl e2e 200 OK)` |
| 2026-09-26 | `FEAT` | Fase 5 concluída: CI/CD com GitHub Actions, compilação multi-arch (linux/arm64 e linux/amd64), publicação automática no GHCR e docker-compose.prod.yml para o Raspberry Pi 4 | `.github/workflows/ci.yml`, `docker-compose.prod.yml`, `backend/Dockerfile` | `PASS (Docker build multi-arch OK)` |
| 2026-09-26 | `FEAT` | Fase 4 concluída: Mobile UI (Experiência Toki) em React Native Expo 52 Web/Mobile com Auth JWT, Timeline de Agenda, Checklist de Tarefas, Floating Assistant Bar e Modal de Intenções/Conflitos | `mobile/src/`, `mobile/App.tsx`, `mobile/index.ts` | `PASS (npx tsc + Metro Web bundle 200 OK)` |

---

## 4. Active Backlog & Immediate Handoff (Working / Episodic)
- [x] **[P1 - Fase 1] Scaffold do Monorepo:** Criar estrutura `/backend` (Go module, Dockerfile multi-arch) e `/mobile` (Expo TypeScript).
- [x] **[P1 - Fase 2] Backend Core:** Models SQLite, migrações, autenticação JWT e endpoints de agenda/tarefas.
- [x] **[P1 - Fase 3] AI Gateway:** Parser multimodal (áudio/texto/prints) e RAG vetorial isolado por usuário.
- [x] **[P1 - Fase 4] Mobile UI:** Telas da agenda, botão de voz e aprovação de eventos.
- [x] **[P1 - Fase 5] Deploy Raspberry Pi 4:** Docker Compose, CI/CD multi-arch GHCR e Cloudflare Tunnels (`kito.rasppi.cloud`).

---

## 5. Architectural Decisions & Domain Models (Semantic Memory)
- **2026-09-26 — Stack Oficial:** Go + React Native (Expo) + SQLite (com `sqlite-vec`) + Docker multi-arch (`linux/arm64`, `linux/amd64`). Detalhes em [docs/specs/MVP_SPEC.md](file:///home/andrevmp/Downloads/vito/docs/specs/MVP_SPEC.md).
- **2026-09-26 — IA com Custo Zero:** Failover em cascata: Google AI Studio (Gemini 2.5 Flash) -> OpenRouter (`:free`) -> Groq Cloud (Llama 3.3 70B + Whisper).
- **2026-09-26 — RAG Multi-Tenant:** Cada usuário possui espaço vetorial e histórico semântico estritamente isolado por `user_id`.

---

## 6. Gotchas, Hurdles & Learned Playbooks (Procedural Memory)
- **[L-001] Git Pre-commit Regex Precision:** Marcadores de conflito de merge devem casar especificamente `^[+](<{7}\s|={7}\s*$|>{7}\s)` para evitar falso positivo em cabeçalhos de comentários `# ======`.
- **[L-002] Modularidade Estrita e Anti-God-Files Mandatórios:** Arquivos limitados a 200-300 linhas (<500 max rígido). Todo backend em Go segue Clean Architecture (`domain`, `database`, `repository`, `service`, `ai`, `handler`) e Mobile segue atomic design (<150 linhas por componente, <250 por tela). TDD/SDD inegociável.
- **[L-003] Zero-Token Local Scope Guard & Interoperabilidade DTO:** Consultas matemáticas (ex: `923/342`) ou off-topic de trivia devem ser interceptadas no Tier 0 (Go local) com regex e whitelists sem invocar LLMs, economizando 100% dos tokens de terceiros. Além disso, compatibilidade de payload (`prompt`/`text` e `reply`/`message`) entre Mobile e Backend assegura robustez contra disparidades de cliente.

---

## 7. Technical Debts & Known Blockers
- Nenhum bloqueio ativo no scaffold inicial.

---

> ⚠️ **ISOLAMENTO DE MEMÓRIA:** Este arquivo pertence **exclusivamente** ao projeto `vito`.
> Não misture com a memória do XP Multi-Agent Kit (`~/.gemini/config/`) ou de outros projetos.
> Cada projeto tem seu próprio `.agents/memory/PROJECT_MEMORY.md` independente.
