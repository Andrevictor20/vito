# 🧠 Project Memory & Context Snapshot

> **Última Atualização:** 2026-09-30 19:23
> **Status Geral do Projeto:** ACTIVE / ROADMAP DEFINED (6 meses: Out/2026 – Mar/2027)

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
- **Última Execução / Evidência:** 2026-09-27 18:45 — `npx tsc --noEmit` exit 0
- **Ambiente Ativo:** Local / Development (Raspberry Pi 4 target: `linux/arm64`)

---

## 3. Recent Changes & Activity Log (Episodic - Sliding Window: 5 Entregas)

| 2026-10-02 00:15 | `FRONTEND/M3` | Alinhamento Canônico M3, Alternador de Visibilidade de Senha & Fix de Teclado: (1) Adicionado botão interativo de visibilidade de senha (`visibility`/`visibility-off`, touch target 48dp, borda `outlineVariant` com `MD3Shapes.small`) na tela de login M3. (2) Resolução da colisão de layout: `FloatingTabBar` convertido em `NavigationBar` canônica M3 ancorada na base (80dp, superfície `surfaceContainer`, indicador ativo 64x32dp em `primaryContainer`). `ChatInputDock` desacoplado de padding artificial e posicionado naturalmente acima da barra. (3) Corrigido conflito de teclado no Android: `KeyboardAvoidingView` ajustado com `behavior={Platform.OS === 'ios' ? 'padding' : undefined}` para respeitar o `adjustResize` nativo do Android, eliminando 100% da sobreposição do teclado sobre a barra de digitação. Update OTA publicado (`01a0fa9b-bfd9-7d9b-b783-db652fc76833`) e novo APK disparado (`9c8544cf`). | `mobile/src/screens/AuthScreen*`, `mobile/src/components/common/FloatingTabBar.tsx`, `mobile/src/screens/ChatScreen.tsx`, `mobile/src/screens/HomeScreen.tsx` | `PASS (npx tsc 0 errors, EAS OTA published, EAS APK in progress)` |
| 2026-10-01 23:20 | `BUGFIX/AUTH` | Causa Raiz do Login/Cadastro Solucionada: (1) Corrigido bug crítico de React onde `AppRoot` desmontava `AuthScreen` durante requisições porque `isLoading` global era disparado pelo `login`/`register`, reinicializando o estado do componente e apagando erros/campos. Separado `isInitialLoading` (bootstrap) de `isLoading` (autenticação). (2) Normalização de e-mail e remoção de espaços em branco no backend Go e no mobile (evitando que teclados mobile com autocapitalize ou trailing space quebrem o login). (3) Garantido fallback prioritário para Nuvem Cloudflare (`https://vito.rasppi.cloud`), impedindo que URLs locais antigas fiquem presas no `AsyncStorage`. (4) Publicado update OTA (`01a0fa69-8ce3-7aab-9f82-1e681b1303fe`) e disparado novo build de APK (`87fbe2c1`). | `mobile/src/context/AuthContext.tsx`, `mobile/src/AppRoot.tsx`, `mobile/src/screens/AuthScreen*`, `mobile/src/services/api.ts`, `backend/internal/service/auth_service*` | `PASS (Go tests 2/2 OK, tsc 0 errors, EAS OTA OK)` |
| 2026-10-01 22:31 | `FRONTEND/M3` | Remodelação M3 da Tela de Login, Seletor de Servidor & Feedback Visual OTA: (1) `AuthScreen.tsx` e `AuthScreen.styles.ts` remodelados para Material Design 3 (card tonal 28dp, inputs outlined, botões M3, alert box errorContainer). (2) Adicionado seletor e indicador de servidor ativo (`Nuvem` vs `Local`) na tela de login para permitir alternar entre `https://vito.rasppi.cloud` e o Pi local com 1 toque. (3) Criado `UpdateBanner.tsx` integrado no `AppRoot` e botão manual "Buscar update" com indicador de status OTA no rodapé do login. (4) Resiliência de conexão no `api.ts` com fallback prioritário para Cloudflare e timeout de 10s. Deploy OTA publicado com sucesso (Update ID `01a0fa3d-6458-71c0-beed-c4bd704f8cb8`). | `mobile/src/screens/AuthScreen*`, `mobile/src/components/common/UpdateBanner.tsx`, `mobile/src/AppRoot.tsx`, `mobile/src/services/api.ts` | `PASS (npx tsc 0 errors, EAS OTA published)` |
| 2026-10-01 21:14 | `SECURITY/SECRETS` | Migração Segura para EAS Cloud Secrets: Removidos 100% dos IPs locais e domínios do `eas.json` e dos fallbacks de `api.ts`. Registradas variáveis protegidas `EXPO_PUBLIC_API_URL` e `EXPO_PUBLIC_LOCAL_SERVER_URL` diretamente no EAS Cloud via `eas env:create` (visibilidade sensitive). Repositório Git e GitHub livres de credenciais ou dados de rede privada. Novo deploy OTA limpo publicado (Update ID `01a0f9f5-b809-7b9f-9666-56c737db8b11`). | `api.ts`, `eas.json` | `PASS (Zero hardcoded values, git diff clean, EAS OTA 100% OK)` |
| 2026-10-01 20:25 | `MOBILE/BUILD` | Configuração de Build APK & OTA Updates: Instalação do `expo-updates`, configuração do profile `preview` (APK direto) no `eas.json`, definição de `android.package` (`com.andrevmp.vito`) e `runtimeVersion` em `app.json`. Preparado para compilação na nuvem e deploy de atualizações over-the-air. | `mobile/package.json`, `mobile/app.json`, `mobile/eas.json` | `PASS (npx tsc 0 errors, eas-cli valid)` |

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
- **2026-10-01 — Design System Material Design 3 (M3):** Adoção oficial do M3 / Material You com paletas tonais, Navigation Bar e Action Cards no mobile.
- **2026-10-01 — WhatsApp Self-Hosted & Convites:** Evolution API em container Docker no Raspberry Pi 4 para envio prioritário de lembretes, substituição de chamadas e fluxo de RSVP/convites com links iCal (`.ics`).
- **2026-10-01 — 100% Cloud Keys:** O Raspberry Pi 4 não rodará LLMs locais; inferência externa via Gemini Flash, Groq e OpenRouter.

---

## 6. Gotchas, Hurdles & Learned Playbooks (Procedural Memory)
- **[L-001] Git Pre-commit Regex Precision:** Marcadores de conflito de merge devem casar especificamente `^[+](<{7}\s|={7}\s*$|>{7}\s)` para evitar falso positivo em cabeçalhos de comentários `# ======`.
- **[L-002] Modularidade Estrita e Anti-God-Files Mandatórios:** Arquivos limitados a 200-300 linhas (<500 max rígido). Todo backend em Go segue Clean Architecture (`domain`, `database`, `repository`, `service`, `ai`, `handler`) e Mobile segue atomic design (<150 linhas por componente, <250 por tela). TDD/SDD inegociável.
- **[L-003] Zero-Token Local Scope Guard & Interoperabilidade DTO:** Consultas matemáticas (ex: `923/342`) ou off-topic de trivia devem ser interceptadas no Tier 0 (Go local) com regex e whitelists sem invocar LLMs, economizando 100% dos tokens de terceiros. Além disso, compatibilidade de payload (`prompt`/`text` e `reply`/`message`) entre Mobile e Backend assegura robustez contra disparidades de cliente.
- **[L-004] Governança Mandatória por Planejamento & Roadmap:** Proibido propor ou iniciar implementações sem consulta prévia a `planning/`, `docs/specs/MVP_SPEC.md` e `PROJECT_MEMORY.md`. O assistente deve ativamente orientar e lembrar o usuário sobre o que projetar e construir a seguir segundo a sprint ativa do roadmap.

---

## 7. Technical Debts & Known Blockers
- Nenhum bloqueio ativo no scaffold inicial.

---

> ⚠️ **ISOLAMENTO DE MEMÓRIA:** Este arquivo pertence **exclusivamente** ao projeto `vito`.
> Não misture com a memória do XP Multi-Agent Kit (`~/.gemini/config/`) ou de outros projetos.
> Cada projeto tem seu próprio `.agents/memory/PROJECT_MEMORY.md` independente.
