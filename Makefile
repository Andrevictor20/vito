# ==============================================================================
# Makefile — Kito Monorepo (Go Backend + Expo Mobile)
# ==============================================================================

.PHONY: all test test-backend test-mobile build dev mobile docker clean

all: test build

# Testes TDD
test: test-backend test-mobile

test-backend:
	@echo "🧪 Executando testes unitários do backend Go..."
	@cd backend && go test -v -race ./...

test-mobile:
	@echo "📱 Executando validação do mobile..."
	@cd mobile && npm test

# Build
build:
	@echo "🔨 Compilando binário do backend..."
	@cd backend && go build -v -o bin/kito-server ./cmd/server

# Desenvolvimento Local
start:
	@bash scripts/dev.sh

dev-all: start

dev:
	@echo "🚀 Iniciando backend Go em modo desenvolvimento..."
	@cd backend && go run ./cmd/server

web:
	@echo "🌐 Abrindo Expo no navegador..."
	@cd mobile && npx expo start --web

mobile:
	@echo "📱 Iniciando Expo Dev Server (escaneie o QR code no Expo Go)..."
	@cd mobile && npx expo start

# Docker
docker:
	@echo "🐳 Construindo imagem Docker do backend..."
	@docker compose build

clean:
	@rm -rf backend/bin mobile/node_modules
