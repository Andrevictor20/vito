package repository

import (
	"context"
	"database/sql"

	"github.com/andrevmp/vito/backend/internal/database"
)

// ExecuteQueuedWrite serializa operações de escrita no SQLite (INSERT, UPDATE, DELETE)
// através da database.DefaultWriterQueue() quando inicializada, ou aplica WithBusyRetry
// como fallback em testes unitários isolados.
func ExecuteQueuedWrite(ctx context.Context, op func() error) error {
	if ctx == nil {
		ctx = context.Background()
	}
	if q := database.DefaultWriterQueue(); q != nil {
		return q.Execute(ctx, op)
	}
	return database.WithBusyRetry(4, op)
}

// ExecuteQueuedWriteRows executa uma operação de escrita na fila e retorna RowsAffected.
func ExecuteQueuedWriteRows(ctx context.Context, op func() (sql.Result, error)) (int64, error) {
	var rowsAffected int64
	err := ExecuteQueuedWrite(ctx, func() error {
		res, execErr := op()
		if execErr != nil {
			return execErr
		}
		var raErr error
		rowsAffected, raErr = res.RowsAffected()
		return raErr
	})
	return rowsAffected, err
}
