# REPO MAP — XP Multi-Agent Kit (Símbolos & Estrutura)
> Mapa gerado automaticamente pelo `agy-repo-map`. Consulte antes de buscar arquivos.

### / (raiz)
- `AGENTS.md`
- `Makefile`
- `docker-compose.prod.yml`
- `docker-compose.yml`
- `package.json`

### backend/
- `Dockerfile`
- `go.mod`
- `go.sum`
- `vito.db`

### backend/cmd/server/
- `main.go`

### backend/data/
- `kito.db`
- `kito.db-shm`
- `kito.db-wal`
- `vito.db`
- `vito.db-shm`
- `vito.db-wal`

### backend/internal/ai/
- `gateway.go`
- `gateway_test.go`
- `gemini.go`
- `openai_compat.go`
- `prompt.go`
- `provider.go`
- `whisper.go`
- `whisper_test.go`

### backend/internal/config/
- `config.go`

### backend/internal/database/
- `sqlite.go`

### backend/internal/domain/
- `calendar.go`
- `memory.go`
- `todo.go`
- `user.go`

### backend/internal/handler/
- `assistant_handler.go`
- `assistant_handler_test.go`
- `auth_handler.go`
- `calendar_handler.go`
- `todo_handler.go`

### backend/internal/handler/middleware/
- `auth.go`

### backend/internal/repository/
- `calendar_repo.go`
- `calendar_repo_test.go`
- `memory_repo.go`
- `memory_repo_test.go`
- `todo_repo.go`
- `todo_repo_test.go`
- `user_repo.go`
- `user_repo_test.go`

### backend/internal/server/
- `assistant_integration_test.go`
- `integration_test.go`
- `server.go`
- `server_test.go`

... [demais arquivos omitidos para manter < 80 linhas]
