package service

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppBackfillConfig parametrização do backfill de contexto do WhatsApp.
type WhatsAppBackfillConfig struct {
	Enabled     bool
	PageSize    int
	MaxMessages int
	LookbackDay int
}

// DefaultWhatsAppBackfillConfig devolve a configuração padrão do backfill.
func DefaultWhatsAppBackfillConfig() WhatsAppBackfillConfig {
	return WhatsAppBackfillConfig{
		Enabled:     true,
		PageSize:    50,
		MaxMessages: 300,
		LookbackDay: 30,
	}
}

// WhatsAppBackfillService importa o histórico recente da Evolution API para o shadow inbox.
//
// O backfill roda FORA do caminho quente (nunca no webhook): a Evolution API e o
// PostgreSQL dividem a CPU/RAM do Raspberry Pi com o backend (SPEC §10.2 P5/P6).
// A importação é idempotente (upsert por id da mensagem), então pode rodar várias vezes.
type WhatsAppBackfillService struct {
	client     EvolutionAPIClient
	contextSvc *WhatsAppContextService
	groupMeta  *WhatsAppGroupMeta
	waRepo     domain.WhatsAppRepository
	cfg        WhatsAppBackfillConfig
}

// NewWhatsAppBackfillService cria o serviço de backfill.
func NewWhatsAppBackfillService(
	client EvolutionAPIClient,
	contextSvc *WhatsAppContextService,
	groupMeta *WhatsAppGroupMeta,
	waRepo domain.WhatsAppRepository,
	cfg WhatsAppBackfillConfig,
) *WhatsAppBackfillService {
	if cfg.PageSize <= 0 {
		cfg.PageSize = 50
	}
	if cfg.MaxMessages <= 0 {
		cfg.MaxMessages = 300
	}
	if cfg.LookbackDay <= 0 {
		cfg.LookbackDay = 30
	}
	return &WhatsAppBackfillService{
		client:     client,
		contextSvc: contextSvc,
		groupMeta:  groupMeta,
		waRepo:     waRepo,
		cfg:        cfg,
	}
}

// Run importa o histórico de todas as integrações conectadas.
func (s *WhatsAppBackfillService) Run(ctx context.Context) (int, error) {
	if !s.cfg.Enabled || s.client == nil || s.contextSvc == nil || s.waRepo == nil {
		return 0, nil
	}
	integrations, err := s.waRepo.ListAll(ctx)
	if err != nil {
		return 0, err
	}

	total := 0
	for _, integration := range integrations {
		if integration.Status != domain.WhatsAppStatusConnected {
			continue
		}
		imported, err := s.runForInstance(ctx, integration)
		total += imported
		if err != nil {
			log.Printf("⚠️ [WhatsAppBackfill] falha ao importar a instância %s: %v", integration.InstanceName, err)
		}
	}
	return total, nil
}

// runForInstance pagina as mensagens da Evolution API e importa as mais recentes.
func (s *WhatsAppBackfillService) runForInstance(ctx context.Context, integration domain.WhatsAppIntegration) (int, error) {
	from := time.Now().UTC().AddDate(0, 0, -s.cfg.LookbackDay)
	to := time.Now().UTC()

	labels := make(map[string]string)
	imported := 0
	page := 1

	for page*s.cfg.PageSize <= s.cfg.MaxMessages {
		messages, err := s.client.FindMessages(ctx, EvolutionFindMessagesInput{
			InstanceName: integration.InstanceName,
			From:         from,
			To:           to,
			Page:         page,
			Offset:       s.cfg.PageSize,
		})
		if err != nil {
			return imported, err
		}
		if len(messages) == 0 {
			break
		}

		for _, m := range messages {
			if err := s.importMessage(ctx, integration, m, labels); err != nil {
				log.Printf("⚠️ [WhatsAppBackfill] falha ao importar mensagem %s: %v", m.ID, err)
				continue
			}
			imported++
		}

		if len(messages) < s.cfg.PageSize {
			break
		}
		page++
	}
	return imported, nil
}

// importMessage arquiva uma mensagem do backfill classificando o chat de origem.
func (s *WhatsAppBackfillService) importMessage(ctx context.Context, integration domain.WhatsAppIntegration, m WhatsAppChatMessage, labels map[string]string) error {
	if m.ID == "" || m.RemoteJID == "" {
		return nil
	}

	participants, fresh := 0, false
	if strings.HasSuffix(m.RemoteJID, "@g.us") && s.groupMeta != nil {
		participants, fresh = s.groupMeta.ParticipantsCount(m.RemoteJID)
		if !fresh {
			// Uma chamada por grupo: define se o grupo é "só meu" (self_group).
			if list, err := s.client.FindParticipants(ctx, integration.InstanceName, m.RemoteJID); err == nil {
				s.groupMeta.SetParticipants(m.RemoteJID, len(list))
				participants, fresh = len(list), true
			}
		}
	}

	chatKind := ClassifyChat(m.RemoteJID, integration.Phone, participants, fresh)

	label := "Contato"
	switch chatKind {
	case domain.WhatsAppChatKindSelf:
		label = "Você"
	case domain.WhatsAppChatKindSelfGroup, domain.WhatsAppChatKindGroup:
		label = "Grupo"
		if s.groupMeta != nil {
			if subject := s.groupMeta.Subject(m.RemoteJID); subject != "" {
				label = subject
			}
		}
	default:
		// Em conversa direta, o rótulo é o nome do contato (primeira mensagem recebida).
		if known, ok := labels[m.RemoteJID]; ok {
			label = known
		} else if !m.FromMe && strings.TrimSpace(m.PushName) != "" {
			label = m.PushName
			labels[m.RemoteJID] = m.PushName
		}
	}

	text := m.Text
	kind := "text"
	if IsVitoMessage(text) {
		clean, _ := StripVitoSignature(text)
		text = clean
		kind = messageKindVito
	}

	timestamp := m.MessageTimestamp
	if timestamp.IsZero() {
		timestamp = time.Now().UTC()
	}

	return s.contextSvc.Archive(ctx, &domain.WhatsAppConversationMessage{
		ID:               m.ID,
		UserID:           integration.UserID,
		InstanceName:     integration.InstanceName,
		ChatJID:          m.RemoteJID,
		ChatKind:         chatKind,
		ChatLabel:        label,
		SenderJID:        firstNonEmpty(m.Participant, m.RemoteJID),
		SenderName:       m.PushName,
		FromMe:           m.FromMe,
		Kind:             kind,
		Text:             text,
		QuotedText:       strings.TrimSpace(m.QuotedText),
		MessageTimestamp: timestamp,
		CreatedAt:        time.Now().UTC(),
	})
}

// WhatsAppBackfillWorker roda o backfill periodicamente em background.
type WhatsAppBackfillWorker struct {
	backfill  *WhatsAppBackfillService
	groupMeta *WhatsAppGroupMeta
	interval  time.Duration
	stopCh    chan struct{}
	wg        sync.WaitGroup
	running   bool
	mu        sync.Mutex
}

// NewWhatsAppBackfillWorker cria o worker de backfill (intervalo padrão: 6 h).
func NewWhatsAppBackfillWorker(backfill *WhatsAppBackfillService, groupMeta *WhatsAppGroupMeta, interval ...time.Duration) *WhatsAppBackfillWorker {
	period := 6 * time.Hour
	if len(interval) > 0 && interval[0] > 0 {
		period = interval[0]
	}
	return &WhatsAppBackfillWorker{
		backfill:  backfill,
		groupMeta: groupMeta,
		interval:  period,
		stopCh:    make(chan struct{}),
	}
}

// Start sobe o worker. A primeira execução roda logo no boot.
func (w *WhatsAppBackfillWorker) Start() {
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
		ticker := time.NewTicker(w.interval)
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
func (w *WhatsAppBackfillWorker) Stop() {
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

func (w *WhatsAppBackfillWorker) runOnce() {
	if w.backfill == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	imported, err := w.backfill.Run(ctx)
	if err != nil {
		log.Printf("⚠️ [WhatsAppBackfill] erro no backfill: %v", err)
		return
	}
	if imported > 0 {
		log.Printf("[WhatsAppBackfill] %d mensagem(ns) importada(s) para o contexto do WhatsApp", imported)
	}
}
