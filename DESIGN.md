# DESIGN.md · vito-mobile (Vito Design System)

> Se este documento e o código divergirem, **o protótipo canônico [`Vito-telas-atualizadas.html`](file:///home/andrevmp/Downloads/vito/Vito-telas-atualizadas.html) e o projeto Penpot `vito-mobile` definem o Vito Design System**, enquanto divergências pendentes no app React Native são registradas em **Open questions** até a execução do `craft-sync`.
> **Idioma Canônico:** Português do Brasil (`pt-BR`).

---

## 1. Product (Produto)

**O que é:** **Vito** é um assistente executivo pessoal com Inteligência Artificial, **100% self-hosted** (rodando em Raspberry Pi 4 ARM64 com SQLite WAL e Cloudflare Tunnels a custo recorrente zero), projetado para **Android Nativo (React Native + Expo SDK 57 + Kotlin Native Modules)** com paridade web/desktop.
**Quem usa:** Profissionais, executivos e criadores brasileiros que exigem soberania total de dados, velocidade instantânea (< 350ms TTFT no chat, < 800ms voz full-duplex) e automação proativa integrada ao WhatsApp, Gmail, Google Calendar e Open Finance (Pluggy BYOK).
**Onde (Dispositivos):** Smartphone Android primário (viewport base **390 × 844 px**, responsivo de 360px a 430px), **Overlay Nativo Fora do App** (`VitoOverlayActivity` sobre qualquer app Android) e **Despertador Crítico em Tela Cheia** (`VitoAlarmActivity`).
**Trabalho principal da tela mais usada:** No **Chat Executivo (`#s-chat`)** e no **Modo Conversa por Voz (`#s-voice`)**, capturar uma intenção em linguagem natural ou voz e transformá-la em ação confirmada (evento, tarefa, mensagem WhatsApp, análise financeira ou bot) em **menos de 5 segundos**.

---

## 2. Audience and voice (Público e Voz)

- **Perfil do Usuário:** Adulto brasileiro produtivo; valoriza clareza direta, zero burocracia e privacidade bancária/pessoal.
- **Tom de Voz ("Como escrevemos"):**
  - **Calmo, executivo, humano e direto.** Sem jargões técnicos expostos (`401 Unauthorized` vira *"Sua sessão expirou. Toque para reconectar"*). Rótulos de seção (`.lbl`, `.eyebrow`, `.dayh`) usam `text-transform: none` e peso `500` em vez de caixa alta agressiva.
  - **Proibido clichês servis de chatbot:** Nunca usar *"Estou à disposição! 🫡"*, *"Como um modelo de IA..."* ou despejar listas não solicitadas.
  - **Estados vazios e silêncio honestos (`craft-states`):** Usar microcopy natural (*"Dia livre."*, *"Ficou em silêncio: nada novo"*, *"Nenhuma tarefa aqui."*). Em falhas de sincronização, nomear o problema com clareza (*"Não foi possível sincronizar o Nubank"*) + ação objetiva (*"Reconectar"*).
- **Formatos Locais (`pt-BR`):**
  - Datas: `sexta-feira, 23 de outubro` ou `23/10/2026`.
  - Horários: `08:30` ou `12:00–13:00` (24h).
  - Moeda: `R$ 3.420,00` com `font-variant-numeric: tabular-nums` (`fontVariant: ['tabular-nums']`) obrigatório em saldos, faturas, contadores e células de calendário.

---

## 3. Mood (Atmosfera e Direção Estética)

- **Palavras-chave (3):** **Monocromático, Suave, Tátil** (*Soft Monochromatic Minimalism* — **Vito Design System**).
- **Nunca parecer com (Never like):**
  - Dashboards SaaS genéricos cheios de bordas pesadas, gráficos neon ou gradientes artificiais (*AI slop*);
  - Aplicativos bancários poluídos com banners comerciais invasivos ou anúncios de empréstimos;
  - Interfaces escuras com preto chapado sem degraus de superfície (no **Vito Design System**, o fundo externo `--page: #000000` contrasta com `--bg: #0a0a0a`, `--surf: #171717` e `--btn: #262626`, dispensando bordas em cards).

---

## 4. Brand & Design System Foundation (`craft-system`)

- **Fonte Canônica do Vito Design System:** Protótipo [`Vito-telas-atualizadas.html`](file:///home/andrevmp/Downloads/vito/Vito-telas-atualizadas.html) (CSS linhas 1–806) e projeto Penpot **`vito-mobile`** (página `1- Fundação` com Token Sets `Core`, `Light`, `Dark`, Themes `Light`/`Dark`, 54 Library Colors e 13 Library Typographies). Implementação React Native legada em [`mobile/src/theme/tokens.ts`](file:///home/andrevmp/Downloads/vito/mobile/src/theme/tokens.ts) e [`mobile/src/theme/motion.ts`](file:///home/andrevmp/Downloads/vito/mobile/src/theme/motion.ts) (ver divergência em *Open questions*).
- **Ícones:** Conjunto único `X` de SVGs vetoriais de linha (`24×24`, `stroke-width: 2` a `2.6`, `stroke-linecap: round`, `stroke-linejoin: round`) + ícones de navegação `.nav` e logos oficiais `LOGO` (10 apps: Google Agenda, Gmail, WhatsApp, Google Maps, Trello, Telegram, Google Drive, Notion, Slack, Outlook). Proibido misturar famílias de ícones concorrentes.
- **Mascote Oficial Canônico (`#vito` + `mobile/assets/`):**
  - **Símbolo SVG Oficial `#vito`:** Definido em [`Vito-telas-atualizadas.html`](file:///home/andrevmp/Downloads/vito/Vito-telas-atualizadas.html#L809) com `viewBox="0 0 550 580"` e `fill="currentColor"` adaptativo nos temas Light (`#0a0a0a`) e Dark (`#f5f5f5`), além de versão tingida pela cor da categoria `--c` nos avatares de Bots (`.rd-av`).
  - **Assets Nativos (`mobile/assets/`):** [`mascot.png`](file:///home/andrevmp/Downloads/vito/mobile/assets/mascot.png) (`512×512` Light), [`mascot-dark.png`](file:///home/andrevmp/Downloads/vito/mobile/assets/mascot-dark.png) (`512×512` Dark), [`mascot-body.png`](file:///home/andrevmp/Downloads/vito/mobile/assets/mascot-body.png), [`mascot-body-dark.png`](file:///home/andrevmp/Downloads/vito/mobile/assets/mascot-body-dark.png) e [`notification-icon.png`](file:///home/andrevmp/Downloads/vito/mobile/assets/notification-icon.png), consumidos em [`VitoMascot.tsx`](file:///home/andrevmp/Downloads/vito/mobile/src/components/common/VitoMascot.tsx) e [`VitoLoginMark.tsx`](file:///home/andrevmp/Downloads/vito/mobile/src/components/login/VitoLoginMark.tsx).
  - **Anatomia Exata Obrigatória:** Domo da cabeça & pescoço contínuo, 6 tentáculos espiralados simétricos, olhos em pílula vertical (`.eyes` / `.eye` animados com *look* e *blink*), gravata borboleta (`.bow`) e chapéu coco inclinado à direita com fita contrastante. Proibido simplificar com formas geométricas genéricas.

### 4.1 Papéis Semânticos de Cor (Token Roles — Light & Dark)

Nenhum componente pode usar hexadecimais soltos; todo elemento consome os papéis semânticos do **Vito Design System**:

| Papel (`craft-system`) | Token CSS / Penpot (`Light` / `Dark`) | Light Theme | Dark Theme | Uso Canônico |
| :--- | :--- | :---: | :---: | :--- |
| `canvas` / `page` | `--page` (`color.page`) | `#efefef` | `#000000` | Fundo externo atrás da moldura `.phone` |
| `surface` (Base) | `--bg` (`color.bg`) | `#ffffff` | `#0a0a0a` | Fundo principal da tela, sheets (`.sheet2`), drawer e inputs flutuantes |
| `fill-1` (Cards) | `--surf` (`color.surf`) | `#f4f4f4` | `#171717` | Cards sem borda (`.rcard`, `.bcard`, `.card2`, `.fhc`, `.ft`, `.vsug`, `.pf`) |
| `fill-2` (Controles) | `--btn` (`color.btn`) | `#ececec` | `#262626` | Botões secundários (`.bbtn`), chips neutros, trilhos `.seg`, `.mdl`, `.focus` |
| `text` / `primary` | `--ink` (`color.ink`) | `#0a0a0a` | `#f5f5f5` | Texto principal, CTA primário (`.bbtn.p`, `.rb.pri`), tab ativa da `.nav` |
| `text-muted` | `--muted` (`color.muted`) | `#595959` | `#8c8c8c` | Subtítulos (`.sub`), metadados (`.meta`), placeholders, tabs inativas |
| `divider` / `track` | `--line` (`color.line`) | `#e6e6e6` | `#262626` | Trilhas de progresso (`.trk`, `.pg`), switch desligado, handle `.hd` |
| `accent-info` (Agenda/Voz) | `--blue` / `--blue-bg` | `#0a7cff` / `#e6f1ff` | `#3b93ff` / `#0f2540` | Compromissos, foco de teclado (`2px`), selo verificado, voz `listen` |
| `accent-danger` (Erro) | `--red` / `--red-bg` | `#ff2d46` / `#ffe8ec` | `#ff5468` / `#3a1219` | Tarefas atrasadas, ações destrutivas (`.dng`, `.out .x`), encerrar voz |
| `accent-tasks` (Estudo/Tarefas) | `--purple` / `--purple-bg` | `#ff2fa0` / `#ffe6f4` | `#ff55b0` / `#3a1229` | Progresso de subtarefas (`.prog`), checks concluídos (`.chk`), categoria Estudo |
| `accent-success` | `--acc` / `--green-bg` | `#0aa55c` / `#e3f6ec` | `#2dd17f` / `#0f2f22` | Status conectado (`.pillst`), entradas, consenso (`.cons`), ação de Toast, voz `speak` |
| `accent-warn` (Atenção) | `--orange` / `--orange-bg` | `#f08300` / `#fff0d9` | `#ffa733` / `#35230f` | Aprovação pendente (`.rd-pend`), alertas de vencimento, badge `Feriado`, voz `think` |
| `accent-teal` | `--teal` / `--teal-bg` | `#0aa5b5` / `#dff4f6` | `#3cc4d0` / `#10343a` | Integrações de projetos (Trello) e fluxos auxiliares |
| `accent-finance` (Âmbar) | `--fin` / `--fin-bg` | `#d98a00` / `#fff2d6` | `#ffb938` / `#3a2b0b` | Open Finance, orçamentos (`.fc`, `.pg`), insights financeiros (`.ins`) |
| `surface-glass` | `.nav` (`backdrop-filter`) | `rgba(255,255,255,0.80)` | `rgba(10,10,10,0.80)` | Dock flutuante translúcida com `saturate(1.6) blur(20px)` e `--shadow` |

- **Brands (`Brands / Bancos & Sites`):** Nubank (`#8a05be`), Itaú Brand (`#ec7000`), Itaú Conta (`#0a3d91`), Inter (`#ff7a00`), Banco do Brasil (`#f9dd16`), Bradesco (`#cc092f`), Santander (`#ec0000`), C6 Bank (`#242424`), Caixa (`#005ca9`), Pluggy Dashboard (`#3b5bdb`), Meu Pluggy (`#0e8f9b`), Pluggy Connect (`#7a4fe0`).

### 4.2 Escala Tipográfica (`Geist` + `Geist Mono`)

| Papel Tipográfico | Fonte & Peso | Tamanho / Line-Height | Letter Spacing | Onde é Usado |
| :--- | :--- | :---: | :---: | :--- |
| `Display Hero 40` | `Geist 500` | `40px` / `1.0` | `-0.03em` | `.fhero .big` (*Safe-to-Spend*), métricas hero (`tabular-nums`) |
| `Display Balance 34` | `Geist 500` | `34px` / `1.0` | `-0.03em` | `.big`, `.sal` (saldo consolidado), métricas de Resumos (`tabular-nums`) |
| `Title H1 30` | `Geist 500` | `30px` / `1.1` | `-0.035em` | `h1` principal das telas (`Agenda`, `Tarefas`, `Finanças`, `Bots`, `Booking`, `Perfil`) |
| `SubScreen H1 26` | `Geist 500` | `26px` / `1.15` | `-0.03em` | `.sbar h1` (sub-telas `#s-sum`, `#s-fs`, `#s-int`, `#s-bkd`) |
| `Drawer H2 24` | `Geist 500` | `24px` / `1.2` | `-0.02em` | `.drawer h2`, `.vsum h2`, `.bkh b` |
| `Sheet H2 22` | `Geist 500` | `22px` / `1.25` | `-0.02em` | `.sheet2 h2` (títulos de Bottom Sheets) |
| `Section H2 17` | `Geist 500` | `17px` / `1.3` | `-0.02em` | `.sec h2`, `.mh b`, `.f3 b`, `.inf-mt` |
| `Body Strong 15.5` | `Geist 500` (`600` ênfase) | `15.5px`–`16px` / `1.35` | `-0.005em` | `.task b`, `.rtop b`, `.evc b`, `.itg b` |
| `Body 15` | `Geist 400` | `15px` / `1.45` | `-0.005em` | `.cv`, `.cu`, `.field`, inputs de busca, descrições |
| `Sub 14` | `Geist 400` (`500` botões) | `14px` / `1.45` | `0` | `.sub`, `.vsug p`, `.bbtn`, `.opts button` |
| `Caption 13` | `Geist 500` | `13px` / `1.35` | `0` | `.lbl`, `.dayh`, `.pillst`, `.chips button`, `.toast` |
| `Meta 12` | `Geist 500` | `12px` / `1.35` | `0` | `.meta`, `.cnt`, `.rd-ap`, `.ver` |
| `Mono Key 12.5` | `Geist Mono 400` / `500` | `12.5px` / `1.4` | `0` | `.kr input` (chaves UUID Pluggy), `.wkv code`, nomes de tokens |

### 4.3 Espaçamento, Grid, Raios e Elevação

- **Grid e Larguras Mobile:** Viewport canônica **390 × 844 px** (`padding: 10px 20px 140px` nas telas padrão; `padding: 10px 16px 128px` no Chat). Espaço inferior reservado para a dock flutuante: `dockClearance: 140px`.
- **Escala de Espaçamento (Base 4px):** `2` (`2xs`), `4` (`xs`), `8` (`sm`), `12` (`md`), `16` (`lg`), `20` (`screen`), `24` (`xl`), `32` (`xxl`).
- **Dimensões Core:** `.rb` / `.bbtn` altura `42px`, `.nav button` `44×48px` (ativo `56×48px`).
- **Raios de Borda (`borderRadius`):** `4px` (`xs` trilhas `.trk`/`.pg`), `10px` (`sm` chips internos), `14px` (`md` `.toast`, `.mdl`, `.rd-pend`), `20px` (`evc` cards de evento `.evc`, `.ft`, `.rx .dg`), `22px` (`card` cards padrão sem borda `.rcard`, `.bcard`, `.card2`, `.fhc`, `.ins`, `.lst`), `28px` (`sheet` `.sheet2`, composer `.cmp`, `.inf-insp`, `.zc`), `32px` (`phone` moldura `.phone`), `40px` (`dock` `.nav`), `999px` (`pill` todos os botões `.bbtn`, `.rb`, chips, badges `.pill`, `.pillst`, `.cnt`, `.rx-hol`).
- **Cards com Hairline & Sombras (`--shadow`, apenas em flutuantes):**
  - **Cards inline v5:** `border-radius: 22px`, `background: var(--surf)`, *hairline border* (`1px solid color-mix(in srgb, var(--ink) 6.5%, transparent)` Light / `rgba(255,255,255,0.07)` + highlight superior `inset 0 1px 0 rgba(255,255,255,0.045)` Dark).
  - **Dock Glassmorphism (`.nav` e `.sbar`):** `backdrop-filter: blur(22px) saturate(180%)` (`16px` no `.sbar`), `background: color-mix(in srgb, var(--surf) 80%, transparent)` Light / `rgba(24,24,26,0.78)` Dark.
  - **Flutuantes Light (`--shadow`):** `0 4px 24px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.035)` — exclusivo para `.nav`, `.cmp`, `.ask`, `.rb`/`.rbs`, `.vpill`, `.toki-track`, `.toki-fab` e inputs de busca.
  - **Flutuantes Dark (`--shadow`):** `0 4px 24px rgba(0,0,0,0.70), 0 0 0 1px rgba(255,255,255,0.06)`.

### 4.4 Física de Movimento, Camada `vito-motion` e Micro-Interações v5

- **Curvas & Molas:** `--ease-std: cubic-bezier(.2,.8,.2,1)` (`150/220/300/400ms`), `--ease-q: cubic-bezier(.22,1,.36,1)` (snappy quintic ease-out), compressão tátil `:active` (`scale(0.965)` em `130ms`).
- **Transições de Tela (`.leaving`):** saída simultânea à entrada (`tr-tab`/`lv-tab`, `tr-push`/`lv-push`, `tr-pop`/`lv-pop`) preservando scroll.
- **Camada Global `vito-motion`:** entrada escalonada (`45ms` stagger), *count-up* numérico (`950ms` em `.big`/`.sal`/`.ft .v`), revelação circular de tema (`View Transitions API` `720ms` + fallback `.theme-fade`), salto do ícone ativo na dock de **5 abas com rótulo expansível** (`data-l`), explosão `.vfx` (12 partículas + anel) ao concluir tarefas e gráficos SVG animados (`animFinCharts` + `#s-sum` v5).
- **Respeito a `ReduceMotion`:** `@media (prefers-reduced-motion: reduce)` desativa todas as transições e animações.

---

## 5. References (Referências Competitivas — Take / Avoid)

| Produto Referência | O que absorvemos (Take) | O que evitamos (Avoid) |
| :--- | :--- | :--- |
| **Perplexity Mobile / ChatGPT** | Superfícies monocromáticas suaves sem bordas (`--surf`/`--btn`), pílulas `999px`, tipografia `Geist` limpa e composer flutuante `.cmp`. | Poluição visual ou excesso de controles no topo da tela. |
| **Amie (`amie.so`)** | Tira semanal limpa com dots por categoria, cartões de evento suaves (`.evc` sem borda) e foco em *time-blocking*. | Paleta pastel com baixo contraste sob luz solar (garantimos WCAG AA). |
| **Pierre (CloudWalk)** | Grade Bento 2×3 financeira clara, chips de perguntas rápidas à IA e foco no *Safe-to-Spend* sem ruído. | Cores hardcoded fora do sistema de tokens e ofertas de produtos financeiros. |
| **Toki (`toki.com`)** | Calendário Infinito expansível com `TokiDensitySlider` (modo expandido com pílulas de eventos vs compacto com emojis), `SelectedDayInspector` e despertador crítico. | Chamadas VoIP pagas que falham offline (usamos `AlarmManager` nativo). |
| **Gemini Live / ChatGPT Voice** | Conversação contínua com *barge-in* natural, orbe vivo com halo cônico e respostas curtas sem leitura de markdown/tabelas. | Paredões de texto na tela de voz (limitamos a legenda palavra por palavra + 1 card visual). |

---

## 6. Constraints (Restrições Técnicas e de Produto)

1. **Plataforma & Viewport:** Android-first (`390 × 844 px` no Penpot), alvos de toque mínimos de `42×42px` (`.rb`/`.bbtn`) a `48×48px`, contraste mínimo **WCAG AA (4.5:1)**.
2. **Temas Obrigatórios & Prototipação Lado a Lado:** Paridade 100% entre **Light Theme** e **Dark Theme**. No Penpot, o projeto **`vito-mobile`** possui **2 páginas**:
   - **`1- Fundação`**: 7 boards (`00.0` a `00.6`), Token Sets (`Core`, `Light`, `Dark`), Themes (`Light`, `Dark`), 54 Library Colors e 13 Library Typographies.
   - **`2- Telas e fluxos`**: 9 fluxos (`01` a `09`), **50 estados em pares Light + Dark = 100 artboards** + 9 Row Covers + 9 Prototype Flows.
3. **Visualização de Dados Híbrida Editorial:** Predominância de barras segmentadas, sparklines e anéis SVG limpos nos cards Bento/Resumos, reservando gráficos analíticos detalhados para as sub-telas `#s-fs` (`04.7`–`04.10`) e Raio-X (`02.8`–`02.9`).
4. **Arquitetura de Código:** Limite estrito de **< 500 linhas por arquivo** (*No-God-Files*), zero valores de cor hardcoded e compatibilidade com OTA (`expo-updates`).
5. **Privacidade Executiva:** Modo de ocultação de saldos (`#fin-eye` / `isPrivacyHidden` → `R$ ••••`, estado `04_2_fin_hidden`) e escudo `PrivacyScreenShield` no Android.
6. **Leis Anti-Poluição (`craft-critique`):** Máximo 2–3 ações contextuais no Header (1 primária `.rb.pri`), zero botões repetitivos inline em linhas de lista, máximo 1 CTA primário por Card e colapso padrão em seções secundárias (`Concluídas`, `CONTAS ATIVAS`).

---

## 7. Inventário Completo de Superfícies — Protótipo Final v5

Sincronizado integralmente com [`Vito-telas-atualizadas.html`](file:///home/andrevmp/Downloads/vito/Vito-telas-atualizadas.html) (*Protótipo final v5*) e detalhado no [Plano 08](file:///home/andrevmp/Downloads/vito/planning/01-motor-ia-e-arquitetura/08_PLANO_DESIGN_SYSTEM_E_PROTOTIPACAO_PENPOT_MOBILE.md) e [Plano 09](file:///home/andrevmp/Downloads/vito/planning/01-motor-ia-e-arquitetura/09_PLANO_REDESIGN_V5_UX_ANIMACOES_NOTIFICACOES_LOGIN_ONBOARDING_E_LOJA.md):

1. **`00 · Splash, Onboarding & Login` (`#vsplash`, `#vonb`, `#s-login`):** Splash com rig `gentleman` (`140×140`) + wordmark; Onboarding em 4 slides deslizáveis (`Pular`, dots expansíveis); Login com glow `--lg-c`, roleta `.lg-reel` + 6 cenas ao vivo, Google + WhatsApp + E-mail, links Termos/Privacidade (13+) e sheet pós-login `Permitir acesso?`.
2. **`01 · Chat & Notificações` (`#s-chat`, `#drawer`, `#s-notifs`):** Header com Menu, Sino `#c-notifs` (badge pulsante), `+` e Avatar `AV` (abre Perfil); hero `#chero-rig` interativo, deck `.zc` plano, composer 2 linhas (`+` anexos, `#c-model` / `#c-mic`, `.wv`↔`.send`); Central de Notificações `#s-notifs` (`Agora`/`Hoje`/`Ontem` + ações inline).
3. **`02 · Agenda Infinita & Resumos v5` (`#s-agenda`, `#s-agenda-inf`, `#s-sum`):** Tira semanal/mensal, `#open-book` no header, `#s-agenda-inf` (`TokiDensitySlider` + `SelectedDayInspector`), Resumos v5 (`.rs-hero`, anéis SVG, linha `"Agora"`, Bézier, Raio-X com badge `Feriado`).
4. **`03 · Tarefas` (`#s-tasks`, `#tk-fab`):** Cartão `.tk-sum` com anel SVG, listas coloridas + `+ Lista`, grupos `.grp.col`, subtarefas inline/sheet (`Subtarefas IA`), swipe direita (burst `.vfx`) / esquerda (adiar) e FAB Quick Add com parser NLP `qaParse`.
5. **`04 · Finanças v5 & BYOK` (`#s-fin`, `#s-fs`, `#s-fon`, `#s-br`):** Header 2 botões (`#fin-eye`, `#new-fin`), home em 9 blocos (Saldo `54px`, alerta 1 de N, carrossel `.fx-rail` 8 bancos, card mês, dupla, cartões `fxRing`, metas/orçamentos `CAT_STYLE`, chips, extrato `MBRAND`), animações `animFinCharts`, 8 sub-telas `#s-fs` (incl. Simulador CDB) e BYOK 100% navegador externo.
6. **`05 · Bots & Estúdio` (`#s-radar`, `#s-rdd`, `#s-mascot`):** Dock com 5 abas (`Vito`, `Agenda`, `Tarefas`, `Finanças`, `Bots`); `#s-radar` com 2 abas (`Meus bots · Catálogo`), cards `.bcx` com rig na skin própria + `botAnimState` + logos de apps, detalhe com `details.v-fold` e estúdio `#s-mascot` (10 presets + 6 pickers).
7. **`06 · Booking & Votações` (`#s-book`, `#s-bkd`):** Abas `Links` e `Recebidos`, barras `.vopt` animadas, avatar stack `.vtr-row` (4 + `+N`) e sheet de votantes.
8. **`07 · Perfil, Sub-telas & Loja` (`#s-perfil`, `#s-int`, `#s-ai`, `#s-behavior`, `#s-voice-cfg`, `#s-memory`, `#s-store`):** Card `.pf`, 5 sub-telas dedicadas de configuração + Tema inline (`Claro/Escuro/Sistema`) + módulo `#s-store` (5 telas: `pro`, `priv` LGPD, `notif`, `help`, `about`).
9. **`08 · Modo Voz` (`#s-voice`, `#v-pill`):** 5 estados (`listen`, `think`, `speak`, `mute`, `idle`), rig `500×500`, halo cônico, equalizador 7 barras, legenda `.vcap` e `.vpill` (sem `.vfab`).

---

## 8. Decisions log (Registro de Decisões)

- `2026-11-10` — **Remoção do Banner CDB na Home de Finanças** — Despoluir a home financeira mantendo foco em saldo, contas e categorias (Simulador CDB isolado na sub-tela `#s-fs` `cdb`).
- `2026-11-17` — **Unificação de Radares e Assuntos em "Bots"** — Absorver pendências de WhatsApp/Gmail em Bots (`#s-radar` / `#s-rdd`).
- `2026-11-18` — **Adoção Oficial do Vito Design System (`Geist`, superfícies `22px`, pílulas `999px`)** e reconstrução `vito-mobile` no Penpot.
- `2026-11-21` — **Convergência para o Protótipo Final v5 (`Vito-telas-atualizadas.html`)** — Navbar enxuta de 5 abas com rótulo expansível, camada global `vito-motion`, Splash/Onboarding/Login integrados, Central de Notificações `#s-notifs`, Finanças v5 em 9 blocos + `animFinCharts`, Bots `.bcx` + `#s-mascot`, Perfil com sub-telas dedicadas (`#s-int`, `#s-ai`, `#s-behavior`, `#s-voice-cfg`, `#s-memory`) e módulo Loja/LGPD (`#s-store`), documentados no [Plano 09](file:///home/andrevmp/Downloads/vito/planning/01-motor-ia-e-arquitetura/09_PLANO_REDESIGN_V5_UX_ANIMACOES_NOTIFICACOES_LOGIN_ONBOARDING_E_LOJA.md).

---

## 9. Open questions (Questões em Aberto)

- **Divergência temporária com [`mobile/src/theme/tokens.ts`](file:///home/andrevmp/Downloads/vito/mobile/src/theme/tokens.ts) (`craft-sync` pendente):** O código React Native em `mobile/src/theme/tokens.ts` ainda utiliza o Design System anterior (paleta Sage/Paper `#DDE1DF`/`#D2D7D4` com bordas `1px`, fontes `Montserrat` + `Inter` e raios `MD3Shapes` `8/12/16/20/28`). A convergência para o **Vito Design System** (`Geist` + `Geist Mono`, superfícies `#efefef`/`#ffffff`/`#f4f4f4`/`#ececec` e `#000000`/`#0a0a0a`/`#171717`/`#262626`, cards sem borda `22px` e pílulas `999px`) será aplicada no código mobile na próxima execução de `craft-sync`.
- **Sincronização automatizada pós-Penpot:** Definir se geraremos um manifesto `design-sync.json` no repositório para validar paridade contínua entre os Token Sets do Penpot (`Core`, `Light`, `Dark`) e `mobile/src/theme/tokens.ts`.
