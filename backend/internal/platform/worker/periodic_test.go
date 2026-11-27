package worker_test

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/platform/worker"
)

func TestPeriodicLoop_StartStopIdempotentAndRunImmediately(t *testing.T) {
	var runs atomic.Int32
	loop := worker.NewPeriodicLoop(25*time.Millisecond, true)

	if !loop.Start(func() { runs.Add(1) }) {
		t.Fatal("esperava true no primeiro Start")
	}
	if loop.Start(func() { runs.Add(1) }) {
		t.Fatal("esperava false em Start duplicado")
	}
	if !loop.IsRunning() {
		t.Fatal("esperava IsRunning() == true após Start")
	}

	deadline := time.Now().Add(500 * time.Millisecond)
	for runs.Load() < 2 && time.Now().Before(deadline) {
		time.Sleep(10 * time.Millisecond)
	}
	if runs.Load() < 2 {
		t.Fatalf("esperava ao menos 2 execuções (imediata + tick), obteve %d", runs.Load())
	}

	loop.Stop()
	loop.Stop() // idempotente: não deve dar panic
	if loop.IsRunning() {
		t.Fatal("esperava IsRunning() == false após Stop")
	}

	// Reiniciar após Stop deve funcionar normalmente
	if !loop.Start(func() { runs.Add(1) }) {
		t.Fatal("esperava poder reiniciar após Stop")
	}
	loop.Stop()
}

func TestPeriodicLoop_WaitForTickWhenNotImmediate(t *testing.T) {
	var runs atomic.Int32
	loop := worker.NewPeriodicLoop(20*time.Millisecond, false)

	if !loop.Start(func() { runs.Add(1) }) {
		t.Fatal("esperava true no Start")
	}
	defer loop.Stop()

	deadline := time.Now().Add(500 * time.Millisecond)
	for runs.Load() < 1 && time.Now().Before(deadline) {
		time.Sleep(5 * time.Millisecond)
	}
	if runs.Load() < 1 {
		t.Fatalf("esperava execução via tick, obteve %d", runs.Load())
	}
}
