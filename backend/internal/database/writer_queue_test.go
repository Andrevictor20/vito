package database

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"testing"
	"time"

	_ "modernc.org/sqlite"
)

func TestSingleWriterQueue_ConcurrencyStress(t *testing.T) {
	tmpDB := fmt.Sprintf("%s/test_queue_%d.db", t.TempDir(), time.Now().UnixNano())
	db, err := sql.Open("sqlite", tmpDB+"?_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)")
	if err != nil {
		t.Fatalf("falha ao abrir sqlite: %v", err)
	}
	defer db.Close()

	_, err = db.Exec(`CREATE TABLE counter (id INTEGER PRIMARY KEY, val INTEGER); INSERT INTO counter (id, val) VALUES (1, 0);`)
	if err != nil {
		t.Fatalf("falha ao criar schema: %v", err)
	}

	queue := NewSingleWriterQueue(100)
	defer queue.Close()

	const concurrentGoroutines = 50
	var wg sync.WaitGroup
	errs := make(chan error, concurrentGoroutines)

	for i := 0; i < concurrentGoroutines; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			err := queue.Execute(ctx, func() error {
				_, execErr := db.ExecContext(ctx, "UPDATE counter SET val = val + 1 WHERE id = 1;")
				return execErr
			})
			if err != nil {
				errs <- err
			}
		}()
	}

	wg.Wait()
	close(errs)

	for err := range errs {
		t.Errorf("erro durante escrita concorrente: %v", err)
	}

	var finalVal int
	if err := db.QueryRow("SELECT val FROM counter WHERE id = 1").Scan(&finalVal); err != nil {
		t.Fatalf("falha ao ler valor final: %v", err)
	}

	if finalVal != concurrentGoroutines {
		t.Fatalf("esperava val = %d, obteve %d", concurrentGoroutines, finalVal)
	}
}

func TestSingleWriterQueue_ContextCancellation(t *testing.T) {
	queue := NewSingleWriterQueue(10)
	defer queue.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancela imediatamente

	err := queue.Execute(ctx, func() error {
		return nil
	})

	if err != context.Canceled {
		t.Fatalf("esperava context.Canceled, obteve %v", err)
	}
}
