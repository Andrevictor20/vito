package ai

import (
	"context"
	"database/sql"
	"fmt"
	"github.com/andrevmp/vito/backend/internal/ai/byok"
	"sync"
	"time"

	"github.com/google/uuid"
)

// RingBufferTraceRecorder acumula traces em memória e descarrega em lote para proteger o SQLite do Pi 4.
type RingBufferTraceRecorder struct {
	db              *sql.DB
	mu              sync.Mutex
	buffer          []AITrace
	capacity        int
	flushChan       chan struct{}
	stopChan        chan struct{}
	interval        time.Duration
	serverTurns     int64
	serverTokensIn  int64
	serverTokensOut int64
}

// NewRingBufferTraceRecorder cria o gravador com capacidade e intervalo de flush em lote.
func NewRingBufferTraceRecorder(db *sql.DB, capacity int, interval time.Duration) *RingBufferTraceRecorder {
	if capacity <= 0 {
		capacity = 200
	}
	if interval <= 0 {
		interval = 10 * time.Second
	}

	r := &RingBufferTraceRecorder{
		db:        db,
		buffer:    make([]AITrace, 0, capacity),
		capacity:  capacity,
		flushChan: make(chan struct{}, 1),
		stopChan:  make(chan struct{}),
		interval:  interval,
	}

	go r.backgroundFlusher()
	return r
}

// RecordAsync adiciona um trace ao buffer sem bloquear a requisição.
// Turnos executados via chave própria ("byok") não incrementam os contadores de cota do servidor (AI-11).
func (r *RingBufferTraceRecorder) RecordAsync(trace AITrace) {
	if trace.ID == "" {
		trace.ID = uuid.New().String()
	}
	if trace.CreatedAt.IsZero() {
		trace.CreatedAt = time.Now().UTC()
	}
	if trace.CredentialSource == "" {
		trace.CredentialSource = "server"
	}
	trace.FallbackReason = byok.RedactSecrets(trace.FallbackReason)
	trace.ErrorCode = byok.RedactSecrets(trace.ErrorCode)
	trace.ProviderName = byok.RedactSecrets(trace.ProviderName)

	r.mu.Lock()
	defer r.mu.Unlock()

	if trace.CredentialSource != "byok" {
		r.serverTurns++
		r.serverTokensIn += int64(trace.TokensIn)
		r.serverTokensOut += int64(trace.TokensOut)
	}

	r.buffer = append(r.buffer, trace)
	if len(r.buffer) >= r.capacity {
		select {
		case r.flushChan <- struct{}{}:
		default:
		}
	}
}

// ServerQuotaStats retorna a contagem acumulada de turnos e tokens consumidos na cota do servidor.
func (r *RingBufferTraceRecorder) ServerQuotaStats() (turns, tokensIn, tokensOut int64) {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.serverTurns, r.serverTokensIn, r.serverTokensOut
}

// FlushNow força o esvaziamento imediato do buffer.
func (r *RingBufferTraceRecorder) FlushNow(ctx context.Context) error {
	r.mu.Lock()
	if len(r.buffer) == 0 {
		r.mu.Unlock()
		return nil
	}
	batch := r.buffer
	r.buffer = make([]AITrace, 0, r.capacity)
	r.mu.Unlock()

	return r.persistBatch(ctx, batch)
}

// Close encerra a goroutine de flush e grava pendências.
func (r *RingBufferTraceRecorder) Close() error {
	close(r.stopChan)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return r.FlushNow(ctx)
}

func (r *RingBufferTraceRecorder) backgroundFlusher() {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			_ = r.FlushNow(context.Background())
		case <-r.flushChan:
			_ = r.FlushNow(context.Background())
		case <-r.stopChan:
			return
		}
	}
}

func (r *RingBufferTraceRecorder) persistBatch(ctx context.Context, batch []AITrace) error {
	if r.db == nil || len(batch) == 0 {
		return nil
	}

	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("falha ao iniciar transação para ai_traces: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO ai_traces (
			id, user_id, thread_id, turn_id, channel, agent_name, task_type,
			credential_source, provider_key, effort,
			provider_name, model_name, step_index, toolset_called, operation_called,
			fallback_triggered, fallback_reason, tainted_turn, confirmation_gate_status,
			tokens_in, tokens_out, latency_ms, status_code, error_code, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return fmt.Errorf("falha ao preparar statement para ai_traces: %w", err)
	}
	defer stmt.Close()

	for _, t := range batch {
		fallbackInt := 0
		if t.FallbackTriggered {
			fallbackInt = 1
		}
		taintedInt := 0
		if t.TaintedTurn {
			taintedInt = 1
		}

		_, err := stmt.ExecContext(ctx,
			t.ID, t.UserID, t.ThreadID, t.TurnID, t.Channel, t.AgentName, string(t.TaskType),
			t.CredentialSource, t.ProviderKey, t.Effort,
			t.ProviderName, t.ModelName, t.StepIndex, t.ToolsetCalled, t.OperationCalled,
			fallbackInt, t.FallbackReason, taintedInt, t.ConfirmationGateStatus,
			t.TokensIn, t.TokensOut, t.LatencyMs, t.StatusCode, t.ErrorCode, t.CreatedAt,
		)
		if err != nil {
			return fmt.Errorf("falha ao inserir registro ai_trace %s: %w", t.ID, err)
		}
	}

	return tx.Commit()
}
