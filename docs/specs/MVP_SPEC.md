# 📘 Especificação Arquitetural e Plano do MVP — Vito

> **Projeto:** Vito (Secretário Executivo com IA Pessoal & Familiar)  
> **Status:** Ativo / Em Evolução Contínua  
> **Versão:** v0.5.0-beta  
> **Data:** 2026-10-01  

---

## 1. Visão Geral e Proposta de Valor
O **Vito** é um secretário executivo pessoal e familiar inteligente inspirado nos principais recursos do **Toki** (`toki.com/pt`), desenhado para rodar em infraestrutura própria (**Raspberry Pi 4 - 8GB**) com total privacidade, custo operacional zero em IA e suporte a contas isoladas para a família.

### Diferenciais-Chave:
* **Entrada Multimodal Ultra-Rápida:** Áudio nativo (Groq Whisper v3), texto natural e fotos/prints/recibos (Gemini 2.5 Flash).
* **Interface Material Design 3 (M3):** Paleta tonal M3, Navigation Bar com pílula ativa e Action Cards interativos.
* **Orquestração de IA com Custo Zero:** Uso de Free Tiers oficiais com failover automático:
  1. Google AI Studio (Gemini 2.5 Flash / 2.0 Flash) — multimodal nativo e structured outputs.
  2. Groq Cloud (Llama 3.3 70B & Whisper Large v3) — velocidade instantânea e transcrição.
  3. OpenRouter (`:free` models) — fallback de contingência.
* **WhatsApp Self-Hosted (Evolution API):** Container local no Raspberry Pi 4 para envio prioritário de lembretes, substituição de ligações e coordenação de convites com custo zero.
* **RAG Pessoal & Isolamento Total:** Contas 100% segregadas por `user_id` no SQLite e `sqlite-vec`. Convites compartilhados via tokens e arquivos iCal (`.ics`).
* **Infraestrutura Minimalista:** Backend em **Go**, banco **SQLite + sqlite-vec** embutido, Docker multi-arch (`linux/arm64`, `linux/amd64`).
* **Conectividade Segura:** Acesso remoto sem abertura de portas via **Cloudflare Tunnels** (domínio customizado seguro).

---

## 2. Topologia do Sistema

```
                      ┌──────────────────────────────────────────────┐
                      │                 Mobile App                   │
                      │    (React Native + Expo + TypeScript)        │
                      │   - Expo Go (Testes Wi-Fi sem cabo)          │
                      │   - Gravação de áudio nativa (.m4a)          │
                      │   - Upload de fotos / OCR de convites        │
                      │   - Cache local offline (SQLite/AsyncStorage)│
                      └──────────────────────┬───────────────────────┘
                                             │
                                   HTTPS / WSS (JWT Auth)
                                             │
                                             ▼
                      ┌──────────────────────────────────────────────┐
                      │              Cloudflare Tunnel               │
                      │           (cloudflare-tunnel.dominio)        │
                      └──────────────────────┬───────────────────────┘
                                             │
                       Rede Local / Container Docker (Porta 8080)
                                             │
                                             ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        Raspberry Pi 4 (8GB RAM / linux/arm64)                          │
│                                                                                        │
│   ┌────────────────────────────────────────────────────────────────────────────────┐   │
│   │                         Backend Go (Container Único)                           │   │
│   │  - Framework HTTP: Go Fiber ou Chi (Consumo ~20MB RAM)                         │   │
│   │  - Auth: JWT + Bcrypt (Isolamento por user_id)                                 │   │
│   │  - Scheduler: Background Goroutines (Sincronização & Triggers)                 │   │
│   │  - AI Gateway: Provider com failover (Google AI Studio -> OpenRouter -> Groq)  │   │
│   │                                                                                │   │
│   │  ┌──────────────────────────────────────────────────────────────────────────┐  │   │
│   │  │                     SQLite 3 com WAL Mode + sqlite-vec                   │  │   │
│   │  │   - users (id, name, email, password_hash)                               │  │   │
│   │  │   - calendars (id, user_id, name, color, is_default)                     │  │   │
│   │  │   - events (id, user_id, calendar_id, title, start_at, end_at, rrule)   │  │   │
│   │  │   - todos (id, user_id, title, due_date, status, priority)              │  │   │
│   │  │   - memories_vec (id, user_id, content, embedding [768d], created_at)   │  │   │
│   │  └──────────────────────────────────────────────────────────────────────────┘  │   │
│   └────────────────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Matriz de Recursos (Vito vs Toki)

| Recurso Toki | No Vito? | Como Funciona no Vito |
| :--- | :---: | :--- |
| **Agendamento com IA** | 🎯 **Sim (P1)** | Usuário fala/digita ou envia foto/recibo -> IA (Gemini/Groq) extrai entidades -> Action Card M3 de confirmação. |
| **Resolução de Conflitos** | 🎯 **Sim (P1)** | Ao agendar, a IA detecta sobreposições na agenda e sugere horário alternativo livre. |
| **Pendências (To-dos)** | 🎯 **Sim (P1)** | Tarefas com priorização tonal M3, tags e associação a compromissos. |
| **RAG Pessoal & Memória** | 🎯 **Sim (P1)** | Busca vetorial semântica no `sqlite-vec` com isolamento estrito por `user_id`. |
| **WhatsApp & Coordenação** | 🎯 **Sim (P1)** | Evolution API self-hosted no Pi 4 para envio prioritário de lembretes e recebimento de mensagens. |
| **Convites & RSVP** | 🎯 **Sim (P1)** | Disparo de convites via WhatsApp com botões "1/2", link web leve e download de arquivo iCal (`.ics`). |
| **Substituto do "Ligue-me"** | 🎯 **Sim (P1)** | Mensagens de WhatsApp de alta prioridade com áudio sintetizado + Alarme Push agressivo. |
| **Sincronização Google Calendar**| 🚀 **Fase 2** | Integração OAuth2 bidirecional com Google Calendar. |
| **Disparadores (Triggers)** | ⏳ **Fase 3** | Automações de rotina ("Resumo matinal às 08h"). |

---

## 4. Histórico de Fases & Status de Execução

### ✅ Fase 1: Scaffold & Fundação do Monorepo (Concluída)
- [x] Estrutura monorepo criada: `/backend` (Go Clean Arch) e `/mobile` (Expo TS).
- [x] Configuração de `go.mod` com suíte de testes unitários.
- [x] Configuração do `Dockerfile` multi-arch (`linux/amd64`, `linux/arm64`) e `docker-compose.yml`.

### ✅ Fase 2: Backend Core & Banco SQLite (Concluída)
- [x] Migrations SQLite (WAL mode): `users`, `calendars`, `events`, `todos`.
- [x] Autenticação JWT, hash de senhas e middleware de isolamento por `user_id`.
- [x] CRUD completo de eventos e to-dos com verificação de conflitos de horário.

### ✅ Fase 3: AI Gateway & Parsing Multimodal Inicial (Concluída)
- [x] Integração com Google AI Studio (Gemini 2.5 Flash), Groq Cloud e OpenRouter.
- [x] Endpoint de parsing e chat desbloqueado com structured actions em JSON.
- [x] Suporte a embeddings vetoriais com `sqlite-vec` para RAG pessoal.

### ✅ Fase 4: Mobile App Foundation (Concluída)
- [x] Tela de Login/Cadastro conectada ao JWT.
- [x] Chat como tela principal do assistente com histórico e botões de ação inline.
- [x] Calendário modular (`CalendarTopBar`, `CalendarGrid`, `EventCard`) desacoplado da tela principal.
- [x] Gravação de voz no chat com tratamento de teclado no Android.

### ✅ Fase 5: Deploy Raspberry Pi 4 & Conectividade (Concluída)
- [x] Build multi-arch ARM64 validado.
- [x] Docker Compose operacional no Raspberry Pi 4.
- [x] Túnel seguro ativo via Cloudflare Tunnels (domínio seguro configurado via .env).

### 🚀 Próximas Fases em Desenvolvimento (Roadmap Ativo)
As fases em andamento estão detalhadas no plano mestre em [planning/06_ROADMAP_AND_SPRINTS.md](file:///home/andrevmp/Downloads/vito/planning/06_ROADMAP_AND_SPRINTS.md):
- **Sprint 1:** Transição da UI para **Material Design 3 (M3 / Material You)**.
- **Sprint 2:** Refino do **Gateway de IA Canônico** com Groq Whisper v3 e Visão Gemini.
- **Sprint 3:** **Segurança Zero-Trust** & `expo-secure-store`.
- **Sprint 4 & 5:** **WhatsApp Self-Hosted (Evolution API)** e Alarme/Lembrete Prioritário.
- **Sprint 6:** **Módulo de Convites para Eventos & RSVP** (WhatsApp + Link web + `.ics`).

---

## 5. Governança e Disciplina do Código
* **TDD Estrito:** Todo endpoint do backend Go e hooks do React Native possuem testes prévios (RED -> GREEN).
* **Arquitetura Modular:** Limite estrito de 200 a 300 linhas por arquivo (< 500 linhas máximo absoluto).
* **Zero Workarounds:** Sem `any`, sem casts forçados e sem sleeps artificiais.
* **Segurança:** Chaves de API 100% isoladas no Raspberry Pi 4, autenticação JWT em hardware seguro e dados locais criptografados.
