package main

import (
	"github.com/andrevmp/vito/backend/internal/gmail"
	"github.com/andrevmp/vito/backend/internal/calendar/p2p"
	"context"
	"errors"
	"github.com/andrevmp/vito/backend/internal/ai/search"
	"github.com/andrevmp/vito/backend/internal/ai/voice"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/finance"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/platform/config"
	"github.com/andrevmp/vito/backend/internal/platform/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	intcal "github.com/andrevmp/vito/backend/internal/integrations/calendar"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/google/uuid"
)

func main() {
	applyMemoryLimit()
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("❌ Falha crítica de segurança na configuração: %v", err)
	}

	// 1. Conexão ao SQLite com WAL mode, Single-Writer Queue e Migrações
	log.Printf("📦 [Vito DB] Inicializando banco SQLite em '%s'...", cfg.DBPath)

	// Auto-cura: banco corrompido é restaurado do último snapshot ANTES de abrir.
	bootstrapDatabaseIntegrity(cfg)

	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("❌ Falha crítica ao inicializar banco de dados: %v", err)
	}
	defer db.Close()

	writerQueue := database.NewSingleWriterQueue(256)
	defer writerQueue.Close()
	database.SetDefaultWriterQueue(writerQueue)

	var bkpMgr *database.BackupManager
	if cfg.DBPath != ":memory:" && len(cfg.DataEncryptionKey) >= 16 {
		backupDir := os.Getenv("BACKUP_DIR")
		if backupDir == "" {
			backupDir = "/app/data/backups"
			if cfg.Environment != "production" {
				backupDir = "./backups"
			}
		}
		var bkpErr error
		bkpMgr, bkpErr = database.NewBackupManager(database.BackupConfig{
			DB:         db,
			BackupDir:  backupDir,
			MasterKey:  cfg.DataEncryptionKey,
			MaxBackups: 7,
			Interval:   6 * time.Hour,
		})
		if bkpErr == nil {
			bkpMgr.Start()
			defer bkpMgr.Stop()
			log.Printf("🔒 [BackupWorker] Rotina de backup criptografado AES-256-GCM ativa (%s).", backupDir)
		} else {
			log.Printf("⚠️ [BackupWorker] backup desativado: %v", bkpErr)
		}
	}
	log.Println("✅ [Vito DB] Banco SQLite e migrações aplicadas com sucesso.")

	// 2. Repositórios
	userRepo := repository.NewUserRepository(db)
	eventRepo := calendar.NewEventRepository(db)
	todoRepo := tasks.NewTodoRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)
	notifRepo := repository.NewDeviceTokenRepository(db)
	triggerRepo := bots.NewTriggerRepository(db)
	briefingRepo := repository.NewBriefingRepository(db)
	aiSettingsRepo := repository.NewAISettingsRepository(db)
	pendingRepo := tasks.NewPendingRepository(db)
	bookingRepo := calendar.NewBookingRepositorySQLite(db)
	meetingRepo := calendar.NewMeetingRepositorySQLite(db)
	p2pRepo := p2p.NewP2PInviteRepositorySQLite(db)
	chatRepo := repository.NewChatRepository(db)

	// 3. Provedores de IA & AI Gateway com Failover.
	// Ordem: Gemini 2.5 Flash primário (forte em resolução de referência e
	// diretivas de contexto), Groq/Mistral como fallback de cota e OpenRouter por
	// último. O modelo pequeno do Groq (gpt-oss-20b) ignorava o bloco de
	// 4. Serviços
	sessionRepo := repository.NewSessionRepository(db)
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	authSvc.SetSessionRepository(sessionRepo)
	calSvc := calendar.NewCalendarService(eventRepo)
	todoSvc := tasks.NewTodoService(todoRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	triggerSvc := bots.NewTriggerService(triggerRepo)
	pendingSvc := tasks.NewPendingService(pendingRepo)
	// Ciclo 2 §8.4: correção manual rápida vira learned_preference (opt-out via VITO_DISABLE_IMPLICIT_FEEDBACK=1).
	if os.Getenv("VITO_DISABLE_IMPLICIT_FEEDBACK") == "1" {
		service.ImplicitFeedbackDisabled = true
	}
	service.ImplicitFeedbackHook = func(userID, insight string) {
		_ = memoryRepo.Create(&domain.Memory{
			ID:         uuid.New().String(),
			UserID:     userID,
			Category:   "learned_preference",
			Content:    insight,
			Importance: 4,
			Confidence: 0.85,
			CreatedAt:  time.Now().UTC(),
			UpdatedAt:  time.Now().UTC(),
		})
	}

	syncRepo := calendar.NewCalendarSyncRepository(db)
	syncSvc := calendar.NewCalendarSyncService(syncRepo, eventRepo, cfg.DataEncryptionKey)
	googleCalCfg := intcal.GoogleConfig{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURI:  cfg.GoogleRedirectURL,
	}
	syncSvc.RegisterProvider(intcal.NewGoogleProvider(googleCalCfg))
	syncSvc.RegisterProvider(intcal.NewAppleCalDAVProvider(intcal.AppleCalDAVConfig{}))
	calSvc.SetSyncPusher(syncSvc)

	// Worker em segundo plano para lembretes de compromissos (iniciado após wiring cognitivo)
	reminderWorker := tasks.NewReminderWorker(eventRepo, notifSvc, 15*time.Minute)

	// Worker em segundo plano para vigília autônoma de bots/disparadores (motor ADK v2 conectado via BotRunner)
	triggerWorker := bots.NewTriggerWorker(triggerRepo, notifSvc, &bots.DefaultTriggerEvaluator{}, 1*time.Minute)
	// Delta gate pré-IA (§9.3): hashes dos fatos atuais via conectores por categoria.
	triggerWorker.SetDeltaFetcher(func(fetchCtx context.Context, t *domain.Trigger) ([]string, []string, error) {
		items, err := search.RouteTriggerSource(t).Fetch(fetchCtx, t)
		if err != nil {
			return nil, nil, err
		}
		stored, err := triggerRepo.GetSeenHashes(t.ID)
		if err != nil {
			return nil, nil, err
		}
		seen := map[string]bool{}
		for _, h := range stored {
			seen[h] = true
		}
		var fresh, all []string
		for _, it := range items {
			h := search.HashDataPoint(it)
			all = append(all, h)
			if !seen[h] {
				fresh = append(fresh, h)
			}
		}
		return fresh, all, nil
	})
	// Fast-path determinístico de preço-alvo (Fase 1): primeiro valor numérico
	// da fonte da categoria (ex: bid AwesomeAPI); sem número, cai na IA.
	triggerWorker.SetPriceFetcher(func(fetchCtx context.Context, t *domain.Trigger) (float64, string, bool, error) {
		if t.ConditionType != domain.ConditionPriceAbove && t.ConditionType != domain.ConditionPriceBelow {
			return 0, "", false, nil
		}
		items, err := search.RouteTriggerSource(t).Fetch(fetchCtx, t)
		if err != nil {
			return 0, "", false, err
		}
		for _, it := range items {
			if v, ok := bots.ParseMoneyValue(it.Value); ok {
				return v, it.Value, true, nil
			}
		}
		return 0, "", false, nil
	})

	// Worker em segundo plano para briefing matinal proativo (ADK CrossDomainBriefingWorkflow conectado em wireCognitiveRuntime)
	morningBriefingWorker := service.NewMorningBriefingWorker(briefingRepo, eventRepo, todoRepo, userRepo, notifSvc, 1*time.Minute)

	// Worker em segundo plano para lembretes de pendências (nudge diário)
	pendingNudgeWorker := tasks.NewPendingNudgeWorker(pendingRepo, userRepo, notifSvc, 1*time.Minute)

	// Worker em segundo plano para lembretes de tarefas com prazo
	todoReminderWorker := tasks.NewTodoReminderWorker(todoRepo, notifSvc, 15*time.Minute)

	// Worker em segundo plano para limpeza de contas placeholder órfãs (@vito.local)
	// criadas por logins de WhatsApp — libera o número de telefone de terceiros.
	accountCleanupSvc := service.NewAccountCleanupService(userRepo, sessionRepo, eventRepo, todoRepo, memoryRepo)
	accountCleanupWorker := service.NewAccountCleanupWorker(accountCleanupSvc, 15*time.Minute)
	accountCleanupWorker.Start()
	defer accountCleanupWorker.Stop()

	// Worker em segundo plano para consolidação comportamental noturna (§8.4 ciclo 3)
	behavioralWorker := service.NewBehavioralWorker(todoRepo, eventRepo, memoryRepo)

	// Worker em segundo plano para resumos executivos (diário, semanal e mensal)
	executiveSummaryWorker := calendar.NewExecutiveSummaryWorker(db, userRepo, notifSvc, 1*time.Minute)

	googleAuthCfg := service.GoogleAuthConfig{
		ClientID:       cfg.GoogleClientID,
		ClientSecret:   cfg.GoogleClientSecret,
		RedirectURL:    cfg.GoogleRedirectURL,
		JWTSecret:      cfg.JWTSecret,
		AllowedOrigins: cfg.AllowedOrigins(),
	}
	googleAuthSvc := service.NewGoogleAuthService(googleAuthCfg, userRepo, authSvc, syncSvc)

	// Transcritor de voz Whisper
	var whisperTranscriber voice.AudioTranscriber
	if cfg.GroqAPIKey != "" {
		whisperTranscriber = voice.NewGroqWhisper(cfg.GroqAPIKey)
		log.Println("🎙️ [Audio Whisper] Groq Whisper Large v3 ativado para transcrição de voz.")
	}

	// 5. Handlers HTTP
	authHandler := handler.NewAuthHandler(authSvc, userRepo)
	googleAuthHandler := handler.NewGoogleAuthHandler(googleAuthSvc, authSvc)
	calHandler := calendar.NewCalendarHandler(calSvc)
	todoHandler := tasks.NewTodoHandler(todoSvc)
	notifHandler := handler.NewNotificationHandler(notifSvc)
	syncHandler := calendar.NewCalendarSyncHandler(syncSvc)
	briefingHandler := handler.NewBriefingHandler(briefingRepo)
	aiSettingsHandler := handler.NewAISettingsHandler(aiSettingsRepo)
	pendingHandler := tasks.NewPendingHandler(pendingSvc)

	linkShortener := service.NewShortIoShortenerService(cfg.ShortIoAPIKey, cfg.ShortIoDomain, cfg.PublicBaseURL)
	turnstileValidator := service.NewTurnstileValidator(cfg.TurnstileSecretKey)
	bookingSvc := calendar.NewBookingService(bookingRepo, eventRepo, userRepo, notifSvc, linkShortener, turnstileValidator, cfg.PublicBaseURL)
	bookingSvc.SetSyncPusher(syncSvc)
	bookingHandler := calendar.NewBookingHandler(bookingSvc)

	emailSvc := service.NewEmailService(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPFrom)
	bookingSvc.SetEmailService(emailSvc)

	meetingSvc := calendar.NewMeetingService(meetingRepo, eventRepo, notifSvc, linkShortener, cfg.PublicBaseURL)
	meetingSvc.SetUserRepository(userRepo)
	meetingSvc.SetSyncPusher(syncSvc)
	meetingSvc.SetEmailService(emailSvc)
	meetingHandler := calendar.NewMeetingHandler(meetingSvc)

	waRepo := whatsapp.NewWhatsAppRepository(db)

	p2pSvc := p2p.NewP2PMeetingService(p2pRepo, userRepo, calSvc, notifSvc)
	p2pHandler := p2p.NewP2PMeetingHandler(p2pSvc, userRepo, waRepo)

	chatSvc := service.NewChatService(chatRepo)
	chatHandler := handler.NewChatHandler(chatSvc)

	financeRepo := finance.NewFinanceRepository(db)
	financeLimitRepo := finance.NewFinanceLimitRepository(db)
	financeAnalyticsRepo := finance.NewFinanceAnalyticsRepository(db)
	financeSvc := finance.NewFinanceService(financeRepo)
	financeLimitSvc := finance.NewFinanceLimitService(financeLimitRepo, financeRepo)
	financeAnalyticsSvc := finance.NewFinanceAnalyticsService(financeAnalyticsRepo, financeRepo)
	spendingLimitEval := finance.NewSpendingLimitEvaluator(financeLimitRepo, nil)
	financeSvc.SetOnSyncComplete(func(ctx context.Context, userID string) {
		_, _ = spendingLimitEval.EvaluateUserLimits(ctx, userID, time.Now().UTC())
	})
	financeHandler := finance.NewFinanceHandler(financeSvc)
	financeLimitHandler := finance.NewFinanceLimitHandler(financeLimitSvc)
	financeAnalyticsHandler := finance.NewFinanceAnalyticsHandler(financeAnalyticsSvc)

	evoClient := whatsapp.NewDefaultEvolutionClient(cfg.EvolutionAPIURL, cfg.EvolutionAPIKey, nil)
	waSvc := whatsapp.NewWhatsAppService(whatsapp.WhatsAppServiceConfig{
		WebhookBaseURL:  whatsapp.ResolveWhatsAppWebhookBaseURL(cfg.PublicBaseURL, cfg.EvolutionAPIURL, cfg.Port),
		EvolutionAPIURL: cfg.EvolutionAPIURL,
		EvolutionAPIKey: cfg.EvolutionAPIKey,
	}, waRepo, evoClient)
	waSvc.SetNotificationSender(notifSvc)
	waSvc.SetUserRepo(userRepo)
	var audioTranscriber voice.AudioTranscriber
	if cfg.GroqAPIKey != "" {
		audioTranscriber = voice.NewGroqWhisper(cfg.GroqAPIKey)
		waSvc.SetAudioTranscriber(audioTranscriber)
	}

	// Elo de VISÃO para o enriquecimento da mídia do histórico via ADK v2 (OpenRouter).
	var mediaVision ai.ImageDescriber
	if cfg.OpenRouterAPIKey != "" {
		mediaVision = adkengine.NewOpenRouterADKImageDescriber(cfg.OpenRouterAPIKey, cfg.WhatsAppMediaVisionModel)
		log.Printf("🖼️ [AI Provider] Visão do histórico do WhatsApp via ADK (%s).", cfg.WhatsAppMediaVisionModel)
	}

	// Assistente de WhatsApp: contexto, diretório de contatos, backfill e enriquecimento de mídia.
	waWiring := setupWhatsAppAssistant(cfg, db, waRepo, evoClient, waSvc, notifSvc, accountCleanupWorker, mediaVision, audioTranscriber)
	if waWiring.BackfillWorker != nil {
		defer waWiring.BackfillWorker.Stop()
	}
	if waWiring.MediaWorker != nil {
		defer waWiring.MediaWorker.Stop()
	}

	whatsappHandler := whatsapp.NewWhatsAppHandler(waSvc)
	whatsappHandler.SetContextService(waWiring.ContextSvc)
	whatsappHandler.SetDirectoryService(waWiring.Directory)
	whatsappHandler.SetMediaEnricher(waWiring.MediaEnricher)
	whatsappHandler.SetContactsCache(waWiring.ContactsCache, "")
	whatsappHandler.SetContactRepository(waWiring.ContactRepo)
	if bkpMgr != nil {
		// "Limpar histórico" invalida os snapshots: as cópias criptografadas
		// também continham as mensagens apagadas.
		whatsappHandler.SetBackupManager(bkpMgr)
	}
	// Gmail Conector & Scanner
	gmailRepo := gmail.NewGmailRepository(db)
	gmailSvc := gmail.NewGmailService(gmailRepo, cfg.DataEncryptionKey, cfg.GoogleClientID, cfg.GoogleClientSecret)
	googleAuthSvc.SetGmailRepository(gmailRepo, cfg.DataEncryptionKey)
	gmailHandler := gmail.NewGmailHandler(gmailSvc)

	// WhatsApp Passwordless Login OTP
	waAuthRepo := whatsapp.NewWhatsAppAuthRepository(db)
	waAuthSvc := whatsapp.NewWhatsAppAuthService(waAuthRepo, userRepo, authSvc, evoClient, "vito_system", cfg.JWTSecret)
	waAuthSvc.SetWhatsAppRepo(waRepo)
	whatsappAuthHandler := whatsapp.NewWhatsAppAuthHandler(waAuthSvc)

	// Síntese de voz: Gemini TTS nativo (Google AI Studio) como motor primário
	// com fallback em cascata para sintetizador neural pt-BR via HTTP.
	var synth voice.TTSSynthesizer = voice.NewNeuralHTTPTTSSynthesizer()
	if cfg.GeminiAPIKey != "" {
		geminiSynth := voice.NewGeminiTTSProvider(cfg.GeminiAPIKey, cfg.GeminiModel)
		synth = voice.NewCascadeTTSSynthesizer(geminiSynth, synth)
		log.Printf("🗣️ [TTS] Síntese de voz Gemini TTS ativada (modelo=%s, voz=%s) com fallback neural pt-BR.", cfg.GeminiModel, cfg.TTSVoice)
	} else {
		log.Printf("⚠️ [TTS] Gemini API Key não configurada; usando sintetizador neural HTTP pt-BR.")
	}
	ttsSvc := voice.NewTTSService(synth, cfg.TTSCacheDir, cfg.TTSVoice)
	voiceTTSHandler := handler.NewVoiceTTSHandler(ttsSvc)

	// 5.5 Inteligência Conversacional v2 (Loop de Agente, Toolsets e Memória Hierárquica)
	agentSys := setupAgentSubsystem(cfg, db, calSvc, todoSvc, waSvc, gmailSvc, userRepo, aiSettingsRepo, triggerSvc, bookingSvc, memoryRepo, waWiring.Directory)
	if agentSys.StreamHandler != nil {
		if whisperTranscriber != nil {
			agentSys.StreamHandler.SetTranscriber(whisperTranscriber)
		}
		agentSys.StreamHandler.SetTTSService(ttsSvc)
	}
	defer agentSys.TraceRecorder.Close()
	defer agentSys.ConsolidationWorker.Stop()

	// Injeta ponte proativa e governança cognitiva (Ondas 2 e 3: AttentionBudget, CrossDomainBriefing e EntityLinks)
	proactiveBridge := service.NewProactiveConversationBridge(agentSys.ConversationStore)
	morningBriefingWorker.SetProactiveBridge(proactiveBridge)
	cognitiveRes := wireCognitiveRuntime(CognitiveRuntimeConfig{
		DB: db, EventRepo: eventRepo, NotifSvc: notifSvc, PendingSvc: pendingSvc,
		ReminderWorker: reminderWorker, TodoReminderWorker: todoReminderWorker,
		PendingNudgeWorker: pendingNudgeWorker, ExecutiveSummaryWorker: executiveSummaryWorker,
		TriggerWorker: triggerWorker, MorningBriefingWorker: morningBriefingWorker,
		BehavioralWorker: behavioralWorker, AgentSys: agentSys,
	})
	botHandler, botRunner := setupBotSubsystem(db, triggerRepo, notifSvc, cognitiveRes.BudgetSvc, agentSys)
	if botRunner != nil {
		triggerWorker.SetEvaluator(botRunner)
	}
	v5Sys := setupV5Subsystem(db, cognitiveRes.BudgetSvc, agentSys, todoRepo)

	// Inicia workers proativos somente após AttentionBudgetService e inboxRecorder estarem conectados.
	reminderWorker.Start()
	defer reminderWorker.Stop()
	triggerWorker.Start()
	defer triggerWorker.Stop()
	morningBriefingWorker.Start()
	defer morningBriefingWorker.Stop()
	pendingNudgeWorker.Start()
	defer pendingNudgeWorker.Stop()
	todoReminderWorker.Start()
	defer todoReminderWorker.Stop()
	behavioralWorker.Start(func() []string {
		ids, err := userRepo.ListIDs()
		if err != nil {
			return nil
		}
		return ids
	})
	defer behavioralWorker.Stop()
	executiveSummaryWorker.Start()
	defer executiveSummaryWorker.Stop()

	// Handler de voz bidirecional conectado ao Loop de Agente e TTS
	voiceStreamHandler := handler.NewVoiceStreamHandler()
	if agentSys.AgentLoop != nil {
		voiceStreamHandler.SetAgentLoop(agentSys.AgentLoop, agentSys.ConversationStore)
		voiceStreamHandler.SetAudioServices(whisperTranscriber, ttsSvc, cfg.GeminiAPIKey)
	}

	if agentSys.AIProviderSvc != nil {
		chatHandler.SetAIProviderService(agentSys.AIProviderSvc)
	}

	// 6. Servidor HTTP
	srv := server.New(server.Config{
		AuthHandler:             authHandler,
		GoogleAuthHandler:       googleAuthHandler,
		CalHandler:              calHandler,
		TodoHandler:             todoHandler,
		AstStreamHandler:        agentSys.StreamHandler,
		MemoryHandler:           agentSys.MemoryHandler,
		NotifHandler:            notifHandler,
		NotifInboxHandler:       v5Sys.NotifInboxHandler,
		StoreComplianceHandler:  v5Sys.StoreComplianceHandler,
		SyncHandler:             syncHandler,
		BotHandler:              botHandler,
		BriefingHandler:         briefingHandler,
		AISettingsHandler:       aiSettingsHandler,
		AIProviderHandler:       agentSys.AIProviderHandler,
		PendingHandler:          pendingHandler,
		BookingHandler:          bookingHandler,
		MeetingHandler:          meetingHandler,
		P2PHandler:              p2pHandler,
		ChatHandler:             chatHandler,
		WhatsAppHandler:         whatsappHandler,
		GmailHandler:            gmailHandler,
		WhatsAppAuthHandler:     whatsappAuthHandler,
		VoiceHandler:            voiceStreamHandler,
		VoiceTTSHandler:         voiceTTSHandler,
		FinanceHandler:          financeHandler,
		FinanceLimitHandler:     financeLimitHandler,
		FinanceAnalyticsHandler: financeAnalyticsHandler,
		AuthSvc:                 authSvc,
		AllowedOrigins:          cfg.AllowedOrigins(),
		Environment:             cfg.Environment,
	})

	httpServer := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      90 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	// Shutdown gracioso
	shutdownErr := make(chan error, 1)
	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan

		log.Println("🛑 [Vito Server] Recebido sinal de encerramento, finalizando graciosamente...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		shutdownErr <- httpServer.Shutdown(ctx)
	}()

	log.Printf("🚀 [Vito Server] Servidor ativo em :%s (Ambiente: %s)...", cfg.Port, cfg.Environment)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("❌ Erro fatal ao iniciar o servidor: %v", err)
	}

	if err := <-shutdownErr; err != nil {
		log.Printf("⚠️ Erro durante o shutdown gracioso: %v", err)
	}
	log.Println("✅ [Vito Server] Servidor finalizado com sucesso.")
}
