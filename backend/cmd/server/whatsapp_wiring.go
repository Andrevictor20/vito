package main

import (
	"context"
	"database/sql"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/config"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

// whatsappWiring concentra as peças do assistente de WhatsApp para manter o
// main.go legível (e abaixo do teto de 500 linhas).
type whatsappWiring struct {
	ContextSvc     *service.WhatsAppContextService
	Directory      *service.WhatsAppDirectoryService
	ContactsCache  *service.WhatsAppContactsCache
	ContactRepo    domain.SyncedContactRepository
	OwnerCache     *service.WhatsAppOwnerCache
	GroupMeta      *service.WhatsAppGroupMeta
	NudgeWorker    *service.WhatsAppReplyNudgeWorker
	BackfillWorker *service.WhatsAppBackfillWorker
	MediaEnricher  *service.WhatsAppMediaEnricher
	MediaWorker    *service.WhatsAppMediaWorker
}

// setupWhatsAppAssistant monta o assistente de WhatsApp (contexto, diretório de
// contatos, cache de nomes, owner JID, Radar de pendências, backfill e
// enriquecimento de mídia).
func setupWhatsAppAssistant(
	cfg *config.Config,
	db *sql.DB,
	waRepo domain.WhatsAppRepository,
	evoClient service.EvolutionAPIClient,
	waSvc *service.WhatsAppService,
	astSvc *service.AssistantService,
	notifSvc *service.NotificationService,
	accountCleanupWorker *service.AccountCleanupWorker,
	visionProvider ai.ImageDescriber,
	audioTranscriber ai.AudioTranscriber,
) *whatsappWiring {
	waConvRepo := repository.NewWhatsAppConversationRepository(db)

	waContextCfg := service.DefaultWhatsAppContextConfig()
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

	contextSvc := service.NewWhatsAppContextService(waConvRepo, waContextCfg)
	groupMeta := service.NewWhatsAppGroupMeta(evoClient, time.Hour, 24*time.Hour)
	ownerCache := service.NewWhatsAppOwnerCache(evoClient, time.Hour)
	contactRepo := repository.NewContactRepository(db)
	contactsCache := service.NewWhatsAppContactsCache(evoClient, time.Hour)
	if allContacts, err := contactRepo.ListAll(context.Background()); err == nil && len(allContacts) > 0 {
		contactsCache.HydrateFromContacts(allContacts)
	}
	directory := service.NewWhatsAppDirectoryService(waConvRepo, waContextCfg, contactsCache)
	directory.SetContactRepository(contactRepo)

	waSvc.SetContextService(contextSvc)
	waSvc.SetGroupMeta(groupMeta)
	waSvc.SetOwnerCache(ownerCache)
	waSvc.SetContactsCache(contactsCache)
	waSvc.SetContextDebugLog(cfg.WhatsAppContextDebugLog)

	// O assistente (app, desktop e chat "Você") passa a ter o diretório de
	// contatos e as pendências de resposta do WhatsApp.
	astSvc.SetWhatsAppDirectory(directory)
	astSvc.SetWhatsAppSender(waSvc)

	accountCleanupWorker.SetContextService(contextSvc, cfg.WhatsAppContextRetentionDays)

	// Radar: cobra as conversas do WhatsApp que ficaram sem resposta (24h+).
	nudgeWorker := service.NewWhatsAppReplyNudgeWorker(directory, waRepo, notifSvc, 24*time.Hour, 24*time.Hour, 15*time.Minute)

	wiring := &whatsappWiring{
		ContextSvc:    contextSvc,
		Directory:     directory,
		ContactsCache: contactsCache,
		ContactRepo:   contactRepo,
		OwnerCache:    ownerCache,
		GroupMeta:     groupMeta,
		NudgeWorker:   nudgeWorker,
	}

	// Backfill do contexto do WhatsApp: importa o histórico recente da Evolution API.
	// Roda em background (nunca no caminho quente) e é idempotente.
	if cfg.WhatsAppBackfillEnabled {
		backfillCfg := service.DefaultWhatsAppBackfillConfig()
		if cfg.WhatsAppBackfillLookbackDays > 0 {
			backfillCfg.LookbackDay = cfg.WhatsAppBackfillLookbackDays
		}
		if cfg.WhatsAppBackfillMaxMessages > 0 {
			backfillCfg.MaxMessages = cfg.WhatsAppBackfillMaxMessages
		}
		backfill := service.NewWhatsAppBackfillService(evoClient, contextSvc, groupMeta, ownerCache, contactsCache, waRepo, backfillCfg)
		backfillWorker := service.NewWhatsAppBackfillWorker(backfill, groupMeta, 6*time.Hour)
		backfillWorker.Start()
		wiring.BackfillWorker = backfillWorker
	}

	// Enriquecimento de mídia (áudio/imagem do histórico): é o que faz o Vito
	// "ler" mensagens que já passaram. O provider de visão é o OpenRouter (cota
	// separada) — o Gemini free tier fica reservado ao chat.
	if cfg.WhatsAppMediaEnrichEnabled {
		enricherCfg := service.DefaultWhatsAppMediaEnricherConfig()
		if cfg.WhatsAppMediaMaxAgeDays > 0 {
			enricherCfg.MaxAge = time.Duration(cfg.WhatsAppMediaMaxAgeDays) * 24 * time.Hour
		}
		enricher := service.NewWhatsAppMediaEnricher(evoClient, contextSvc, audioTranscriber, visionProvider, enricherCfg)
		waSvc.SetMediaEnricher(enricher)
		wiring.MediaEnricher = enricher

		mediaWorker := service.NewWhatsAppMediaWorker(enricher, waRepo, cfg.WhatsAppMediaEnrichPerCycle, time.Duration(cfg.WhatsAppMediaEnrichIntervalMin)*time.Minute)
		mediaWorker.Start()
		wiring.MediaWorker = mediaWorker
	}

	return wiring
}
