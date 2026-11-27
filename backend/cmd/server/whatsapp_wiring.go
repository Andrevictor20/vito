package main

import (
	"context"
	"database/sql"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/voice"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/platform/config"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"github.com/andrevmp/vito/backend/internal/whatsapp/evolution"
)

// whatsappWiring concentra as peças do assistente de WhatsApp para manter o
// main.go legível (e abaixo do teto de 500 linhas).
type whatsappWiring struct {
	ContextSvc     *whatsapp.WhatsAppContextService
	Directory      *whatsapp.WhatsAppDirectoryService
	ContactsCache  *whatsapp.WhatsAppContactsCache
	ContactRepo    domain.SyncedContactRepository
	OwnerCache     *whatsapp.WhatsAppOwnerCache
	GroupMeta      *whatsapp.WhatsAppGroupMeta
	BackfillWorker *whatsapp.WhatsAppBackfillWorker
	MediaEnricher  *whatsapp.WhatsAppMediaEnricher
	MediaWorker    *whatsapp.WhatsAppMediaWorker
}

// setupWhatsAppAssistant monta o assistente de WhatsApp (contexto, diretório de
// contatos, cache de nomes, owner JID, detecção de pendências, backfill e
// enriquecimento de mídia).
func setupWhatsAppAssistant(
	cfg *config.Config,
	db *sql.DB,
	waRepo domain.WhatsAppRepository,
	evoClient evolution.EvolutionAPIClient,
	waSvc *whatsapp.WhatsAppService,
	notifSvc *service.NotificationService,
	accountCleanupWorker *service.AccountCleanupWorker,
	visionProvider ai.ImageDescriber,
	audioTranscriber voice.AudioTranscriber,
) *whatsappWiring {
	waConvRepo := whatsapp.NewWhatsAppConversationRepository(db)

	waContextCfg := whatsapp.DefaultWhatsAppContextConfig()
	if cfg.WhatsAppContextScope != "" {
		waContextCfg.ScopeDefault = cfg.WhatsAppContextScope
	}
	if cfg.WhatsAppContextWindowSize > 0 {
		waContextCfg.WindowDefault = cfg.WhatsAppContextWindowSize
	}
	if cfg.WhatsAppContextMaxAgeDays > 0 {
		// A janela precisa cobrir o mesmo período que o backfill importa.
		waContextCfg.MaxAge = time.Duration(cfg.WhatsAppContextMaxAgeDays) * 24 * time.Hour
	}

	contextSvc := whatsapp.NewWhatsAppContextService(waConvRepo, waContextCfg)
	groupMeta := whatsapp.NewWhatsAppGroupMeta(evoClient, time.Hour, 24*time.Hour)
	ownerCache := whatsapp.NewWhatsAppOwnerCache(evoClient, time.Hour)
	contactRepo := whatsapp.NewContactRepository(db)
	contactsCache := whatsapp.NewWhatsAppContactsCache(evoClient, time.Hour)
	if allContacts, err := contactRepo.ListAll(context.Background()); err == nil && len(allContacts) > 0 {
		contactsCache.HydrateFromContacts(allContacts)
	}
	directory := whatsapp.NewWhatsAppDirectoryService(waConvRepo, waContextCfg, contactsCache)
	directory.SetContactRepository(contactRepo)

	waSvc.SetContextService(contextSvc)
	waSvc.SetGroupMeta(groupMeta)
	waSvc.SetOwnerCache(ownerCache)
	waSvc.SetContactsCache(contactsCache)
	waSvc.SetContextDebugLog(cfg.WhatsAppContextDebugLog)

	accountCleanupWorker.SetContextService(contextSvc, cfg.WhatsAppContextRetentionDays)

	// Garante que instâncias já pareadas usem a URL de webhook interna do Docker.
	go waSvc.SyncConnectedWebhooks(context.Background())

	wiring := &whatsappWiring{
		ContextSvc:    contextSvc,
		Directory:     directory,
		ContactsCache: contactsCache,
		ContactRepo:   contactRepo,
		OwnerCache:    ownerCache,
		GroupMeta:     groupMeta,
	}

	// Backfill do contexto do WhatsApp: importa o histórico recente da Evolution API.
	// Roda em background (nunca no caminho quente) e é idempotente.
	if cfg.WhatsAppBackfillEnabled {
		backfillCfg := whatsapp.DefaultWhatsAppBackfillConfig()
		if cfg.WhatsAppBackfillLookbackDays > 0 {
			backfillCfg.LookbackDay = cfg.WhatsAppBackfillLookbackDays
		}
		if cfg.WhatsAppBackfillMaxMessages > 0 {
			backfillCfg.MaxMessages = cfg.WhatsAppBackfillMaxMessages
		}
		backfill := whatsapp.NewWhatsAppBackfillService(evoClient, contextSvc, groupMeta, ownerCache, contactsCache, waRepo, backfillCfg)
		backfillWorker := whatsapp.NewWhatsAppBackfillWorker(backfill, groupMeta, 6*time.Hour)
		backfillWorker.Start()
		wiring.BackfillWorker = backfillWorker
	}

	// Enriquecimento de mídia (áudio/imagem do histórico): é o que faz o Vito
	// "ler" mensagens que já passaram. O provider de visão é o OpenRouter (cota
	// separada) — o Gemini free tier fica reservado ao chat.
	if cfg.WhatsAppMediaEnrichEnabled {
		enricherCfg := whatsapp.DefaultWhatsAppMediaEnricherConfig()
		if cfg.WhatsAppMediaMaxAgeDays > 0 {
			enricherCfg.MaxAge = time.Duration(cfg.WhatsAppMediaMaxAgeDays) * 24 * time.Hour
		}
		enricher := whatsapp.NewWhatsAppMediaEnricher(evoClient, contextSvc, audioTranscriber, visionProvider, enricherCfg)
		waSvc.SetMediaEnricher(enricher)
		wiring.MediaEnricher = enricher

		mediaWorker := whatsapp.NewWhatsAppMediaWorker(enricher, waRepo, cfg.WhatsAppMediaEnrichPerCycle, time.Duration(cfg.WhatsAppMediaEnrichIntervalMin)*time.Minute)
		mediaWorker.Start()
		wiring.MediaWorker = mediaWorker
	}

	return wiring
}
