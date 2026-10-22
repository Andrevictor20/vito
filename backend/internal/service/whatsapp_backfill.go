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
	client        EvolutionAPIClient
	contextSvc    *WhatsAppContextService
	groupMeta     *WhatsAppGroupMeta
	ownerCache    *WhatsAppOwnerCache
	contactsCache *WhatsAppContactsCache
	waRepo        domain.WhatsAppRepository
	cfg           WhatsAppBackfillConfig
}

// NewWhatsAppBackfillService cria o serviço de backfill.
func NewWhatsAppBackfillService(
	client EvolutionAPIClient,
	contextSvc *WhatsAppContextService,
	groupMeta *WhatsAppGroupMeta,
	ownerCache *WhatsAppOwnerCache,
	contactsCache *WhatsAppContactsCache,
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
		client:        client,
		contextSvc:    contextSvc,
		groupMeta:     groupMeta,
		ownerCache:    ownerCache,
		contactsCache: contactsCache,
		waRepo:        waRepo,
		cfg:           cfg,
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
	var lastErr error
	for _, integration := range integrations {
		if integration.Status != domain.WhatsAppStatusConnected {
			continue
		}
		imported, err := s.runForInstance(ctx, integration)
		total += imported
		if err != nil {
			lastErr = err
			log.Printf("⚠️ [WhatsAppBackfill] falha ao importar a instância %s: %v", integration.InstanceName, err)
		}
	}
	// Se nada foi importado e houve erro, o erro precisa propagar: é o que faz o
	// worker do backoff tentar de novo (a Evolution API pode ainda estar subindo).
	if total == 0 && lastErr != nil {
		return total, lastErr
	}
	return total, nil
}

// runForInstance pagina as mensagens da Evolution API e importa as mais recentes.
func (s *WhatsAppBackfillService) runForInstance(ctx context.Context, integration domain.WhatsAppIntegration) (int, error) {
	from := time.Now().UTC().AddDate(0, 0, -s.cfg.LookbackDay)
	to := time.Now().UTC()

	// O JID do owner (número realmente pareado) habilita o reconhecimento do chat
	// "Você"; é resolvido aqui, em background, antes do primeiro webhook.
	if s.ownerCache != nil {
		if _, err := s.ownerCache.Fetch(ctx, integration.InstanceName); err != nil {
			log.Printf("⚠️ [WhatsAppBackfill] falha ao buscar o owner da instância %s: %v", integration.InstanceName, err)
		}
	}

	// Nomes dos contatos: os chats @lid chegam sem pushName e ficariam como
	// "Contato" no diretório (o Vito não conseguiria dizer "a Ana te espera").
	if s.contactsCache != nil {
		if _, err := s.contactsCache.Fetch(ctx, integration.InstanceName); err != nil {
			log.Printf("⚠️ [WhatsAppBackfill] falha ao buscar contatos: %v", err)
		}
	}

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

		log.Printf("[WhatsAppBackfill] instância %s página %d: %d registro(s) retornado(s) pela Evolution", integration.InstanceName, page, len(messages))
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

	// Reetiqueta o histórico com os nomes reais dos contatos.
	if s.contactsCache != nil && s.contextSvc != nil {
		if updated, err := s.contextSvc.Relabel(ctx, integration.UserID, s.contactsCache.Names()); err != nil {
			log.Printf("⚠️ [WhatsAppBackfill] falha ao reetiquetar conversas: %v", err)
		} else if updated > 0 {
			log.Printf("[WhatsAppBackfill] %d mensagem(ns) reetiquetada(s) com o nome do contato", updated)
		}
		// O nome de PERFIL (pushName) não vem do findContacts — ele vem das
		// mensagens. O histórico já arquivado é a fonte para completar o alias
		// ("isa" salvo + "bella" no perfil = a mesma pessoa para o Vito).
		if s.contextSvc != nil {
			if profiles, err := s.contextSvc.SenderNames(ctx, integration.UserID, from); err == nil && len(profiles) > 0 {
				s.contactsCache.SetProfiles(profiles)
				log.Printf("[WhatsAppBackfill] %d contato(s) com nome de perfil registrado", len(profiles))
			}
		}
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

	selfReference := integration.Phone
	if s.ownerCache != nil {
		if ownerJID, fresh := s.ownerCache.JID(integration.InstanceName); fresh {
			selfReference = ownerJID
		}
	}
	chatKind := ClassifyChat(m.RemoteJID, selfReference, participants, fresh)

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
		// Em conversa direta, o rótulo é o nome do contato. O nome SALVO pelo
		// dono tem prioridade sobre o nome de perfil (que é o que vem nas
		// mensagens) — é o nome pelo qual o usuário fala da pessoa.
		if known, ok := labels[m.RemoteJID]; ok {
			label = known
		} else if s.contactsCache != nil {
			if name := s.contactsCache.Name(m.RemoteJID); name != "" {
				label = name
				labels[m.RemoteJID] = name
			}
		} else if !m.FromMe && strings.TrimSpace(m.PushName) != "" {
			label = m.PushName
			labels[m.RemoteJID] = m.PushName
		}
		if label == "Contato" && !m.FromMe && strings.TrimSpace(m.PushName) != "" {
			label = m.PushName
			labels[m.RemoteJID] = m.PushName
		}
		// O pushName das mensagens é a fonte mais confiável do nome de perfil
		// (o findContacts às vezes o devolve vazio) — vira o alias do contato.
		if s.contactsCache != nil && !m.FromMe && strings.TrimSpace(m.PushName) != "" {
			s.contactsCache.SetProfile(m.RemoteJID, m.PushName)
		}
	}

	text := m.Text
	kind := "text"
	if IsVitoMessage(text) {
		clean, _ := StripVitoSignature(text)
		text = clean
		kind = messageKindVito
	}
	// A mídia do histórico precisa de duas coisas para ser lida depois: o tipo e
	// o envelope de download da Evolution (sem ele, a foto antiga é ilegível).
	mediaKind := m.MediaKind
	mediaStatus := domain.WhatsAppMediaStatusNone
	if mediaKind != "" && m.MediaPayload != "" {
		mediaStatus = domain.WhatsAppMediaStatusPending
		if mediaKind == domain.WhatsAppMediaKindImage {
			kind = "image"
		} else if mediaKind == domain.WhatsAppMediaKindAudio {
			kind = "audio"
		}
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
		QuotedID:         strings.TrimSpace(m.QuotedID),
		MediaKind:        mediaKind,
		MediaMime:        m.MediaMime,
		MediaStatus:      mediaStatus,
		MediaPayload:     m.MediaPayload,
		MessageTimestamp: timestamp,
		CreatedAt:        time.Now().UTC(),
	})
}

// WhatsAppBackfillWorker roda o backfill periodicamente em background.
type WhatsAppBackfillWorker struct {
	backfill     *WhatsAppBackfillService
	groupMeta    *WhatsAppGroupMeta
	interval     time.Duration
	initialDelay time.Duration
	stopCh       chan struct{}
	wg           sync.WaitGroup
	running      bool
	mu           sync.Mutex
}

// NewWhatsAppBackfillWorker cria o worker de backfill (intervalo padrão: 6 h).
func NewWhatsAppBackfillWorker(backfill *WhatsAppBackfillService, groupMeta *WhatsAppGroupMeta, interval ...time.Duration) *WhatsAppBackfillWorker {
	period := 6 * time.Hour
	if len(interval) > 0 && interval[0] > 0 {
		period = interval[0]
	}
	return &WhatsAppBackfillWorker{
		backfill:     backfill,
		groupMeta:    groupMeta,
		interval:     period,
		initialDelay: 45 * time.Second,
		stopCh:       make(chan struct{}),
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
		// A Evolution API (Prisma + Postgres) leva ~20s para ficar pronta no boot
		// do Pi; sem essa espera o primeiro backfill falha por DNS.
		select {
		case <-w.stopCh:
			return
		case <-time.After(w.initialDelay):
		}
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
	// A Evolution API (Prisma + Postgres) leva ~2 min para ficar pronta no boot
	// do Pi, e o backend sobe antes dela. Backoff paciente: 45s, 75s, 135s,
	// 255s e 435s após o boot.
	delays := []time.Duration{0, 30 * time.Second, 60 * time.Second, 120 * time.Second, 180 * time.Second}
	for attempt, delay := range delays {
		if delay > 0 {
			select {
			case <-w.stopCh:
				return
			case <-time.After(delay):
			}
		}

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		imported, err := w.backfill.Run(ctx)
		cancel()

		if err == nil {
			log.Printf("[WhatsAppBackfill] concluído: %d mensagem(ns) importada(s) para o contexto do WhatsApp", imported)
			return
		}
		log.Printf("⚠️ [WhatsAppBackfill] erro no backfill (tentativa %d/%d): %v", attempt+1, len(delays), err)
	}
}
