# 📘 Especificação Arquitetural e Plano do MVP — Kito

> **Projeto:** Kito (Secretária Executiva com IA Pessoal & Familiar)  
> **Status:** Aprovado para Implementação (Fase Genesis)  
> **Versão:** v0.1.0-alpha  
> **Data:** 2026-09-26  

---

## 1. Visão Geral e Proposta de Valor
O **Kito** é uma secretária executiva pessoal inteligente inspirada nos principais recursos do **Toki** (`toki.com/pt`), desenhada para rodar em infraestrutura própria (**Raspberry Pi 4 - 8GB**) com total privacidade, custo operacional zero em IA e suporte para poucos usuários (família).

### Diferenciais-Chave:
* **Entrada Multimodal Ultra-Rápida:** Áudio nativo (voz), texto em linguagem natural e fotos/prints de convites ou mensagens.
* **Orquestração de IA com Custo Zero:** Uso de Free Tiers oficiais com failover automático:
  1. Google AI Studio (Gemini 2.5 Flash / 2.0 Flash) — multimodal nativo e structured outputs.
  2. OpenRouter (`:free` models).
  3. Groq Cloud (Llama 3.3 70B & Whisper Large v3).
* **RAG Pessoal Multi-Tenant:** Cada usuário possui seu próprio espaço vetorial e histórico semântico totalmente isolado dentro do banco.
* **Infraestrutura Minimalista:** Backend em **Go**, banco **SQLite + sqlite-vec** embutido, empacotado em Docker multi-arquitetura (`linux/arm64`, `linux/amd64`).
* **Conectividade Segura:** Acesso remoto sem abertura de portas via **Cloudflare Tunnels** (`kito.rasppi.cloud`).

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
                      │           (kito.rasppi.cloud)                │
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

## 3. Matriz de Recursos (Kito MVP vs Toki)

| Recurso Toki | No Kito MVP? | Como Funciona no Kito |
| :--- | :---: | :--- |
| **Agendamento com IA** | 🎯 **Sim (P1)** | Usuário fala/digita ou envia print -> IA extrai entidades (`title`, `datetime`, `location`) -> salva evento. |
| **Resolução de Conflitos** | 🎯 **Sim (P1)** | Ao agendar, a IA verifica overlaps na agenda do usuário e sinaliza: *"Você já tem X às 14h. Quer agendar às 15h?"*. |
| **Pendências (To-dos)** | 🎯 **Sim (P1)** | Lista de afazeres com prioridades e vinculação de time-blocking na agenda. |
| **RAG Pessoal & Memória** | 🎯 **Sim (P1)** | Busca semântica e histórico isolado por usuário no `sqlite-vec`. |
| **Sincronização Calendários** | 🚀 **Fase 2** | Calendário nativo SQLite no MVP; Sync bidirecional com Google Calendar API na sequência. |
| **Agendamentos (Booking)** | 🚀 **Fase 2** | Página web pública leve estilo Calendly servida pelo backend Go. |
| **Disparadores (Triggers)** | ⏳ **Fase 3** | Notificações de rotina ("Resumo matinal às 08h"). |
| **Ligue-me / Voz Bidirecional** | ⏳ **Fase 3** | Resposta falada via Text-to-Speech nativo do celular. |

---

## 4. Plano de Implementação em Fases (TDD & Atomic Steps)

### 📍 Fase 1: Scaffold & Fundação do Monorepo
- [ ] Inicializar estrutura de pastas: `/backend`, `/mobile`, `/scripts`, `/docker`.
- [ ] Configurar `go.mod` no backend (Go 1.23+) com testes unitários em RED.
- [ ] Configurar projeto Expo com TypeScript e NativeWind (Tailwind CSS) em `/mobile`.
- [ ] Configurar `Dockerfile` multi-arch (`linux/amd64`, `linux/arm64`) e `docker-compose.yml`.

### 📍 Fase 2: Backend Core (Auth, Banco SQLite & Models)
- [ ] Modelagem de migrations SQLite (WAL mode): `users`, `calendars`, `events`, `todos`, `memories_vec`.
- [ ] TDD: Testes de autenticação JWT, hash de senha e middleware de isolamento por `user_id`.
- [ ] TDD: CRUD completo de eventos e to-dos com verificação estrita de sobreposição de horários (conflitos).

### 📍 Fase 3: AI Gateway & Parsing Multimodal
- [ ] Módulo em Go para integração com Google AI Studio (Gemini 2.5 Flash) com structured output JSON.
- [ ] Adaptador de failover para OpenRouter Free e Groq Cloud.
- [ ] Endpoint `/api/v1/assistant/parse`: recebe texto ou áudio `.m4a` e retorna a ação estruturada (`CREATE_EVENT`, `CREATE_TODO`, `QUERY_SCHEDULE`).
- [ ] Suporte a embeddings vetoriais com `sqlite-vec` para busca semântica do RAG pessoal.

### 📍 Fase 4: Mobile App (Interface Toki-Like)
- [ ] Tela de Login / Cadastro conectado ao JWT do backend.
- [ ] Tela Principal: Visualização de Agenda diária/semanal + To-dos pendentes.
- [ ] Botão Flutuante de Gravação de Voz (pressionar para falar) e input de texto rápido.
- [ ] Modal de Confirmação Inteligente: Exibe o card do evento extraído pela IA para aprovação em 1 toque antes de salvar.
- [ ] Validação no celular Android físico via **Expo Go**.

### 📍 Fase 5: Docker no Raspberry Pi 4 & Cloudflare Tunnel
- [ ] Build multi-arch local e teste de container ARM64.
- [ ] Configuração do serviço no Raspberry Pi via Docker Compose.
- [ ] Conexão e teste com Cloudflare Tunnel (`kito.rasppi.cloud`).

---

## 5. Governança e Disciplina do Código
* **TDD Estrito:** Todo endpoint do backend Go possui teste prévio (RED -> GREEN).
* **No Workarounds:** Zero dependências obscuras ou bypasses em arm64.
* **Segurança:** Chaves de API isoladas no servidor, JWT com expiração e senhas em Bcrypt.
