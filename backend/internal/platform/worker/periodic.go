package worker

import (
	"sync"
	"time"
)

// PeriodicLoop encapsula o ciclo de vida seguro e idempotente (Start/Stop + ticker)
// de workers periódicos em segundo plano.
type PeriodicLoop struct {
	mu             sync.Mutex
	running        bool
	stopCh         chan struct{}
	wg             sync.WaitGroup
	interval       time.Duration
	runImmediately bool
}

// NewPeriodicLoop cria um gerenciador de ciclo periódico com intervalo mínimo seguro de 1 minuto quando <= 0.
func NewPeriodicLoop(interval time.Duration, runImmediately bool) *PeriodicLoop {
	if interval <= 0 {
		interval = time.Minute
	}
	return &PeriodicLoop{
		interval:       interval,
		runImmediately: runImmediately,
	}
}

// Start inicia a goroutine periódica executando fn a cada tick. Chamadas duplicadas enquanto ativo são ignoradas.
func (l *PeriodicLoop) Start(fn func()) bool {
	l.mu.Lock()
	if l.running {
		l.mu.Unlock()
		return false
	}
	l.running = true
	stopCh := make(chan struct{})
	l.stopCh = stopCh
	interval := l.interval
	runNow := l.runImmediately
	l.mu.Unlock()

	l.wg.Add(1)
	go func() {
		defer l.wg.Done()
		if runNow {
			fn()
		}
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-stopCh:
				return
			case <-ticker.C:
				fn()
			}
		}
	}()
	return true
}

// Stop sinaliza o encerramento do ticker e aguarda a conclusão limpa da goroutine. Idempotente.
func (l *PeriodicLoop) Stop() {
	l.mu.Lock()
	if !l.running {
		l.mu.Unlock()
		return
	}
	l.running = false
	stopCh := l.stopCh
	l.stopCh = nil
	l.mu.Unlock()

	if stopCh != nil {
		close(stopCh)
	}
	l.wg.Wait()
}

// IsRunning indica se o worker está em execução.
func (l *PeriodicLoop) IsRunning() bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return l.running
}
