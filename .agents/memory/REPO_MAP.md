# REPO MAP — XP Multi-Agent Kit (Símbolos & Estrutura)
> Mapa gerado automaticamente pelo `agy-repo-map`. Consulte antes de buscar arquivos.

### / (raiz)
- `AGENTS.md`
- `Makefile`
- `docker-compose.yml`
- `package.json`

### backend/
- `Dockerfile`
- `go.mod`
- `go.sum`

### backend/cmd/server/
- `main.go`

### backend/internal/config/
- `config.go`

### backend/internal/database/
- `sqlite.go`

### backend/internal/domain/
- `calendar.go`
- `todo.go`
- `user.go`

### backend/internal/handler/
- `auth_handler.go`
- `calendar_handler.go`
- `todo_handler.go`

### backend/internal/handler/middleware/
- `auth.go`

### backend/internal/repository/
- `calendar_repo.go`
- `calendar_repo_test.go`
- `todo_repo.go`
- `todo_repo_test.go`
- `user_repo.go`
- `user_repo_test.go`

### backend/internal/server/
- `integration_test.go`
- `server.go`
- `server_test.go`

### backend/internal/service/
- `auth_service.go`
- `auth_service_test.go`
- `calendar_service.go`
- `calendar_service_test.go`
- `todo_service.go`
- `todo_service_test.go`

### docs/specs/
- `MVP_SPEC.md`

### mobile/
- `App.tsx`
- `app.json`
- `package-lock.json`
- `package.json`
- `tsconfig.json`

### scripts/
- `dev.sh`
- `setup-hooks.sh`
