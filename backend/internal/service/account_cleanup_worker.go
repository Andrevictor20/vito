package service

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/platform/worker"
)

// WhatsAppContextPruner remove mensagens antigas do shadow inbox do WhatsApp.
type WhatsAppContextPruner interface {
	PruneOlderThan(ctx context.Context, cutoff time.Time) (int64, error)
}

// AccountCleanupWorker executa periodicamente a limpeza de contas placeholder órfãs.
type AccountCleanupWorker struct {
	cleanupSvc    *AccountCleanupService
	contextSvc    WhatsAppContextPruner
	retentionDays int
	checkInterval time.Duration
	loop          *worker.PeriodicLoop
	mu            sync.Mutex
}

// NewAccountCleanupWorker instancia o worker de limpeza de contas órfãs.
func NewAccountCleanupWorker(cleanupSvc *AccountCleanupService, checkInterval ...time.Duration) *AccountCleanupWorker {
	interval := 15 * time.Minute
	if len(checkInterval) > 0 && checkInterval[0] > 0 {
		interval = checkInterval[0]
	}
	return &AccountCleanupWorker{
		cleanupSvc:    cleanupSvc,
		checkInterval: interval,
		loop:          worker.NewPeriodicLoop(interval, true),
	}
}

// SetContextService injeta o serviço de contexto do WhatsApp para podar o shadow inbox.
// Reutiliza o mesmo ticker de 15 min, sem criar uma goroutine nova.
func (w *AccountCleanupWorker) SetContextService(contextSvc WhatsAppContextPruner, retentionDays int) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.contextSvc = contextSvc
	if retentionDays > 0 {
		w.retentionDays = retentionDays
	}
}

// Start sobe o worker. A primeira limpeza roda logo no boot para limpar sobras de deploys.
func (w *AccountCleanupWorker) Start() {
	w.loop.Start(w.runOnce)
}

// Stop encerra o worker.
func (w *AccountCleanupWorker) Stop() {
	w.loop.Stop()
}

func (w *AccountCleanupWorker) runOnce() {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	if w.cleanupSvc != nil {
		purged, err := w.cleanupSvc.PurgeOrphanPlaceholderAccounts(ctx)
		if err != nil {
			log.Printf("[account-cleanup-worker] erro na limpeza: %v", err)
		} else if purged > 0 {
			log.Printf("[account-cleanup-worker] %d conta(s) placeholder órfã(s) removida(s)", purged)
		}
	}

	w.pruneWhatsAppContext(ctx)
}

// pruneWhatsAppContext remove as mensagens do shadow inbox fora da retenção configurada.
func (w *AccountCleanupWorker) pruneWhatsAppContext(ctx context.Context) {
	w.mu.Lock()
	contextSvc := w.contextSvc
	retentionDays := w.retentionDays
	w.mu.Unlock()

	if contextSvc == nil {
		return
	}
	if retentionDays <= 0 {
		retentionDays = 30
	}
	cutoff := time.Now().UTC().AddDate(0, 0, -retentionDays)
	removed, err := contextSvc.PruneOlderThan(ctx, cutoff)
	if err != nil {
		log.Printf("[account-cleanup-worker] erro ao podar contexto do WhatsApp: %v", err)
		return
	}
	if removed > 0 {
		log.Printf("[account-cleanup-worker] %d mensagem(s) antiga(s) do contexto do WhatsApp removida(s)", removed)
	}
}
