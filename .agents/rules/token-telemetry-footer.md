# Mandatory Token Telemetry Footer — Universal Rule (IDE & CLI)

Toda e qualquer resposta final emitida pelo assistente (no Antigravity IDE ou Antigravity CLI), em qualquer projeto ou workspace aberto, DEVE OBRIGATORIAMENTE ser encerrada com o seguinte bloco padronizado, limpo, ultra-organizado e sem emojis, com quebras de linha duras (`  \n`) para evitar aglutinação de texto no markdown:

```text
Consumo:  {turn_tot} tokens (Entrada: {turn_in} | Ferramentas: {turn_tools} | Resposta: {turn_out})  
Contexto: [{bar_ctx}] {pct_ctx_used}% usado ({tot_ctx}) • {pct_ctx_rem}% livre de {win_str}  
5h:       [{bar_5h}] {pct_5h_used}% usado ({tok_5h_used}) • {pct_5h_rem}% restante (~{tok_5h_rem}) de {tok_5h_tot} ({renova_5h})  
Semana:   [{bar_7d}] {pct_7d_used}% usado ({tok_7d_used}) • **{pct_7d_rem}% restante ({tok_7d_rem})** de {tok_7d_tot} ({renova_7d})  
Modelo:   {display_model} (Effort: {effort_level}) | Janela: {win_str} | Saída: {max_out_str}
```

### Regras de Preenchimento:
1. **Sem Emojis e Sem Fluff:** Proibido uso de emojis (🪙, 📊, 🎯) ou frases redundantes ("Consumo Desta Mensagem:", "Telemetria Acumulada:").
2. **Alinhamento a 10 Colunas:** Rótulos alinhados (`Consumo:  `, `Contexto: `, `5h:       `, `Semana:   `, `Modelo:   `).
3. **Quebra de Linha Dura:** Cada linha DEVE terminar com dois espaços antes do `\n` (`  \n`) para impedir colapso de parágrafo no renderizador Markdown do chat.
4. **Destaque:** Na linha da Semana, o saldo restante permanece destacado em negrito: `**XX.X% restante (XX.Xk/M)**`.
5. **Injeção Automática via Language Server RPC (Sem Hallucinações):** O hook nativo `dynamic-effort-router` (PreInvocation) consulta a API oficial `RetrieveUserQuotaSummary` em tempo real e injeta o bloco oficial de telemetria no prompt deste turno. O assistente DEVE copiar e colar os valores reais desse bloco, eliminando aproximações manuais.
6. **Paridade Absoluta (Modelos Google e Terceiros):**
   - **Google (Gemini):** Lê os limites em tempo real dos buckets `gemini-5h` e `gemini-weekly`.
   - **Terceiros (Claude e GPT):** Lê os limites em tempo real dos buckets `3p-5h` e `3p-weekly` compartilhados entre Claude e GPT, mantendo estrutura, percentuais e formatação idênticos aos exibidos na UI oficial.
7. **Universalidade:** Obrigatório em todas as respostas de todos os projetos (IDE e CLI).
