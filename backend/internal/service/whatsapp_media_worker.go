package service

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// WhatsAppMediaWorker enriquece em background a mídia do histórico (áudio/imagem).
//
// Regras (custo é o gargalo — a visão consome cota do provedor):
//   - teto por ciclo (padrão: 3 mídias): nunca mais que isso a cada intervalo;
//   - só dentro da retenção do contexto;
//   - mais antiga primeiro: a mídia que está há mais tempo invisível é a que
//     o usuário mais precisa.
type WhatsAppMediaWorker struct {
	enricher   *WhatsAppMediaEnricher
	waRepo     domain.WhatsAppRepository
	perCycle   int
	interval   time.Duration
	stopCh     chan struct{}
	wg         sync.WaitGroup
	running    bool
	mu         sync.Mutex
	instanceFn func() []string
}

// NewWhatsAppMediaWorker cria o worker de enriquecimento de mídia.
func NewWhatsAppMediaWorker(
	enricher *WhatsAppMediaEnricher,
	waRepo domain.WhatsAppRepository,
	perCycle int,
	interval time.Duration,
) *WhatsAppMediaWorker {
	if perCycle <= 0 {
		perCycle = 3
	}
	if interval <= 0 {
		interval = 15 * time.Minute
	}
	return &WhatsAppMediaWorker{
		enricher: enricher,
		waRepo:   waRepo,
		perCycle: perCycle,
		interval: interval,
		stopCh:   make(chan struct{}),
	}
}

// Start sobe o worker. A primeira varredura roda logo no boot.
func (w *WhatsAppMediaWorker) Start() {
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
func (w *WhatsAppMediaWorker) Stop() {
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

// runOnce enriquece o backlog de mídia de cada integração conectada.
func (w *WhatsAppMediaWorker) runOnce() {
	if w.enricher == nil || w.waRepo == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	integrations, err := w.waRepo.ListAll(ctx)
	if err != nil {
		log.Printf("⚠️ [WhatsAppMedia] falha ao listar integrações: %v", err)
		return
	}
	for _, integration := range integrations {
		if integration.Status != domain.WhatsAppStatusConnected {
			continue
		}
		enriched, err := w.enricher.EnrichPending(ctx, integration.UserID, w.perCycle)
		if err != nil {
			log.Printf("⚠️ [WhatsAppMedia] falha ao enriquecer a instância %s: %v", integration.InstanceName, err)
			continue
		}
		if enriched > 0 {
			log.Printf("🖼️ [WhatsAppMedia] %d mídia(s) analisada(s) para %s", enriched, integration.InstanceName)
		}
	}
}
