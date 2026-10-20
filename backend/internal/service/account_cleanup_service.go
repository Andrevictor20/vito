package service

import (
	"context"
	"log"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// AccountCleanupService remove contas placeholder (@vito.local) que ficaram órfãs:
// sem sessão ativa e sem qualquer dado (eventos, tarefas ou memórias). Essas contas são
// relics do fluxo de login por WhatsApp e não devem permanecer na base — além de ocuparem
// o número de telefone de terceiros (constraint UNIQUE em users.phone).
type AccountCleanupService struct {
	userRepo    domain.UserRepository
	sessionRepo domain.SessionRepository
	eventRepo   domain.EventRepository
	todoRepo    domain.TodoRepository
	memoryRepo  domain.MemoryRepository
}

// NewAccountCleanupService instancia o serviço de limpeza de contas órfãs.
func NewAccountCleanupService(
	userRepo domain.UserRepository,
	sessionRepo domain.SessionRepository,
	eventRepo domain.EventRepository,
	todoRepo domain.TodoRepository,
	memoryRepo domain.MemoryRepository,
) *AccountCleanupService {
	return &AccountCleanupService{
		userRepo:    userRepo,
		sessionRepo: sessionRepo,
		eventRepo:   eventRepo,
		todoRepo:    todoRepo,
		memoryRepo:  memoryRepo,
	}
}

// hasUserData verifica se a conta possui qualquer conteúdo do usuário.
// Contas com dados nunca são removidas automaticamente.
func (s *AccountCleanupService) hasUserData(ctx context.Context, userID string) bool {
	if s.eventRepo != nil {
		from := time.Date(1970, 1, 1, 0, 0, 0, 0, time.UTC)
		to := time.Date(2100, 1, 1, 0, 0, 0, 0, time.UTC)
		if events, err := s.eventRepo.ListByUser(userID, from, to); err == nil && len(events) > 0 {
			return true
		}
	}
	if s.todoRepo != nil {
		if todos, err := s.todoRepo.ListByUser(userID, ""); err == nil && len(todos) > 0 {
			return true
		}
	}
	if s.memoryRepo != nil {
		if memories, err := s.memoryRepo.ListByUser(userID, 1); err == nil && len(memories) > 0 {
			return true
		}
	}
	return false
}

// hasActiveSession verifica se a conta possui sessão ativa.
func (s *AccountCleanupService) hasActiveSession(ctx context.Context, userID string) bool {
	if s.sessionRepo == nil {
		return false
	}
	sessions, err := s.sessionRepo.ListActiveByUser(userID, time.Now().UTC())
	if err != nil {
		// Falha ao consultar sessões: na dúvida, preserva a conta.
		return true
	}
	return len(sessions) > 0
}

// ActiveSessionsForUser expõe se a conta ainda tem sessão ativa (usado em diagnósticos).
func (s *AccountCleanupService) ActiveSessionsForUser(ctx context.Context, userID string) bool {
	return s.hasActiveSession(ctx, userID)
}

// PurgeOrphanPlaceholderAccounts remove as contas placeholder abandonadas e devolve
// o número de telefone ao seu dono real. Retorna quantas contas foram removidas.
//
// Critério: conta @vito.local **sem nenhum dado do usuário** (eventos, tarefas ou memórias).
// Sessões ativas não impedem a remoção: o login por WhatsApp para contas placeholder foi
// desativado, ou seja, elas estão inacessíveis — mantê-las apenas retém o número de
// telefone de terceiros (constraint UNIQUE em users.phone). As sessões são removidas em
// cascata pelo próprio banco (FOREIGN KEY user_id ON DELETE CASCADE).
func (s *AccountCleanupService) PurgeOrphanPlaceholderAccounts(ctx context.Context) (int, error) {
	if s.userRepo == nil {
		return 0, nil
	}

	users, err := s.userRepo.ListAll()
	if err != nil {
		return 0, err
	}

	purged := 0
	for i := range users {
		u := users[i]
		if u.ID == "" || !isPlaceholderEmail(u.Email) {
			continue
		}
		if s.hasUserData(ctx, u.ID) {
			continue
		}
		if err := s.userRepo.Delete(u.ID); err != nil {
			log.Printf("[account-cleanup] falha ao remover conta órfã %s: %v", u.ID, err)
			continue
		}
		purged++
		log.Printf("[account-cleanup] conta placeholder órfã removida: %s (%s)", u.ID, u.Email)
	}

	return purged, nil
}
