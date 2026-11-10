# XP Multi-Agent Kit v4 (Thin Harness)

> **Idioma Obrigatório:** Todas as respostas, planos e explicações ao usuário DEVEM ser em Português (Português do Brasil).

## 1. CONTRATO
Separar O QUÊ (especificação, ACs, SbE) do COMO (código, testes). Validar via `xp contract validate <spec>`. Reduzir ambiguidade antes de implementar.

## 2. CONTEXTO
Contexto base fixo restrito (≤ 8 KB total). Consultar memória sob demanda via `xp context <query>`. Políticas detalhadas residem em `.agents/policies/` e carregam JIT.
**Step 0 Obrigatório:** Inspecione SEMPRE `.agents/memory/PROJECT_MEMORY.md` antes de propor ou alterar código. Leia a seção de Dead-Ends para NUNCA sugerir ou repetir abordagens que já falharam.

## 3. FERRAMENTAS
Uso prioritário de ferramentas determinísticas locais (`xp`) e AST graph (`code-review-graph` / `agy-graph`) para impacto e chamadas em arquivos > 800 linhas (com fallback textual se ausente). Sem spam de chamadas.

## 4. ESTADO
Estado transiente de execução mantido em `.agents/runtime/` (`run.json`, `events.jsonl`, `flow_state.json`). Não versionado em Git.

## 5. POLÍTICA
Governança declarativa em `.agents/policy.yaml`. Ações classificadas em camadas (`auto`, `review`, `human`). Ações irreversíveis e arquivos protegidos exigem `xp approve`.

## 6. VERIFICAÇÃO
Executar `xp gate check` antes de concluir fases e tarefas. Revisões EGM (Pass 1 Spec, Pass 2 Código, Pass 3 Conformance via `xp conformance`). Ciclo estrito TDD: RED → GREEN → REFACTOR. Anti-Test-Bypass rígido (sem blind mocks, sem asserções vazias, sem pular testes). Rastreabilidade 100% de ACs.
**Zero Correção Cosmética:** Proibido afirmar que algo está corrigido sem executar teste nativo e observar exit_code 0. Para bugs corrigidos, criar teste de regressão obrigatório para impedir retorno do erro.

## 7. RECUPERAÇÃO
Auto-cura determinística em falhas de ferramenta/testes: isolar causa raiz, corrigir e re-verificar. Circuit breaker: interromper na 2ª falha idêntica consecutiva. Registrar abordagens fracassadas na Seção de Dead-Ends da memória.

## 8. OBSERVABILIDADE
Eventos de execução emitidos de forma estruturada via `kit_events.py` para `.agents/runtime/events.jsonl`. Recibo operacional emitido a cada invocação.

## Invariantes & Regras Transitórias
- **Stop Gate Humano:** Ações de risco L2/L3 e aprovação de specs exigem confirmação explícita ou pré-autorização documentada.
- **Orçamentos:** Limites de turnos e tokens regidos por `workflow.yaml` / `kit_constants.py`.
- **Memória Contínua:** Atualizar `.agents/memory/PROJECT_MEMORY.md` ao final de cada fase/entrega, registrando progresso, decisões e dead-ends.
- **Qualidade de Código:** Sem God Files (> 500 linhas), sem `TODO`/`TBD`, sem contornos (`as any`, `@ts-ignore`).
