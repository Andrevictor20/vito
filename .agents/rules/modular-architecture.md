# 🏛️ Regra de Arquitetura Modular & Anti-God-Files — Vito

Esta regra é mandatória para todo o desenvolvimento no projeto **Vito**, garantindo código sustentável, de fácil manutenção e sem retrabalho de refatorações futuras.

---

## 1. Disciplina SDD + TDD Inegociável
1. **Spec-Driven Development (SDD):** Toda nova feature ou módulo deve ter sua especificação ou contrato de interface delineado antes da implementação.
2. **Test-Driven Development (TDD):**
   - **RED:** O teste unitário/integração deve ser escrito e falhar antes de qualquer linha de código de produção.
   - **GREEN:** O código é implementado estritamente para satisfazer o teste.
   - **REFACTOR:** Melhoria da legibilidade sem quebrar os testes.
3. **Anti-Test-Bypass:** Proibido testes sem asserções, testes pulados (`.skip`, `xit`) ou mocks cegos de lógica de domínio.

---

## 2. Regra Anti-God-Files & Limites de Linhas
* **Teto Máximo Recomendado:** **200 a 300 linhas** por arquivo.
* **Teto Rígido Absoluto:** **Proibido qualquer arquivo ultrapassar 500 linhas**.
* **Princípio da Responsabilidade Única (SRP):**
  - Cada arquivo deve resolver exatamente um propósito coeso (ex: `user_repository.go` cuida de persistência; `auth_service.go` cuida de regras de negócio; `auth_handler.go` cuida de HTTP/JSON).
  - Se uma struct ou função começar a acumular muitas responsabilidades, fatie imediatamente em sub-módulos coesos.

---

## 3. Padrão Estrutural do Backend (Go)
```
backend/
├── cmd/server/            # Apenas inicialização e injeção de dependências
├── internal/
│   ├── domain/            # Entidades puras e interfaces de contrato (zero dependências externas)
│   │   ├── user.go
│   │   ├── event.go
│   │   └── todo.go
│   ├── database/          # Conexão SQLite, WAL mode e migrações
│   │   ├── sqlite.go
│   │   └── migrations/
│   ├── repository/        # Implementações SQLite das interfaces de domínio
│   │   ├── user_repo.go
│   │   └── event_repo.go
│   ├── service/           # Casos de uso e orquestração de regras de negócio
│   │   ├── auth_service.go
│   │   └── calendar_service.go
│   ├── ai/                # Adaptadores de provedores de IA (Google, OpenRouter, Groq)
│   │   ├── provider.go
│   │   ├── gemini.go
│   │   └── failover.go
│   └── handler/           # Handlers HTTP, validação de payload e DTOs
│       ├── auth_handler.go
│       ├── calendar_handler.go
│       └── middleware/    # Auth JWT, rate limit, logging
```

---

## 4. Padrão Estrutural do Mobile (React Native / Expo)
```
mobile/
├── src/
│   ├── components/        # Componentes visuais atômicos reutilizáveis (< 150 linhas)
│   │   ├── Button.tsx
│   │   ├── VoiceRecorder.tsx
│   │   └── EventCard.tsx
│   ├── screens/           # Telas orquestradoras desacopladas (< 250 linhas)
│   │   ├── HomeScreen.tsx
│   │   ├── CalendarScreen.tsx
│   │   └── LoginScreen.tsx
│   ├── services/          # Clientes HTTP e integrações de rede
│   │   ├── api.ts
│   │   └── auth.ts
│   ├── hooks/             # Custom hooks para gerenciamento de estado e áudio
│   │   ├── useVoiceRecord.ts
│   │   └── useCalendar.ts
│   └── types/             # Tipagem TypeScript e contratos
│       ├── domain.ts
│       └── api.ts
```
