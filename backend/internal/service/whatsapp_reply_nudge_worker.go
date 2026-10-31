package service

import (
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppReplyNudgeWorker foi desativado para não emitir notificações
// automáticas de cobrança sobre contatos ainda não respondidos no WhatsApp.
type WhatsAppReplyNudgeWorker struct {
	directory     *WhatsAppDirectoryService
	waRepo        domain.WhatsAppRepository
	notifSvc      NotificationSender
	threshold     time.Duration
	cooldown      time.Duration
	checkInterval time.Duration
}

// NewWhatsAppReplyNudgeWorker cria o worker (no-op).
func NewWhatsAppReplyNudgeWorker(
	directory *WhatsAppDirectoryService,
	waRepo domain.WhatsAppRepository,
	notifSvc NotificationSender,
	threshold time.Duration,
	cooldown time.Duration,
	checkInterval ...time.Duration,
) *WhatsAppReplyNudgeWorker {
	if threshold <= 0 {
		threshold = 24 * time.Hour
	}
	if cooldown <= 0 {
		cooldown = 24 * time.Hour
	}
	interval := 15 * time.Minute
	if len(checkInterval) > 0 && checkInterval[0] > 0 {
		interval = checkInterval[0]
	}
	return &WhatsAppReplyNudgeWorker{
		directory:     directory,
		waRepo:        waRepo,
		notifSvc:      notifSvc,
		threshold:     threshold,
		cooldown:      cooldown,
		checkInterval: interval,
	}
}

// Start é no-op: notificações de contatos sem resposta no WhatsApp foram desativadas.
func (w *WhatsAppReplyNudgeWorker) Start() {}

// Stop encerra o worker.
func (w *WhatsAppReplyNudgeWorker) Stop() {}

// RunOnce é no-op: notificações automáticas de pendências de resposta do WhatsApp foram removidas.
func (w *WhatsAppReplyNudgeWorker) RunOnce() {}
