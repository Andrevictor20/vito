#!/usr/bin/env bash
# ==============================================================================
# scripts/setup-hooks.sh: Ativa os git hooks da pasta .githooks no repositório
# ==============================================================================
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

echo "🔧 Configurando git hooks em .githooks/..."
chmod +x .githooks/*
git config core.hooksPath .githooks
echo "✅ Git hooks ativados com sucesso (core.hooksPath = .githooks)!"
