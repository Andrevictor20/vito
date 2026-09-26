#!/usr/bin/env bash
# ==============================================================================
# scripts/dev.sh: Inicializa Backend (Go) + Frontend (Expo Web/Mobile) simultaneamente
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "======================================================================"
echo "🚀 Iniciando ambiente de desenvolvimento Kito (Backend + Frontend)"
echo "======================================================================"

# Cleanup ao sair (Ctrl+C)
cleanup() {
  echo ""
  echo "🛑 Encerrando serviços do Kito..."
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  if [ -n "${FRONTEND_PID:-}" ]; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  echo "✅ Serviços finalizados."
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 1. Inicia Backend Go em background
echo "📦 [1/2] Iniciando Backend Go na porta :8080..."
(cd backend && go run ./cmd/server) &
BACKEND_PID=$!

# Aguarda o backend responder no healthcheck
echo "⏳ Aguardando backend responder em http://localhost:8080/healthz..."
for i in {1..30}; do
  if curl -s http://localhost:8080/healthz >/dev/null 2>&1; then
    echo "✅ Backend online e respondendo!"
    break
  fi
  sleep 0.5
done

# 2. Inicia Frontend Expo Web no navegador
echo "📱 [2/2] Iniciando Frontend Expo..."
echo "👉 Pressione 'w' no terminal caso o navegador não abra automaticamente."
echo "👉 Escaneie o QR Code com o Expo Go se quiser testar no Android simultaneamente."
echo "----------------------------------------------------------------------"

cd mobile && npx expo start --web
