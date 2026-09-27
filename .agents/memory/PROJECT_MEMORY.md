# 🧠 Project Memory & Context Snapshot

> **Última Atualização:** 2026-09-27 12:10
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
| 2026-09-27 | `UX/UI` | Chat como Tela Principal: O app agora abre diretamente na interface de chat do Vito IA com histórico persistente e acesso ao perfil/configurações, com a guia de Calendário e Tarefas desacoplada na navegação inferior | `mobile/src/screens/HomeScreen.tsx`, `mobile/src/screens/ChatScreen.tsx` | `PASS (npx tsc 0 errors)` |
| 2026-09-27 | `REFINE/AI` | Backend Chat Desbloqueado & Otimizado: Remoção do bloqueio rígido ScopeGuard permitindo conversa fluida, e otimização do system prompt focado em marcar eventos/agenda e gerenciar tarefas com Action GENERAL_CHAT | `backend/internal/ai/prompt.go`, `assistant_service.go`, `assistant_service_test.go` | `PASS (go test ./... 100% PASS)` |
| 2026-09-27 | `REFINE/UI` | Design System & Auth Overhaul: Remoção de modo demo e status de conexão na AuthScreen, botão "Trocar de Conta" no ProfileModal, Color Lock unificado no CalendarView/EventCard/TodoItem e remoção de clichês de IA | `AuthScreen.tsx`, `ProfileModal.tsx`, `CalendarView.tsx`, `EventCard.tsx`, `TodoItem.tsx`, `AssistantResultModal.tsx` | `PASS (npx tsc 0 errors)` |
| 2026-09-27 | `FEAT/UI` | Redesign Mobile Fiel: Chat de IA com persistência contínua (AsyncStorage + feed de mensagens e cards inline), Header limpo sem poluição de conexão e ProfileModal para alternância de servidor e logout | `mobile/src/screens/ChatScreen.tsx`, `ChatMessageBubble.tsx`, `useChat.ts`, `ProfileModal.tsx`, `Header.tsx`, `HomeScreen.tsx` | `PASS (npx tsc 0 errors)` |
| 2026-09-27 | `REFACTOR/FIX` | Modo Cirúrgico Atômico: Desacoplamento do HomeScreen (<250 linhas) com extração do custom hook useHomeData, eliminação de workarounds (@ts-ignore, as any) e alinhamento de contrato de tipos do ConflictInfo entre mobile e Go | `mobile/src/hooks/useHomeData.ts`, `HomeScreen.tsx`, `api.ts`, `types/index.ts` | `PASS (npx tsc 0 errors + go test targeted 100% PASS)` |

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
