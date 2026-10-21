package service

import (
	"context"
	"fmt"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppReplyNudgeWorker é o "Radar" do Vito: cobra as conversas que ficaram
// sem resposta.
//
// Regras:
//   - só conversas DIRETAS (é onde a pendência de resposta é real);
//   - só cobra depois de 24h sem resposta (configurável);
//   - no máximo uma cobrança por conversa a cada 24h (last_nudged_at);
//   - "me lembra amanhã" adia a cobrança (snoozed_until);
//   - a cobrança é um PUSH para o usuário — nunca uma mensagem no chat do contato.
type WhatsAppReplyNudgeWorker struct {
	directory     *WhatsAppDirectoryService
	waRepo        domain.WhatsAppRepository
	notifSvc      *NotificationService
	threshold     time.Duration
	cooldown      time.Duration
	checkInterval time.Duration
	stopCh        chan struct{}
	wg            sync.WaitGroup
	running       bool
	mu            sync.Mutex
}

// NewWhatsAppReplyNudgeWorker cria o worker do Radar.
func NewWhatsAppReplyNudgeWorker(
	directory *WhatsAppDirectoryService,
	waRepo domain.WhatsAppRepository,
	notifSvc *NotificationService,
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
		stopCh:        make(chan struct{}),
	}
}

// Start sobe o worker. A primeira varredura roda logo no boot.
func (w *WhatsAppReplyNudgeWorker) Start() {
	w.mu.Lock()
	if w.running {
		w.mu.Unlock()
		return
	}
	w.running = true
	w.mu.Unlock()

	w.wg.Add(1)
	go func() {
		defer w.wg.Done()
		w.runOnce()
		ticker := time.NewTicker(w.checkInterval)
		defer ticker.Stop()
		for {
			select {
			case <-w.stopCh:
				return
			case <-ticker.C:
				w.runOnce()
			}
		}
	}()
}

// Stop encerra o worker.
func (w *WhatsAppReplyNudgeWorker) Stop() {
	w.mu.Lock()
	if !w.running {
		w.mu.Unlock()
		return
	}
	w.running = false
	w.mu.Unlock()
	close(w.stopCh)
	w.wg.Wait()
}

// runOnce varre as pendências de todos os usuários conectados e cobra as frias.
func (w *WhatsAppReplyNudgeWorker) runOnce() {
	if w.directory == nil || w.waRepo == nil || w.notifSvc == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()

	integrations, err := w.waRepo.ListAll(ctx)
	if err != nil {
		log.Printf("⚠️ [WhatsAppReplyNudgeWorker] falha ao listar integrações: %v", err)
		return
	}

	now := time.Now().UTC()
	for _, integration := range integrations {
		if integration.Status != domain.WhatsAppStatusConnected {
			continue
		}
		pending, err := w.directory.Pending(ctx, integration.UserID)
		if err != nil {
			log.Printf("⚠️ [WhatsAppReplyNudgeWorker] falha ao listar pendências (user=%s): %v", integration.UserID, err)
			continue
		}
		for i := range pending {
			w.nudgeIfDue(ctx, integration.UserID, &pending[i], now)
		}
	}
}

// nudgeIfDue cobra (push) uma pendência que passou do limite.
func (w *WhatsAppReplyNudgeWorker) nudgeIfDue(ctx context.Context, userID string, chat *domain.WhatsAppChatSummary, now time.Time) {
	if now.Sub(chat.LastAt) < w.threshold {
		return
	}

	state, err := w.directory.PendingState(ctx, userID, chat.ChatJID)
	if err != nil {
		log.Printf("⚠️ [WhatsAppReplyNudgeWorker] falha ao ler estado da pendência (user=%s): %v", userID, err)
		return
	}
	if state == nil {
		state = &domain.WhatsAppPendingState{UserID: userID, ChatJID: chat.ChatJID}
	}
	if state.DismissedAt != nil {
		return
	}
	if state.SnoozedUntil != nil && state.SnoozedUntil.After(now) {
		return
	}
	if state.LastNudgedAt != nil && now.Sub(*state.LastNudgedAt) < w.cooldown {
		return
	}

	label := w.directory.LabelOf(chat)
	preview := TruncateContextText(chat.LastText, 120)
	body := fmt.Sprintf("%s te espera desde %s: %q", label, humanizeChatAge(chat.LastAt), preview)
	if _, err := w.notifSvc.SendPushToUser(userID, "💬 Responder "+label, body, "default", map[string]interface{}{
		"type":    "whatsapp_pending_reply",
		"chatJid": chat.ChatJID,
		"chat":    label,
	}); err != nil {
		log.Printf("⚠️ [WhatsAppReplyNudgeWorker] falha ao enviar nudge (user=%s): %v", userID, err)
		return
	}

	state.LastNudgedAt = &now
	state.UpdatedAt = now
	if err := w.directory.SavePendingState(ctx, state); err != nil {
		log.Printf("⚠️ [WhatsAppReplyNudgeWorker] falha ao salvar estado do nudge (user=%s): %v", userID, err)
		return
	}
	log.Printf("[WhatsAppReplyNudgeWorker] cobrança enviada: user=%s chat=%s (%s)", userID, label, strings.TrimSpace(humanizeChatAge(chat.LastAt)))
}
