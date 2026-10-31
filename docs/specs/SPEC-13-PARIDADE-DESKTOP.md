# 📋 SPEC-13 — Paridade de Arquitetura e Design Desktop ↔ Mobile (ATDD)

> **Documento:** `docs/specs/SPEC-13-PARIDADE-DESKTOP.md`  
> **Status:** Aprovado para Execução Multi-Agente (Wave 0 Concluída)  
> **Classificação de Risco:** L2 (Feature/API & Architectural Parity)  
> **Origem / Referências:** `planning/13_PARIDADE_DESKTOP_MOBILE_ARQUITETURA_E_DESIGN.md` e protótipo canônico `Vito Desktop.html`  
> **Domínio de Execução:** `/desktop` (React 19 + TypeScript + Vite + Tailwind CSS)  
> **Referência Canônica de Código:** `/mobile` (Expo + React Native)  

---

## 1. Visão Geral e Pirâmide de Especificação

Esta especificação define os contratos verificáveis, critérios de aceite (AC-01 a AC-10), tabelas de Specification by Example (SbE), contratos de componentes primitivos, utilitários puros, clientes de API, hooks de domínio e layouts Master-Detail (Split-Pane) para a versão Desktop do Vito.

O objetivo inegociável é:
1. **Paridade Não-Visual 1:1:** Espelhar toda a inteligência de negócios, validações, cálculos de datas, slots, caches e clientes de rede presentes no mobile.
2. **Ergonomia Widescreen (Split-Pane):** Zero modais intrusivos centrais. Uso sistemático de layout mestre-detalhe (60%/40% ou lista 380px + inspector lateral fixo 380-440px).
3. **Keyboard-First & WCAG AA:** Navegação instantânea por atalhos (`Ctrl K`, `Ctrl B`, `C`, `G+A`, `G+T`, `G+R`, `G+M`, `G+S`, `Esc`).
4. **No-God-Files:** Limite rígido de < 500 linhas por arquivo em todo o diretório `desktop/`.

---

## 2. Critérios de Aceite Globais (AC-01 a AC-10) & Specification by Example (SbE)

### AC-01 — Paridade dos 9 Componentes Primitivos de UI
**Descrição:** O diretório `desktop/src/components/ui/` deve fornecer os 9 blocos primitivos canônicos ancorados aos tokens CSS (`tokens.ts`), com suporte a foco visível WCAG AA e estados interativos.

| ID Exemplo | Componente | Entrada / Propriedades Principais | Comportamento / Renderização Esperada |
|---|---|---|---|
| SbE-01.1 | `Button` | `variant: 'pri'`, `pill: true`, `loading: true` | Renderiza pílula com spinner SVG sem disparar `onClick`. |
| SbE-01.2 | `Card` | `variant: 'interactive'`, hover | Borda `var(--line)`, raio 16px, elevação suave e cursor pointer. |
| SbE-01.3 | `TextInput` | `error: "Campo obrigatório"`, foco | Fundo `var(--surf)`, borda de foco `var(--blue)` 2px offset 2px, mensagem de erro em `var(--red)`. |
| SbE-01.4 | `SelectableChip` | `label: "Hoje"`, `selected: true`, `color: 'blue'` | Fundo `var(--blue-bg)`, texto `var(--blue)`, raio 9999px. |
| SbE-01.5 | `VitoSwitch` | `checked: false` -> clique ou tecla `Space` | Transiciona pino de 3px para 21px, dispara `onChange(true)`, cor `var(--acc)`. |
| SbE-01.6 | `M3Switch` | `checked: true`, `disabled: true` | Renderiza switch bloqueado sem responder a eventos de teclado/mouse. |
| SbE-01.7 | `M3Badge` | `variant: 'acc'`, `dot: true` | Pílula com ponto verde pulsante (`.live`) e tipografia 11px uppercase bold. |
| SbE-01.8 | `M3ProgressRing` | `progress: 62`, `size: 32` | SVG circular com `stroke-dashoffset` proporcional a 62% em `var(--acc)`. |
| SbE-01.9 | `Drawer` | `isOpen: true`, tecla `Escape` | Painel lateral direito de 440px desliza da direita; fecha ao pressionar `Escape`. |

#### Gherkin — AC-01:
```gherkin
Cenário: Uso do Drawer lateral em substituição a modal flutuante
  Dado que o usuário está visualizando a tela de Resumos Executivos
  Quando clica no botão "Abrir Raio-X semanal"
  Então o componente Drawer desliza da margem direita com largura de 440px
  E o conteúdo principal permanece visível à esquerda
  Quando o usuário pressiona a tecla "Escape"
  Então o Drawer fecha suavemente retornando o foco para o botão de origem
```

---

### AC-02 — Paridade dos 24 Utilitários Puros de Negócio
**Descrição:** Todos os 24 módulos utilitários de negócio puro do mobile sem dependências nativas devem estar disponíveis em `desktop/src/utils/` com comportamento idêntico.

| ID Exemplo | Utilitário | Entrada de Teste | Saída Esperada |
|---|---|---|---|
| SbE-02.1 | `agendaFilter` | Lista de 10 eventos, query: "vale" | Retorna apenas os eventos cujo título ou descrição contém "vale". |
| SbE-02.2 | `calendarDateUtils` | `start: "2026-10-27T08:00:00Z"`, `end: "2026-10-27T09:30:00Z"` | `formatEventDuration` retorna `"1h30"`. |
| SbE-02.3 | `taskBuckets` | Tarefas com datas `2026-10-24`, hoje (`2026-10-29`), futuro e sem data | Divide em buckets: `overdue` (1), `today` (0), `thisWeek` (1), `noDate` (2). |
| SbE-02.4 | `meetingPollUtils` | Enquete com votos `[2, 0, 1, 3]`, total de 4 opções | Calcula líder com 3 votos, percentual de cada barra e status de consenso. |
| SbE-02.5 | `phoneFormat` | Entrada `"98981234567"` | Retorna `"+55 98 98123-4567"`. |
| SbE-02.6 | `chatSendGuard` | Mensagem de WhatsApp sem clique explícito | Bloqueia envio prematuro e exige confirmação prévia no card. |

#### Gherkin — AC-02:
```gherkin
Cenário: Categorização de tarefas em buckets temporais
  Dado uma lista de 5 tarefas com prazos passados, presentes e sem prazo
  Quando a função categorizarTaskBuckets é executada no desktop
  Então o resultado é idêntico ao produzido pelo mobile
  E as tarefas atrasadas são marcadas com a tag semântica vermelha
```

---

### AC-03 — Paridade e Desmembramento dos 7 Clientes de API
**Descrição:** A camada de serviços de rede em `desktop/src/services/api/` deve ser desacoplada em clientes dedicados com tipagem estrita TypeScript.

| ID Exemplo | Cliente de API | Método | Contrato de Retorno Esperado |
|---|---|---|---|
| SbE-03.1 | `gmailApi.ts` | `getStatus()` | `{ connected: boolean, email?: string, unread_urgent: number }` |
| SbE-03.2 | `whatsappApi.ts` | `sendMessage(to, text)` | `{ success: boolean, message_id: string, timestamp: string }` |
| SbE-03.3 | `whatsappAuthApi.ts` | `requestQrCode()` | `{ qr_code_base64: string, expires_in_seconds: number }` |
| SbE-03.4 | `whatsappContextApi.ts` | `getContext(jid)` | `{ contact_name: string, recent_exchanges: Array<{role, text}> }` |
| SbE-03.5 | `p2pMeetingsApi.ts` | `votePollSlot(pollId, slotIndex)` | `{ poll_id: string, updated_votes: number[], total_voters: number }` |
| SbE-03.6 | `notificationsApi.ts` | `getUnread()` | `Array<{ id: string, title: string, urgency: 'low'|'high'|'breaking' }>` |
| SbE-03.7 | `fileUtils.ts` | `validateFile(file, maxMb: 10)` | `{ valid: boolean, error?: string, mimeType: string }` |

#### Gherkin — AC-03:
```gherkin
Cenário: Solicitação de pareamento de WhatsApp via QR Code
  Dado que o usuário abre as configurações de integrações
  Quando seleciona a integração do WhatsApp e clica em "Gerar QR Code"
  Então o cliente whatsappAuthApi dispara POST para /api/v1/integrations/whatsapp/qr
  E o QR Code em base64 é renderizado inline na tela sem recarregar a página
```

---

### AC-04 — Isolamento dos 9 Hooks de Domínio (Zero-Direct-Fetch nas Views)
**Descrição:** Nenhuma View ou subcomponente visual pode invocar `fetch` ou `api.*` diretamente. Todo acesso e cache deve ser mediado pelos 9 hooks de domínio em `desktop/src/hooks/`.

| ID Exemplo | Hook de Domínio | Estado Provido | Efeito / Cache |
|---|---|---|---|
| SbE-04.1 | `useChat` | `{ messages, isThinking, sendPrompt, resetChat }` | Mantém histórico em memória e gerencia streaming SSE. |
| SbE-04.2 | `useChatMessages` | `{ cards, appendUserMessage, appendAssistantMessage }` | Parsing e enriquecimento com cards estruturados. |
| SbE-04.3 | `useHomeData` | `{ todayEvents, pendingTasks, unreadUrgent }` | Agregação unificada com stale-while-revalidate de 60s. |
| SbE-04.4 | `useCalendarSync` | `{ events, selectedDay, setDay, reload }` | Sincronização periódica e fallback para cache local. |
| SbE-04.5 | `usePendingItems` | `{ pendingList, resolveItem, dismissItem }` | Lista de ações urgentes com optimistic update. |
| SbE-04.6 | `useTriggers` | `{ radars, activeRadar, checkNow }` | Polling e status de relatórios de preço e notícias. |
| SbE-04.7 | `useNotifications` | `{ notifications, unreadCount, markAsRead }` | SSE/WebSocket para notificações em tempo real. |
| SbE-04.8 | `useChatSessions` | `{ sessions, activeSessionId, switchSession }` | Histórico de sessões conversacionais na barra lateral. |
| SbE-04.9 | `chatMessageEffects` | `playSendSound()`, `playReceiveSound()` | Feedback acústico sutil via Web Audio API. |

#### Gherkin — AC-04:
```gherkin
Cenário: Auditoria de AST contra chamadas diretas de fetch
  Dado o repositório desktop compilado
  Quando o analisador estático inspeciona desktop/src/components/
  Então 0 ocorrências de chamadas diretas a fetch ou axios são encontradas
  E 100% dos dados fluem através dos hooks de desktop/src/hooks/
```

---

### AC-05 — 11 Cartões de Chat no Desktop & Send Guard
**Descrição:** O Desktop deve renderizar todos os 11 cartões interativos de chat com proteção estrita contra disparo acidental de mensagens (`chatSendGuard`).

| ID Exemplo | Cartão de Chat | Propriedades Principais | Ação ao Interagir |
|---|---|---|---|
| SbE-05.1 | `BookingInlineCard` | `title`, `duration`, `bookingUrl`, `status` | Permite copiar link público ou abrir modal de configuração. |
| SbE-05.2 | `ConflictInlineCard` | `eventA`, `eventB`, `suggestedSlot` | Botão "Mover para novo horário" dispara ação sem recarregar chat. |
| SbE-05.3 | `MeetingInlineCard` | `topic`, `slots`, `votes`, `consensus` | Botões de votação de horário com barra de progresso de votos. |
| SbE-05.4 | `PendingInlineCard` | `source: 'email'|'doc'`, `description`, `amount` | Botões "Criar tarefa" e "Marcar como resolvida". |
| SbE-05.5 | `TriggerInlineCard` | `query`, `frequency`, `targetPrice` | Botão "Criar vigília" com status de confirmação `ready` -> `active`. |
| SbE-05.6 | `SmoothCardEntrance` | `children`, `delayMs: 150` | Animação CSS suave de opacidade e translação Y (hardware-accelerated). |
| SbE-05.7 | `chatCardTheme` | `theme: 'light'|'dark'` | Fornece borda lateral de 4px colorida (`var(--blue)`, `var(--red)`, `var(--acc)`). |

#### Gherkin — AC-05:
```gherkin
Cenário: Proteção de envio de WhatsApp em card de chat
  Dado que o Vito sugeriu uma resposta com card WhatsApp estruturado
  Quando o card é exibido com o status "ready"
  Então nenhuma mensagem é disparada no backend Go
  Quando o usuário clica expressamente no botão "Confirmar e Enviar"
  Então o status do card transiciona para "sent"
  E a confirmação visual "Mensagem enviada com sucesso" é renderizada
```

---

### AC-06 — Modo Voz Multimodal Contínuo no Desktop
**Descrição:** O dock de chat e o widget flutuante devem suportar ativação por voz via Web Audio API conectada ao endpoint `/voice/stream` via WebSocket, com equalizador harmônico visual.

| ID Exemplo | Estado de Voz | Entrada do Usuário / Sistema | Feedback Visual e Áudio |
|---|---|---|---|
| SbE-06.1 | Início de Escuta | Clique no microfone ou tecla `Espaço` no chat | Abre Drawer de Voz com equalizador de 7 barras harmônicas oscilando. |
| SbE-06.2 | Transmissão de Áudio | Usuário fala no microfone | Pacotes PCM/WAV transmitidos via WebSocket; RMS atualiza barras. |
| SbE-06.3 | Resposta da IA | Backend finaliza sintetização TTS | Áudio reproduzido via Web Audio Context com transcrição no chat. |
| SbE-06.4 | Encerramento | Tecla `Escape` ou clique em `✕` | Encerra WebSocket, libera trilhas de microfone e fecha Drawer. |

---

### AC-07 — Layouts Master-Detail (Split-Pane) & Bento Grids
**Descrição:** Telas widescreen utilizam divisão mestre-detalhe e bento grids fiéis ao protótipo `Vito Desktop.html`.

| Visão | Coluna Mestre (Esquerda) | Painel Inspector (Direita) | Semântica de Telas |
|---|---|---|---|
| **Tarefas** | Lista dividida em Atrasadas, Hoje, Esta Semana, Sem Data (55% largura). | `TaskSheet.tsx` (45% largura) com subtarefas interativas, notas e card de sugestão da IA. | Split-Pane in-place |
| **Agenda** | `MonthGrid` Toki com slider de densidade visual e filtro de eventos. | `SelectedDayInspector.tsx` (380px) com eventos do dia e formulário inline de criação rápida. | Split-Pane fixo |
| **Reuniões** | Métricas rápidas (Links, Confirmadas, Recebidos) e lista de enquetes (380px). | Painel de detalhes com horários propostos, barras de votos e botão "Copiar link". | Split-Pane flexível |
| **Resumos** | Bento Grid de 3 colunas (Hoje, Semana, Mês) com métricas e barras de progresso. | `Drawer.tsx` (440px) acionado para "Raio-X Semanal" e "Raio-X Mensal". | Bento + Slide-over |
| **Radares** | Lista de radares ativos e Bento de templates de exploração (380px). | Painel com histórico, badges de breaking alert e chips de fontes SearXNG. | Split-Pane com Bento |

---

### AC-08 — Navegação Global por Teclado e Paleta de Comandos
**Descrição:** A aplicação deve ser 100% operável via atalhos globais de teclado sem necessidade de uso do mouse.

| Atalho de Teclado | Ação Disparada | Comportamento Esperado |
|---|---|---|
| `Ctrl + K` / `Cmd + K` | Paleta de Comandos | Abre overlay modal centralizado com busca de páginas e ações da IA. |
| `Ctrl + B` / `Cmd + B` | Alternar Sidebar | Alterna largura da barra lateral entre 248px e 72px (modo colapsado). |
| `G` seguido de `A` | Ir para Agenda | Navega instantaneamente para a visão `calendar`. |
| `G` seguido de `T` | Ir para Tarefas | Navega instantaneamente para a visão `tasks`. |
| `G` seguido de `R` | Ir para Radares | Navega instantaneamente para a visão `triggers`. |
| `G` seguido de `M` | Ir para Reuniões | Navega instantaneamente para a visão `meetings`. |
| `G` seguido de `S` | Ir para Resumos | Navega instantaneamente para a visão `summaries`. |
| `G` seguido de `H` | Ir para Início / Chat | Navega instantaneamente para a visão `chat`. |
| `C` (fora de inputs) | Criar Tarefa | Cria nova tarefa vazia no topo e foca o Inspector de Tarefas. |
| `Escape` | Fechar Painéis | Fecha Paleta `Ctrl K`, fecha Drawer aberto ou desseleciona item ativo. |

---

### AC-09 — Governança No-God-Files (< 500 Linhas) e Tokens Semânticos
**Descrição:** Todo arquivo em `desktop/src/` deve conter estritamente menos de 500 linhas de código e utilizar as variáveis CSS semânticas padronizadas em `tokens.ts`.

| Regra Arquitetural | Limite Máximo | Ação em Caso de Violação |
|---|---|---|
| Linhas por arquivo TypeScript/TSX | < 500 linhas | Reprovação automática no CI; refatoração mandatória pelo `refactor-warden`. |
| Uso de cores arbitrárias (hardcoded hex) | 0 ocorrências | Substituição mandatória por `var(--blue)`, `var(--ink)`, `var(--surf)`, etc. |
| Tipagem com `any` | 0 ocorrências | Declaração de interfaces formais em `types.ts`. |

---

### AC-10 — Compilação de Produção Limpa e Conformance Report
**Descrição:** O projeto deve compilar sem avisos no Vite (`npm run build`), passar em 100% dos testes unitários do Vitest e emitir o Conformance Report atestando todos os ACs como `COMPLIANT`.

---

## 3. Contrato dos 9 Componentes Primitivos (`desktop/src/components/ui/`)

### 3.1. `Button.tsx`
```typescript
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'pri' | 'gh' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  pill?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}
```

### 3.2. `Card.tsx`
```typescript
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'surf' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}
```

### 3.3. `TextInput.tsx`
```typescript
export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  rightElement?: React.ReactNode;
}
```

### 3.4. `SelectableChip.tsx`
```typescript
export interface SelectableChipProps {
  label: string;
  selected: boolean;
  count?: number;
  color?: 'blue' | 'acc' | 'red' | 'purple' | 'orange' | 'teal';
  onToggle: () => void;
}
```

### 3.5. `VitoSwitch.tsx` & `M3Switch.tsx`
```typescript
export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  kbdHint?: string;
}
```

### 3.6. `M3Badge.tsx`
```typescript
export interface M3BadgeProps {
  variant?: 'blue' | 'acc' | 'red' | 'purple' | 'orange' | 'teal' | 'surf';
  size?: 'sm' | 'md';
  dot?: boolean;
  children: React.ReactNode;
}
```

### 3.7. `M3ProgressRing.tsx`
```typescript
export interface M3ProgressRingProps {
  progress: number; // 0 a 100
  size?: number;    // default: 32px
  strokeWidth?: number;
  color?: string;
}
```

### 3.8. `Drawer.tsx` (Slide-over lateral Widescreen de 440px)
```typescript
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  width?: number; // default: 440px
  children: React.ReactNode;
}
```

---

## 4. Lista Nominal dos 24 Utilitários Puros a Portar (`desktop/src/utils/`)

1. `agendaFilter.ts`: Filtros multicritério de eventos de calendário por texto, data e tipo.
2. `bookingActions.ts`: Geradores de links públicos de agendamento e cópia para clipboard.
3. `calendarDateUtils.ts`: Cálculos de duração (`1h30`), formatação de faixas horárias e fusos locais.
4. `chatActions.ts`: Mapeamento de ações rápidas sugeridas pelo Vito no dock.
5. `chatCardAnimation.ts`: Constantes e curvas de interpolação física para entrada suave de cartões.
6. `chatIdeasDeckMotion.ts`: Gestão de transições horizontais de decks de sugestões de IA.
7. `chatPreview.ts`: Geração de prévias compactas de arquivos anexados e imagens.
8. `chatSendGuard.ts`: Trava de segurança que impede disparo inadvertido de mensagens externas.
9. `clipboard.ts`: Cópia resiliente de texto com feedback via toast.
10. `dateTimePicker.ts`: Validador e normalizador de inputs de data e hora em linguagem natural.
11. `meetingPollUtils.ts`: Totalização de votos, cálculo de horários líderes e quórum de reuniões.
12. `notificationPermissionPolicy.ts`: Gestão de permissões de notificações no navegador.
13. `notificationReconcile.ts`: Desduplicação de alertas locais e do servidor.
14. `pagerNavigation.ts`: Controle de estado de paginação e paginação infinita para listas longas.
15. `pendingCache.ts`: Armazenamento volátil e sincronização de itens pendentes do usuário.
16. `phoneFormat.ts`: Formatação internacional E.164 e máscaras de telefones brasileiros.
17. `privacyShield.ts`: Ofuscação de e-mails, telefones e credenciais sensíveis em telas de logs.
18. `reminderInput.ts`: Parser de atalhos temporais (`Hoje 18h`, `Amanhã 09h`).
19. `requestTimeout.ts`: Wrapper resiliente com cancelamento de requests e retries com backoff.
20. `savedContactNames.ts`: Cache local de nomes conhecidos do catálogo telefônico e WhatsApp.
21. `slotAvailability.ts`: Algoritmo de cruzamento de horários livres entre calendários.
22. `summaryCalculators.ts`: Cálculo de porcentagens de foco, equilíbrio de vida e horas livres.
23. `taskBuckets.ts`: Agrupamento de tarefas em Atrasadas, Hoje, Esta Semana e Sem Data.
24. `taskEdit.ts`: Lógica de transição de status, subtarefas e anotações em tarefas.

---

## 5. Os 7 Clientes de API Desmembrados (`desktop/src/services/api/`)

1. `gmailApi.ts`: Endpoints de listagem de e-mails urgentes, criação de rascunhos e disparo aprovado.
2. `whatsappApi.ts`: Envio de mensagens aprovadas e listagem de contatos frequentes sincronizados.
3. `whatsappAuthApi.ts`: Inicialização de sessão Baileys, obtenção de QR Code e pareamento via código OTP.
4. `whatsappContextApi.ts`: Consulta de histórico de conversas recentes com o assistente via WhatsApp.
5. `p2pMeetingsApi.ts`: Gestão de links de booking 1:1 e enquetes com votação de horários múltiplos.
6. `notificationsApi.ts`: Busca de notificações não lidas, confirmação de leitura e preferências de push.
7. `fileUtils.ts`: Validador de tipo MIME, conversão para Base64 e verificação de limites de tamanho.

---

## 6. Os 9 Hooks de Domínio (`desktop/src/hooks/`)

1. `useChat.ts`: Fluxo conversacional completo, streaming SSE de tokens e dispatch de ações.
2. `useChatMessages.ts`: Gerenciamento do array de mensagens com renderização de cartões estruturados.
3. `useChatSessions.ts`: Criação e recuperação de sessões de chat anteriores na barra lateral.
4. `useHomeData.ts`: Agregador central da tela inicial (próximos compromissos, tarefas urgentes e resumos).
5. `useCalendarSync.ts`: Sincronização periódica da grade Toki mensal com a Google Agenda e CalDAV.
6. `usePendingItems.ts`: Gestão reativa de itens pendentes (boletos detectados, e-mails não respondidos).
7. `useTriggers.ts`: Listagem de vigílias ativas, acionamento sob demanda e visualização de variações.
8. `useNotifications.ts`: Notificações em tempo real com indicador visual pulsante no mascote.
9. `chatMessageEffects.ts`: Efeitos acústicos discretos gerados via Web Audio API para envio e recebimento.

---

## 7. Os 7 Cartões Estruturados de Chat (`desktop/src/components/chat/cards/`)

1. `BookingInlineCard.tsx`: Card de agendamento público do Vito Booking com botão "Copiar link público".
2. `ConflictInlineCard.tsx`: Card de sobreposição de eventos com sugestão automática de realocação.
3. `MeetingInlineCard.tsx`: Card com votação de horários de reunião e visualização em tempo real dos votos.
4. `PendingInlineCard.tsx`: Card com pendência crítica detectada pelo Vito (fatura, voo) com ação direta.
5. `TriggerInlineCard.tsx`: Card confirmando a criação de radar com preço-alvo e fontes monitoradas.
6. `SmoothCardEntrance.tsx`: Wrapper com transição física suave de entrada acelerada por GPU.
7. `chatCardTheme.ts`: Definições de cores de destaque semântico por categoria de cartão.

---

## 8. Layouts Master-Detail (Split-Pane) & Bento Grids

### 8.1. Tarefas (`TasksView.tsx`)
- Divisão Widescreen: **Lista à esquerda (55%)** | **TaskSheet Inspector à direita (45%)**.
- Lista: Subdividida pelos buckets `taskBuckets.ts` com contadores visuais.
- Inspector: Título grande, badge de prazo, subtarefas com checkboxes clicáveis e `VitoSuggestionCard.tsx`.

### 8.2. Agenda Toki (`CalendarView.tsx`)
- Divisão: **Grade Toki (Flexível à esquerda)** | **SelectedDayInspector (380px fixo à direita)**.
- Grade: Slider de densidade (`TokiDensitySlider.tsx`), destaques coloridos por categoria e dia atual em vermelho.
- Inspector: Lista cronológica de eventos do dia, botão de exclusão e formulário de novo evento sem modal.

### 8.3. Reuniões & Booking (`MeetingsView.tsx`)
- Divisão: **Lista de links e enquetes (380px)** | **Painel de votação e compartilhamento (Restante)**.
- Exibição de cards de métricas (Confirmadas, Aguardando) e barras de progresso de votação.

### 8.4. Resumos Executivos (`ExecutiveSummariesView.tsx`)
- Layout em Bento Grid de 3 colunas:
  - **Coluna 1 (Hoje):** Total de horas livres, gráfico circular e sugestão de blocos de foco.
  - **Coluna 2 (Semana):** Gráfico de barras verticais e botão para abrir `Drawer` com Raio-X semanal.
  - **Coluna 3 (Mês):** Índice de eficácia percentual e botão para abrir `Drawer` com Raio-X mensal.

---

## 9. Matriz de Rastreabilidade de Conformidade (Traceability Matrix)

| ID do Critério | Requisito / Arquivo Alvo | Teste Automatizado Associado | Status Esperado |
|---|---|---|---|
| AC-01 | `desktop/src/components/ui/*` | `desktop/src/components/ui/__tests__/primitives.test.tsx` | COMPLIANT |
| AC-02 | `desktop/src/utils/*` | `desktop/src/utils/__tests__/*.test.ts` | COMPLIANT |
| AC-03 | `desktop/src/services/api/*` | `desktop/src/services/api/__tests__/apiClients.test.ts` | COMPLIANT |
| AC-04 | `desktop/src/hooks/*` | `desktop/src/hooks/__tests__/hooks.test.ts` | COMPLIANT |
| AC-05 | `desktop/src/components/chat/cards/*` | `desktop/src/components/chat/cards/__tests__/cards.test.tsx` | COMPLIANT |
| AC-06 | `desktop/src/components/chat/ChatVoiceRecorder.tsx` | `desktop/src/components/chat/__tests__/voice.test.tsx` | COMPLIANT |
| AC-07 | `desktop/src/components/{tasks,calendar,meetings}/*` | `desktop/src/__tests__/architectureParity.test.ts` | COMPLIANT |
| AC-08 | `desktop/src/components/layout/Sidebar.tsx` | `desktop/src/__tests__/keyboardNavigation.test.ts` | COMPLIANT |
| AC-09 | Governança No-God-Files (<500L) | Script de validação `wc -l` no Vitest | COMPLIANT |
| AC-10 | Build Vite sem erros | `tsc && vite build` (exit code 0) | COMPLIANT |
