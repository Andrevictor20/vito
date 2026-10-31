package service

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrDuplicatePendingConfirmation = errors.New("confirmação duplicada já pendente")
	ErrConfirmationAlreadyResolved  = errors.New("a confirmação já foi resolvida anteriormente")
	ErrConfirmationCancelled        = errors.New("a confirmação foi cancelada pelo usuário")
	ErrUnauthorizedTenant           = errors.New("usuário não autorizado para esta confirmação")
)

// CreatePendingRequest encapsula a solicitação de suspensão de ação no gate.
type CreatePendingRequest struct {
	UserID         string
	ThreadID       string
	Channel        string
	ToolsetName    string
	Operation      string
	ArgumentsJSON  string
	PreviewJSON    string
	IdempotencyKey string
	TaintedContext bool
	TTL            time.Duration
}

// ConfirmationGateService fornece a interface de alto nível para o Confirmation Gate.
type ConfirmationGateService struct {
	fsm *ConfirmationStateMachine
	db  *sql.DB
}

// NewConfirmationGateService cria o serviço.
func NewConfirmationGateService(db *sql.DB) *ConfirmationGateService {
	return &ConfirmationGateService{
		fsm: NewConfirmationStateMachine(db),
		db:  db,
	}
}

// CreatePending registra uma nova pendência de confirmação.
func (s *ConfirmationGateService) CreatePending(ctx context.Context, req *CreatePendingRequest) (*PendingConfirmationRecord, error) {
	if req.IdempotencyKey != "" {
		// Checa se já existe item suspenso com a mesma idempotency key
		query := `
			SELECT id, user_id, thread_id, channel, toolset_name, operation,
			       arguments_json, preview_json, idempotency_key, tainted_context,
			       status, expires_at, resolved_at, execution_result_json, created_at
			FROM pending_confirmations
			WHERE user_id = ? AND idempotency_key = ? AND status = 'SUSPENDED'
		`
		row := s.db.QueryRowContext(ctx, query, req.UserID, req.IdempotencyKey)
		existing, err := scanPendingConfirmation(row)
		if err == nil && existing != nil {
			return existing, nil
		}
	}

	ttl := req.TTL
	if ttl == 0 {
		ttl = 24 * time.Hour
	}
	now := time.Now().UTC()

	record := &PendingConfirmationRecord{
		ID:             uuid.New().String(),
		UserID:         req.UserID,
		ThreadID:       req.ThreadID,
		Channel:        req.Channel,
		ToolsetName:    req.ToolsetName,
		Operation:      req.Operation,
		ArgumentsJSON:  req.ArgumentsJSON,
		PreviewJSON:    req.PreviewJSON,
		IdempotencyKey: req.IdempotencyKey,
		TaintedContext: req.TaintedContext,
		Status:         StatusSuspended,
		ExpiresAt:      now.Add(ttl),
		CreatedAt:      now,
	}

	return s.fsm.SuspendAction(ctx, record)
}

// GetByID busca uma confirmação validando isolamento por tenant.
func (s *ConfirmationGateService) GetByID(ctx context.Context, id, userID string) (*PendingConfirmationRecord, error) {
	p, err := s.fsm.GetPending(ctx, id)
	if err != nil {
		return nil, err
	}
	if p.UserID != userID {
		return nil, ErrUnauthorizedTenant
	}
	return p, nil
}

// Resume aprova a confirmação e transiciona para RESUMED.
func (s *ConfirmationGateService) Resume(ctx context.Context, id, userID string) (*PendingConfirmationRecord, error) {
	p, err := s.GetByID(ctx, id, userID)
	if err != nil {
		return nil, err
	}

	if p.Status == StatusResumed {
		return nil, ErrConfirmationAlreadyResolved
	}
	if p.Status == StatusCancelled {
		return nil, ErrConfirmationCancelled
	}
	if time.Now().After(p.ExpiresAt) {
		_ = s.fsm.ExpireAction(ctx, id)
		return nil, ErrConfirmationExpired
	}

	now := time.Now().UTC()
	err = s.fsm.ResumeAction(ctx, id, map[string]any{"resumed_at": now})
	if err != nil {
		if errors.Is(err, ErrConfirmationNotPending) {
			return nil, ErrConfirmationAlreadyResolved
		}
		return nil, err
	}

	p.Status = StatusResumed
	p.ResolvedAt = &now
	return p, nil
}

// Cancel cancela a confirmação pendente.
func (s *ConfirmationGateService) Cancel(ctx context.Context, id, userID string) error {
	p, err := s.GetByID(ctx, id, userID)
	if err != nil {
		return err
	}
	if p.Status != StatusSuspended {
		return ErrConfirmationAlreadyResolved
	}
	return s.fsm.CancelAction(ctx, id)
}
