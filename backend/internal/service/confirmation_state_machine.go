package service

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var (
	ErrConfirmationNotFound   = errors.New("confirmação pendente não encontrada")
	ErrConfirmationNotPending  = errors.New("a confirmação já foi resolvida ou expirou")
	ErrConfirmationExpired     = errors.New("o prazo para confirmação expirou")
)

// PendingConfirmationStatus define os estados da máquina de confirmação.
type PendingConfirmationStatus string

const (
	StatusSuspended PendingConfirmationStatus = "SUSPENDED"
	StatusResumed   PendingConfirmationStatus = "RESUMED"
	StatusCancelled PendingConfirmationStatus = "CANCELLED"
	StatusExpired   PendingConfirmationStatus = "EXPIRED"
)

// PendingConfirmationRecord mapeia a tabela pending_confirmations do SQLite.
type PendingConfirmationRecord struct {
	ID                  string                    `json:"id"`
	UserID              string                    `json:"user_id"`
	ThreadID            string                    `json:"thread_id"`
	Channel             string                    `json:"channel"`
	ToolsetName         string                    `json:"toolset_name"`
	Operation           string                    `json:"operation"`
	ArgumentsJSON       string                    `json:"arguments_json"`
	PreviewJSON         string                    `json:"preview_json"`
	IdempotencyKey      string                    `json:"idempotency_key"`
	TaintedContext      bool                      `json:"tainted_context"`
	Status              PendingConfirmationStatus `json:"status"`
	ExpiresAt           time.Time                 `json:"expires_at"`
	ResolvedAt          *time.Time                `json:"resolved_at"`
	ExecutionResultJSON string                    `json:"execution_result_json"`
	CreatedAt           time.Time                 `json:"created_at"`
}

// ConfirmationStateMachine gerencia a transição segura SUSPENDED -> RESUMED no SQLite.
type ConfirmationStateMachine struct {
	db *sql.DB
}

// NewConfirmationStateMachine cria a máquina de estados.
func NewConfirmationStateMachine(db *sql.DB) *ConfirmationStateMachine {
	return &ConfirmationStateMachine{db: db}
}

// SuspendAction grava uma ação suspensa aguardando confirmação humana.
func (sm *ConfirmationStateMachine) SuspendAction(ctx context.Context, p *PendingConfirmationRecord) (*PendingConfirmationRecord, error) {
	if p.ID == "" {
		p.ID = uuid.New().String()
	}
	if p.CreatedAt.IsZero() {
		p.CreatedAt = time.Now().UTC()
	}
	if p.ExpiresAt.IsZero() {
		p.ExpiresAt = p.CreatedAt.Add(24 * time.Hour)
	}
	if p.Status == "" {
		p.Status = StatusSuspended
	}
	if p.ArgumentsJSON == "" {
		p.ArgumentsJSON = "{}"
	}
	if p.PreviewJSON == "" {
		p.PreviewJSON = "{}"
	}
	if p.ExecutionResultJSON == "" {
		p.ExecutionResultJSON = "{}"
	}
	if p.IdempotencyKey == "" {
		p.IdempotencyKey = fmt.Sprintf("%s:%s:%s", p.UserID, p.ToolsetName, p.Operation)
	}

	taintedInt := 0
	if p.TaintedContext {
		taintedInt = 1
	}

	query := `
		INSERT INTO pending_confirmations (
			id, user_id, thread_id, channel, toolset_name, operation,
			arguments_json, preview_json, idempotency_key, tainted_context,
			status, expires_at, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	_, err := sm.db.ExecContext(ctx, query,
		p.ID, p.UserID, p.ThreadID, p.Channel, p.ToolsetName, p.Operation,
		p.ArgumentsJSON, p.PreviewJSON, p.IdempotencyKey, taintedInt,
		string(p.Status), p.ExpiresAt, p.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("falha ao suspender ação no confirmation gate: %w", err)
	}

	return p, nil
}

// GetPending busca uma confirmação por ID.
func (sm *ConfirmationStateMachine) GetPending(ctx context.Context, id string) (*PendingConfirmationRecord, error) {
	query := `
		SELECT id, user_id, thread_id, channel, toolset_name, operation,
		       arguments_json, preview_json, idempotency_key, tainted_context,
		       status, expires_at, resolved_at, execution_result_json, created_at
		FROM pending_confirmations
		WHERE id = ?
	`
	row := sm.db.QueryRowContext(ctx, query, id)
	return scanPendingConfirmation(row)
}

// ResumeAction transiciona uma confirmação de SUSPENDED para RESUMED e grava o resultado de execução.
func (sm *ConfirmationStateMachine) ResumeAction(ctx context.Context, id string, result any) error {
	p, err := sm.GetPending(ctx, id)
	if err != nil {
		return err
	}
	if p.Status != StatusSuspended {
		return fmt.Errorf("%w: status atual é %s", ErrConfirmationNotPending, p.Status)
	}
	if time.Now().After(p.ExpiresAt) {
		_ = sm.ExpireAction(ctx, id)
		return ErrConfirmationExpired
	}

	resultBytes, _ := json.Marshal(result)
	now := time.Now().UTC()

	query := `
		UPDATE pending_confirmations
		SET status = ?, resolved_at = ?, execution_result_json = ?
		WHERE id = ? AND status = ?
	`
	res, err := sm.db.ExecContext(ctx, query, string(StatusResumed), now, string(resultBytes), id, string(StatusSuspended))
	if err != nil {
		return fmt.Errorf("falha ao retomar confirmação: %w", err)
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrConfirmationNotPending
	}
	return nil
}

// CancelAction cancela uma confirmação suspensa.
func (sm *ConfirmationStateMachine) CancelAction(ctx context.Context, id string) error {
	now := time.Now().UTC()
	query := `
		UPDATE pending_confirmations
		SET status = ?, resolved_at = ?
		WHERE id = ? AND status = ?
	`
	res, err := sm.db.ExecContext(ctx, query, string(StatusCancelled), now, id, string(StatusSuspended))
	if err != nil {
		return err
	}
	affected, _ := res.RowsAffected()
	if affected == 0 {
		return ErrConfirmationNotPending
	}
	return nil
}

// ExpireAction marca como expirada se passou do prazo.
func (sm *ConfirmationStateMachine) ExpireAction(ctx context.Context, id string) error {
	now := time.Now().UTC()
	query := `
		UPDATE pending_confirmations
		SET status = ?, resolved_at = ?
		WHERE id = ? AND status = ?
	`
	_, err := sm.db.ExecContext(ctx, query, string(StatusExpired), now, id, string(StatusSuspended))
	return err
}

func scanPendingConfirmation(scanner interface{ Scan(...any) error }) (*PendingConfirmationRecord, error) {
	var p PendingConfirmationRecord
	var taintedInt int
	var statusStr string
	var resolvedAt sql.NullTime

	err := scanner.Scan(
		&p.ID, &p.UserID, &p.ThreadID, &p.Channel, &p.ToolsetName, &p.Operation,
		&p.ArgumentsJSON, &p.PreviewJSON, &p.IdempotencyKey, &taintedInt,
		&statusStr, &p.ExpiresAt, &resolvedAt, &p.ExecutionResultJSON, &p.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrConfirmationNotFound
		}
		return nil, err
	}
	p.TaintedContext = (taintedInt == 1)
	p.Status = PendingConfirmationStatus(statusStr)
	if resolvedAt.Valid {
		p.ResolvedAt = &resolvedAt.Time
	}
	return &p, nil
}
