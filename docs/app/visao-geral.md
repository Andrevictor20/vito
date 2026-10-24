# Vito — Guia do App (fonte da verdade para a IA)

O Vito é o secretário executivo pessoal no bolso: agenda, tarefas, pendências, vigílias (radares), links de agendamento (Booking), perfil, WhatsApp e Gmail, operando sob uma arquitetura 100% conversacional e zero-modais.

## Paradigma Zero-Modais e IA Proativa (Botão Spark & Slot-Filling)

- **Sem Modais de Formulário:** No Vito não existem telas de formulário, modais pop-up ou caixas de diálogo manuais para criar ou editar eventos, tarefas, radares ou bookings.
- **Iniciativa Proativa da IA (Botão Spark):** No cabeçalho de cada tela (Agenda, Tarefas, Radares, Booking), o botão primário de ação exibe o ícone Spark. Ao tocar nele, o app navega instantaneamente para a aba Chat e o próprio Vito toma a iniciativa, fazendo uma pergunta contextual sobre o que você deseja planejar ou criar, com foco imediato no teclado.
- **Ações Contextuais nos Itens:** Tocar em qualquer compromisso, tarefa, vigília ou link abre opções contextuais onde o Vito pergunta diretamente detalhes como novo horário, prazo ou confirmação de ajuste.
- **Slot-Filling Humanizado e Respostas Curtas:** O usuário pode responder com total liberdade ou de forma telegráfica (ex.: "Dentista", "Almoço sexta 13h"). O Vito retém o contexto e solicita apenas o dado ausente (1 pergunta por turno), aplicando defaults inteligentes sem questionários mecânicos.
- **Cards Interativos no Chat:** O Vito responde sempre com um card estruturado elegante contendo botões de ação: "Desfazer", "Confirmar / Ajustar" e botão direto de retorno ("Ver na agenda", "Ver tarefas", "Ver Booking").

## As 6 abas (na barra de navegação inferior / rodapé)

1. **Chat** (ícone de balão de conversa) — Centro executivo do Vito. Conversa por texto, áudio e fotos (convites, recibos, boletos). O topo tem ☰ (gaveta de histórico) e + (novo chat).
2. **Agenda** (ícone de calendário) — Compromissos e eventos com dia e hora. Botão Spark no topo ("Marca dentista terça às 15h"). Toque no evento para remarcar ou cancelar pelo chat. Sincronização nos dois sentidos com o Google Calendar.
3. **Tarefas e Pendências** (ícone de checklist) — Lista mista por urgência (atrasadas, hoje, próximas, sem data). Botão Spark no topo ("Lembra de pagar o condomínio dia 5, prioridade alta"). Toque na tarefa para mover para amanhã, concluir ou excluir pelo chat.
4. **Radares** (ícone de alvo/radar) — Vigílias e monitoramentos inteligentes em tempo real (concursos, ações, voos, notícias, preços). Botão Spark no topo ("Me avisa quando sair edital de concurso na minha área"). Toque no radar para pausar, retomar, mudar horário da checagem ou excluir.
5. **Booking** (ícone de elo/link) — Links de agendamento público 1-on-1 e reuniões em grupo com consenso. Botão Spark no topo com escolha rápida ("1-on-1" ou "Grupo"). Menu dos cards para mudar duração, duplicar ou excluir link pelo chat.
6. **Perfil** (ícone de pessoa/silhueta, no rodapé) — Conta e governança: tema (Claro / Escuro / Sistema), nível de autonomia da IA (Nível 1, 2 ou 3), telefone, WhatsApp, Gmail, sincronização do Google Calendar e versão do app.

## Topologia e Regras Críticas de Interface

- **Barra de Navegação Inferior (Rodapé):** Contém os 6 ícones de acesso às abas principais. O Perfil é a 6ª aba (último ícone à direita no rodapé).
- **Header (Topo):** Mostra apenas o título da tela e ações contextuais específicas (lupa de busca, botão Spark e ações complementares).
- **PROIBIÇÃO DE ALUCINAÇÃO:** NUNCA existe menu de perfil, foto de avatar, engrenagem ou botão de configurações no canto superior direito.
- **Como Mudar o Tema do App:** Toque na 6ª aba (**Perfil**, ícone de pessoa na barra inferior) e, no card **Tema**, escolha diretamente entre Claro, Escuro ou Sistema.

## Regras de resposta sobre o app

- Nível 1 (pergunta genérica): resposta direta e concisa + oferecer detalhamento.
- Nível 2 ("como faço X?"): passo a passo com caminho exato na tela + comando conversacional do chat.
- Nível 3 ("explica tudo/detalhe"): tutorial completo com exemplos práticos.
- NUNCA usar emojis. Listas com travessão (—) ou numeração, nunca asteriscos ou cabeçalhos markdown crus.
- NUNCA inventar caminhos inexistentes: cite estritamente o que está nestes documentos.
