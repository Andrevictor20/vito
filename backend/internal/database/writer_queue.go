package database

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
)

var (
	// ErrQueueClosed indica que a fila de escrita foi encerrada.
	ErrQueueClosed = errors.New("writer queue is closed")
	// ErrQueueTimeout indica que a escrita expirou antes de ser processada.
	ErrQueueTimeout = errors.New("writer queue operation timed out")

	defaultQueueMu sync.RWMutex
	defaultQueue   *SingleWriterQueue
)

// SetDefaultWriterQueue registra a fila de escrita padrão compartilhada pelo processo.
func SetDefaultWriterQueue(q *SingleWriterQueue) {
	defaultQueueMu.Lock()
	defer defaultQueueMu.Unlock()
	defaultQueue = q
}

// DefaultWriterQueue retorna a fila de escrita padrão, se inicializada.
func DefaultWriterQueue() *SingleWriterQueue {
	defaultQueueMu.RLock()
	defer defaultQueueMu.RUnlock()
	return defaultQueue
}

type writeRequest struct {
	ctx  context.Context
	op   func() error
	resp chan error
}

// SingleWriterQueue serializa todas as operações de escrita no SQLite
// através de um canal único e um único loop consumidor dedicado, eliminando
// definitivamente conflitos SQLITE_BUSY entre workers em segundo plano e a API HTTP.
type SingleWriterQueue struct {
	requests chan writeRequest
	quit     chan struct{}
	wg       sync.WaitGroup
	closed   bool
	mu       sync.Mutex
}

// NewSingleWriterQueue inicializa a fila de escrita com buffer configurável.
func NewSingleWriterQueue(bufferSize int) *SingleWriterQueue {
	if bufferSize <= 0 {
		bufferSize = 256
	}
	q := &SingleWriterQueue{
		requests: make(chan writeRequest, bufferSize),
		quit:     make(chan struct{}),
	}
	q.wg.Add(1)
	go q.worker()
	return q
}

// worker consome e executa as escritas sequencialmente.
func (q *SingleWriterQueue) worker() {
	defer q.wg.Done()
	for {
		select {
		case req := <-q.requests:
			select {
			case <-req.ctx.Done():
				req.resp <- req.ctx.Err()
			default:
				err := WithBusyRetry(5, req.op)
				req.resp <- err
			}
		case <-q.quit:
			// Drena requisições pendentes com erro de encerramento
			for {
				select {
				case req := <-q.requests:
					req.resp <- ErrQueueClosed
				default:
					return
				}
			}
		}
	}
}

// Execute enfileira a operação de escrita e aguarda sua conclusão com respeito ao contexto.
func (q *SingleWriterQueue) Execute(ctx context.Context, op func() error) error {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return ErrQueueClosed
	}
	q.mu.Unlock()

	resp := make(chan error, 1)
	req := writeRequest{
		ctx:  ctx,
		op:   op,
		resp: resp,
	}

	select {
	case q.requests <- req:
	case <-ctx.Done():
		return ctx.Err()
	case <-q.quit:
		return ErrQueueClosed
	}

	select {
	case err := <-resp:
		return err
	case <-ctx.Done():
		return ctx.Err()
	}
}

// ExecuteTx executa uma transação gerenciada via SingleWriterQueue.
func (q *SingleWriterQueue) ExecuteTx(ctx context.Context, db *sql.DB, fn func(tx *sql.Tx) error) error {
	return q.Execute(ctx, func() error {
		tx, err := db.BeginTx(ctx, &sql.TxOptions{Isolation: sql.LevelSerializable})
		if err != nil {
			return fmt.Errorf("falha ao iniciar transação na fila de escrita: %w", err)
		}
		defer func() {
			_ = tx.Rollback()
		}()

		if err := fn(tx); err != nil {
			return err
		}
		return tx.Commit()
	})
}

// Close encerra a fila e aguarda o término do worker.
func (q *SingleWriterQueue) Close() {
	q.mu.Lock()
	if q.closed {
		q.mu.Unlock()
		return
	}
	q.closed = true
	close(q.quit)
	q.mu.Unlock()

	q.wg.Wait()
}
