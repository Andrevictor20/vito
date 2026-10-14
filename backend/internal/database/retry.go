package database

import (
	"database/sql"
	"strings"
	"time"
)

// WithBusyRetry reexecuta a operação com backoff quando o SQLite reporta
// SQLITE_BUSY / database is locked (contenção residual entre escritor e leitores).
func WithBusyRetry(attempts int, op func() error) error {
	var err error
	for i := 0; i < attempts; i++ {
		if err = op(); err == nil {
			return nil
		}
		if !isBusyError(err) {
			return err
		}
		time.Sleep(time.Duration(20*(i+1)) * time.Millisecond)
	}
	return err
}

func isBusyError(err error) bool {
	if err == nil || err == sql.ErrNoRows {
		return false
	}
	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "database is locked") ||
		strings.Contains(msg, "database table is locked") ||
		strings.Contains(msg, "sqlite_busy")
}
