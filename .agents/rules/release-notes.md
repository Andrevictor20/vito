# Regra: Isolamento Estrito de Notas de Versão do Saturn (Release Notes)

Esta regra é inegociável e deve ser estritamente aplicada por todos os agentes e desenvolvedores em qualquer operação de release, bump de versão, atualização de documentação de lançamento ou geração de notas de versão do **Saturn**.

---

## 1. Regra de Ouro: Escopo Exclusivo da Versão Vigente
- Ao atualizar o Saturn para uma nova versão (ex: `vX.Y.Z`), as notas de versão (`LATEST_RELEASE.md`, payloads de `/api/system/update` e anúncios de release) devem conter **EXCLUSIVAMENTE** as alterações, novos recursos, melhorias e correções pertencentes à **versão que está sendo lançada**.
- **PROIBIÇÃO ABSOLUTA DE DADOS DE VERSÕES ANTIGAS:** É terminantemente proibido manter, reaproveitar, duplicar, concatenar ou acumular dados, textos, listas de features ou correções de versões anteriores no arquivo `LATEST_RELEASE.md` ou nos diálogos de atualização do sistema.

---

## 2. Por que esta regra existe?
1. **Consumo Direto pelo Sistema em Produção:**
   O arquivo `LATEST_RELEASE.md` é lido diretamente pelo backend do Saturn (`backend/src/system/update/checker.rs`) e entregue à API `/api/system/update`, que por sua vez alimenta o modal visual de atualização no frontend (`UpdateModal.tsx`).
2. **Prevenção de Ruído e Confusão do Usuário:**
   Se dados de versões anteriores permanecerem em `LATEST_RELEASE.md`, o usuário verá informações defasadas ou repetidas no modal de atualização ao invés de entender claramente o que há de novo na versão atual.
3. **Changelog vs. Release Notes da Versão Ativa:**
   - `LATEST_RELEASE.md` representa **apenas o release ativo** (single-release snapshot).
   - O histórico cumulativo de versões passadas pertence ao Git (`git log`), às releases do GitHub (`Releases / Tags`) ou a arquivos de histórico como `.agents/memory/archive/HISTORY.md`, **NUNCA** em `LATEST_RELEASE.md`.

---

## 3. Estrutura Obrigatória de `LATEST_RELEASE.md`
Todo `LATEST_RELEASE.md` gerado deve seguir o padrão canônico aceito pelo parser do frontend (`frontend/src/components/system/releaseNotesParser.ts`):

```markdown
# Saturn Dashboard vX.Y.Z

### Novidades, Correções e Melhorias na Versão X.Y.Z

### ✨ Novidades
- **Nome do Recurso:** Descrição clara e concisa do novo recurso ou funcionalidade adicionada nesta versão.

### ⚡ Desempenho
- **Otimização:** Descrição de ganhos de performance, redução de consumo de CPU/RAM ou melhorias de fluidez.

### 🛠️ Correções
- **Área Corrigida:** Descrição da correção de bugs e resolução de comportamentos anômalos.

### 🔒 Segurança (se aplicável)
- **Melhoria de Segurança:** Detalhes de mitigações ou patches de segurança implementados.
```

---

## 4. Procedimento de Atualização (Bump de Versão)
Ao executar a atualização de versão (seja via `scripts/bump-version.mjs` ou manualmente):
1. **Limpeza Total do Corpo:** Não permita que as notas da versão anterior permaneçam no arquivo. Substitua todo o conteúdo abaixo do cabeçalho pelas novas notas.
2. **Alinhamento do Título e Versão:** O título deve referenciar exclusivamente a versão nova: `# Saturn Dashboard v<nova_versão>`.
3. **Auditoria de Resíduos:** Verifique se nenhuma linha referente a funcionalidades de versões anteriores (ex: `v3.6.0`, `v3.7.0`, etc.) permaneceu acidentalmente no arquivo.

---

## 5. Checklist de Verificação Pré-Release (Release Gatekeeper)
Antes de commitar ou publicar qualquer versão:
- [ ] `LATEST_RELEASE.md` contém apenas dados da nova versão vigente.
- [ ] Nenhuma entrada de versão anterior foi copiada, mantida ou acumulada.
- [ ] O parser do frontend consegue categorizar as seções corretamente.
- [ ] A versão no título de `LATEST_RELEASE.md` coincide exatamente com `frontend/package.json` e `backend/Cargo.toml`.
