# Regra: Governança de Releases e Bumps de Versão (Código & Funcionalidades Apenas)

Esta regra é inegociável e deve ser estritamente aplicada por todos os agentes e desenvolvedores em qualquer operação no repositório **Saturn** (`Andrevictor20/saturn`).

---

## 1. Regra de Ouro: Proibição de Bumps e Releases Cosméticas
- **NÃO BUMP SEM CÓDIGO/FEATURES:** É estritamente proibido incrementar a versão do projeto (`backend/Cargo.toml`, `frontend/package.json`, `scripts/bump-version.mjs`), criar tags no Git ou publicar GitHub Releases para alterações que **não envolvam código funcional ou melhorias/correções reais no Saturn ou no saturn-apps**.
- **Exemplos de alterações que NUNCA devem ter bump de versão:**
  - Alterações em documentação (`README.md`, `docs/**`, `*.md`).
  - Atualizações de licença (`LICENSE`) ou arquivos de metadados (`.gitignore`, etc.).
  - Configurações e diretrizes de agentes/IA (`.agents/**`, `AGENTS.md`).
  - Scripts de desenvolvimento local, testes de carga pontuais (`load-tests/**`, `scripts/security-zap-scan.sh`).
  - Correções de typos ou melhorias puramente textuais de docs.

---

## 2. Por que esta regra existe?
1. **Geração Desnecessária de Imagens Docker (CD):**
   O pipeline de CD (`.github/workflows/cd.yml`) compila imagens multi-arch (`amd64` e `arm64`) e publica no GHCR e Docker Hub a cada release/tag gerada. Compilar imagens inteiras para um ajuste de README consome minutos preciosos de runner e banda desnecessária.
2. **Alertas Falsos e Sobrecarga para Usuários Finais:**
   O Saturn Dashboard verifica periodicamente releases no GitHub. Se uma versão nova (ex: `v3.7.1`) for publicada para uma mudança de README, todos os servidores e Raspberry Pis dos usuários recebem o alerta de "Nova Versão Disponível" e baixam centenas de megabytes de imagem Docker sem receber nenhuma melhoria ou alteração no sistema.
3. **Disciplina SemVer e Respeito ao Homelab:**
   Versões SemVer (`MAJOR.MINOR.PATCH`) refletem alterações na base de código do produto (recursos, refatorações, correções). Alterações de documentação pertencem ao histórico do branch `main` sem necessidade de nova versão do artefato distribuído.

---

## 3. Quando DEVE haver Bump de Versão?
Um bump de versão (`node scripts/bump-version.mjs [patch|minor|major]`) só é permitido e exigido quando:
- Há novas funcionalidades ou telas no Saturn (`frontend/src/**`, `backend/src/**`).
- Há correções de bugs, segurança ou melhorias de performance no Saturn.
- Há alterações no runtime do contêiner (`Dockerfile`, dependências do backend/frontend).
- Há novidades estruturais ou de catálogo do ecossistema `saturn-apps`.

---

## 4. Salvaguardas no Script de Bump (`scripts/bump-version.mjs`)
O script `scripts/bump-version.mjs` inclui uma salvaguarda automatizada via Git: se as alterações pendentes ou o commit mais recente envolverem apenas documentação ou regras de agentes, a execução é bloqueada preventivamente a menos que a flag `--force` seja informada explicitamente.
