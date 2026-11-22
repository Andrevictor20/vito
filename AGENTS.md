# XP Multi-Agent Kit v4 (Thin Harness)

> **Idioma:** Todas as respostas, planos e explicações ao usuário DEVEM ser em Português (PT-BR).

## 1. CONTRATO
Separar O QUÊ do COMO. Inicializar em 1 comando (sem `--help`): `xp contract init --risk L1 --goal "<meta>" --scope <arqs> --verify "<cmd>"` (só usar `--acs AC-01` para critérios numerados). Validar specs via `xp contract validate <spec>`.

## 2. CONTEXTO
Contexto base fixo ≤ 8 KB.
**Step 0:** Ler `.agents/memory/PROJECT_MEMORY.md` via `read_file` **em paralelo** com os arquivos da tarefa (não rodar `xp context` em L0/L1 simples; usar `xp context <query>` / `xp policy show <id>` apenas em L2/L3 ou falha).

## 3. FERRAMENTAS
Priorizar CLI `xp` e busca textual (`grep`/`ripgrep`) para impacto; agrupar chamadas independentes no mesmo turno.

## 4. ESTADO
Estado transiente em `.agents/runtime/` (`run.json`, `events.jsonl`, `flow_state.json`), fora do Git.

## 5. POLÍTICA
Governança declarativa em `.agents/policy.yaml` (`auto` | `review` | `human`). Ações destrutivas e arquivos protegidos exigem `xp approve`.

## 6. VERIFICAÇÃO
Fluxo L1+ (sem turno extra): no turno do teste RED, rodar `xp contract init ...` em paralelo com a criação/edição do teste → `xp gate record -- <teste>` (RED) → editar código → `xp gate record -- <teste> && xp gate check` (**ao obter `GATE PASS`, encerrar sem editar nada depois**). Em L2/L3, aplicar EGM (`xp conformance`). Em `--acs AC-01`, citar `AC-01` ou `test_ac_01_` em `tests/`.
**Zero Correção Cosmética:** Nunca declarar correção sem rodar teste nativo (`exit_code: 0`); todo bug exige teste de regressão.

## 7. RECUPERAÇÃO
Auto-cura determinística na causa raiz. Circuit breaker na 2ª falha idêntica; registrar falhas em Dead-Ends.

## 8. OBSERVABILIDADE
Eventos estruturados via `kit_events.py` em `.agents/runtime/events.jsonl` + recibo operacional.

## Invariantes
- **Stop Gate Humano:** L2/L3 e specs exigem confirmação explícita.
- **Orçamentos:** Limites em `workflow.yaml` / `kit_constants.py`. Atualizar `PROJECT_MEMORY.md` apenas em L2/L3 ou novas decisões/dead-ends (antes do `xp gate check`).
- **Gate Passo 4 (mecânico):** Sem God Files (>500 linhas), `TODO`/`TBD`/`FIXME`, contornos (`as any`, `@ts-ignore`, `# type: ignore`, `# noqa`), skips (`@unittest.skip`, `.skipTest`, `pytest.mark.skip`) ou segredos hardcoded.
