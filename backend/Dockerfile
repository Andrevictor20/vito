# ==============================================================================
# Dockerfile — Kito Backend (Multi-Arquitetura: linux/amd64, linux/arm64)
# ==============================================================================

# Stage 1: Build
FROM --platform=$BUILDPLATFORM golang:alpine AS builder

ARG TARGETOS
ARG TARGETARCH

WORKDIR /app

RUN apk add --no-cache ca-certificates git tzdata

COPY go.mod go.sum ./
RUN go mod download

COPY . .

# Compilação estática com suporte multi-arquitetura nativo e local
RUN if [ -n "$TARGETARCH" ]; then \
        CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=$TARGETARCH go build -ldflags="-w -s" -o /app/vito-server ./cmd/server; \
    else \
        CGO_ENABLED=0 go build -ldflags="-w -s" -o /app/vito-server ./cmd/server; \
    fi

# Stage 2: Runtime Minimalista Non-Root
FROM alpine:3.20 AS runner

RUN apk add --no-cache ca-certificates tzdata \
    && addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Cria diretório para dados persistentes (SQLite)
RUN mkdir -p /app/data && chown -R appuser:appgroup /app/data

COPY --from=builder --chown=appuser:appgroup /app/vito-server /app/vito-server

USER appuser

EXPOSE 8080 8180

ENV PORT=8080 \
    APP_ENV=production \
    DB_PATH=/app/data/vito.db

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-8080}/healthz || exit 1

ENTRYPOINT ["/app/vito-server"]
