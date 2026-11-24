package database

import (
	"errors"
	"sync"
	"testing"
)

func TestWithBusyRetry_SucceedsAfterBusy(t *testing.T) {
	calls := 0
	err := WithBusyRetry(4, func() error {
		calls++
		if calls < 3 {
			return errors.New("database is locked")
		}
		return nil
	})
	if err != nil {
		t.Fatalf("esperava sucesso após retry, veio %v", err)
	}
	if calls != 3 {
		t.Fatalf("esperava 3 tentativas, vieram %d", calls)
	}
}

func TestWithBusyRetry_NonBusyFailsFast(t *testing.T) {
	calls := 0
	err := WithBusyRetry(4, func() error {
		calls++
		return errors.New("constraint failed")
	})
	if err == nil {
		t.Fatal("esperava erro imediato")
	}
	if calls != 1 {
		t.Fatalf("erro não-busy não deve repetir, tentou %d", calls)
	}
}

func TestConcurrentWrites_NoLock(t *testing.T) {
	db, err := Open(":memory:")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	_, err = db.Exec(`INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES ('u1','a@a.com','A','h',datetime('now'),datetime('now'))`)
	if err != nil {
		t.Fatal(err)
	}

	var wg sync.WaitGroup
	errs := make(chan error, 20)
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			errs <- WithBusyRetry(5, func() error {
				_, e := db.Exec(`INSERT INTO todos (id, user_id, title, status, priority, created_at, updated_at) VALUES (?,?,?,?,?,?,?)`,
					"ct-"+string(rune('a'+n%26))+string(rune('0'+n/26)), "u1", "concorrente", "pending", "medium", "2026-10-14", "2026-10-14")
				return e
			})
		}(i)
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		if e != nil {
			t.Fatalf("escrita concorrente falhou: %v", e)
		}
	}
}
