package main

import (
	"context"
	"errors"
	"github.com/andrevmp/vito/backend/internal/ai/voice"
	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/calendar/booking"
	"github.com/andrevmp/vito/backend/internal/calendar/meeting"
	"github.com/andrevmp/vito/backend/internal/calendar/p2p"
	"github.com/andrevmp/vito/backend/internal/calendar/providers"
	calsync "github.com/andrevmp/vito/backend/internal/calendar/sync"
	"github.com/andrevmp/vito/backend/internal/finance"
	"github.com/andrevmp/vito/backend/internal/gmail"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	waauth "github.com/andrevmp/vito/backend/internal/whatsapp/auth"
	"github.com/andrevmp/vito/backend/internal/whatsapp/evolution"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/ai/adkengine"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/platform/config"
	"github.com/andrevmp/vito/backend/internal/platform/database"
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
		backupDir := resolveBackupDir(cfg)
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
	bookingRepo := booking.NewBookingRepositorySQLite(db)
	meetingRepo := meeting.NewMeetingRepositorySQLite(db)
	p2pRepo := p2p.NewP2PInviteRepositorySQLite(db)
	chatRepo := repository.NewChatRepository(db)

	// 3. Provedores de IA & Serviços
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

	syncRepo := calsync.NewCalendarSyncRepository(db)
	syncSvc := calsync.NewCalendarSyncService(syncRepo, eventRepo, cfg.DataEncryptionKey)
	googleCalCfg := providers.GoogleConfig{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURI:  cfg.GoogleRedirectURL,
	}
	syncSvc.RegisterProvider(providers.NewGoogleProvider(googleCalCfg))
	syncSvc.RegisterProvider(providers.NewAppleCalDAVProvider(providers.AppleCalDAVConfig{}))
	calSvc.SetSyncPusher(syncSvc)

	// Worker em segundo plano para lembretes de compromissos (iniciado após wiring cognitivo)
	reminderWorker := calendar.NewReminderWorker(eventRepo, notifSvc, 15*time.Minute)

	// Worker em segundo plano para vigília autônoma de bots/disparadores (motor ADK v2 conectado via BotRunner)
	triggerWorker := bots.NewTriggerWorker(triggerRepo, notifSvc, &bots.DefaultTriggerEvaluator{}, 1*time.Minute)
	// Delta gate pré-IA (§9.3) e fast-path de preço-alvo (Fase 1).
	triggerWorker.SetDeltaFetcher(func(fetchCtx context.Context, t *domain.Trigger) ([]string, []string, error) {
		return fetchTriggerDelta(fetchCtx, triggerRepo, t)
	})
	triggerWorker.SetPriceFetcher(fetchTriggerPrice)

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
	executiveSummaryWorker := service.NewExecutiveSummaryWorker(db, userRepo, notifSvc, 1*time.Minute)

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
	syncHandler := calsync.NewCalendarSyncHandler(syncSvc)
	briefingHandler := handler.NewBriefingHandler(briefingRepo)
	aiSettingsHandler := handler.NewAISettingsHandler(aiSettingsRepo)
	pendingHandler := tasks.NewPendingHandler(pendingSvc)

	linkShortener := service.NewShortIoShortenerService(cfg.ShortIoAPIKey, cfg.ShortIoDomain, cfg.PublicBaseURL)
	turnstileValidator := service.NewTurnstileValidator(cfg.TurnstileSecretKey)
	bookingSvc := booking.NewBookingService(bookingRepo, eventRepo, userRepo, notifSvc, linkShortener, turnstileValidator, cfg.PublicBaseURL)
	bookingSvc.SetSyncPusher(syncSvc)
	bookingHandler := booking.NewBookingHandler(bookingSvc)

	emailSvc := service.NewEmailService(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPFrom)
	bookingSvc.SetEmailService(emailSvc)

	meetingSvc := meeting.NewMeetingService(meetingRepo, eventRepo, notifSvc, linkShortener, cfg.PublicBaseURL)
	meetingSvc.SetUserRepository(userRepo)
	meetingSvc.SetSyncPusher(syncSvc)
	meetingSvc.SetEmailService(emailSvc)
	meetingHandler := meeting.NewMeetingHandler(meetingSvc)

	waRepo := whatsapp.NewWhatsAppRepository(db)

	p2pSvc := p2p.NewP2PMeetingService(p2pRepo, userRepo, calSvc, notifSvc)
	p2pHandler := p2p.NewP2PMeetingHandler(p2pSvc, userRepo, waRepo)

	chatSvc := service.NewChatService(chatRepo)
	chatHandler := handler.NewChatHandler(chatSvc)

	evoClient := evolution.NewDefaultEvolutionClient(cfg.EvolutionAPIURL, cfg.EvolutionAPIKey, nil)
	waSvc := whatsapp.NewWhatsAppService(whatsapp.WhatsAppServiceConfig{
		WebhookBaseURL:  whatsapp.ResolveWhatsAppWebhookBaseURL(cfg.PublicBaseURL, cfg.EvolutionAPIURL, cfg.Port),
		EvolutionAPIURL: cfg.EvolutionAPIURL,
		EvolutionAPIKey: cfg.EvolutionAPIKey,
	}, waRepo, evoClient)
	waSvc.SetNotificationSender(notifSvc)
	waSvc.SetUserRepo(userRepo)
	if whisperTranscriber != nil {
		waSvc.SetAudioTranscriber(whisperTranscriber)
	}

	// Elo de VISÃO para o enriquecimento da mídia do histórico via ADK v2 (OpenRouter).
	var mediaVision ai.ImageDescriber
	if cfg.OpenRouterAPIKey != "" {
		mediaVision = adkengine.NewOpenRouterADKImageDescriber(cfg.OpenRouterAPIKey, cfg.WhatsAppMediaVisionModel)
		log.Printf("🖼️ [AI Provider] Visão do histórico do WhatsApp via ADK (%s).", cfg.WhatsAppMediaVisionModel)
	}

	// Assistente de WhatsApp: contexto, diretório de contatos, backfill e enriquecimento de mídia.
	waWiring := setupWhatsAppAssistant(cfg, db, waRepo, evoClient, waSvc, notifSvc, accountCleanupWorker, mediaVision, whisperTranscriber)
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
	waAuthRepo := waauth.NewWhatsAppAuthRepository(db)
	waAuthSvc := waauth.NewWhatsAppAuthService(waAuthRepo, userRepo, authSvc, evoClient, "vito_system", cfg.JWTSecret)
	waAuthSvc.SetWhatsAppRepo(waRepo)
	whatsappAuthHandler := waauth.NewWhatsAppAuthHandler(waAuthSvc)

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
	if agentSys.AssistantEngine != nil {
		todoHandler.SetAssistantEngine(agentSys.AssistantEngine)
	}
	if agentSys.StreamHandler != nil {
		if whisperTranscriber != nil {
			agentSys.StreamHandler.SetTranscriber(whisperTranscriber)
		}
		agentSys.StreamHandler.SetTTSService(ttsSvc)
	}
	defer agentSys.TraceRecorder.Close()
	defer agentSys.ConsolidationWorker.Stop()

	spendingLimitEval := finance.NewSpendingLimitEvaluator(agentSys.FinanceLimitRepo, nil)
	financeHandler := finance.NewFinanceHandler(agentSys.FinanceSvc)
	financeLimitHandler := finance.NewFinanceLimitHandler(agentSys.FinanceLimitSvc)
	financeAnalyticsHandler := finance.NewFinanceAnalyticsHandler(agentSys.FinanceSvc)

	// Injeta ponte proativa e governança cognitiva (Ondas 2 e 3: AttentionBudget, CrossDomainBriefing e EntityLinks)
	proactiveBridge := service.NewProactiveConversationBridge(agentSys.ConversationStore)
	morningBriefingWorker.SetProactiveBridge(proactiveBridge)
	cognitiveRes := wireCognitiveRuntime(CognitiveRuntimeConfig{
		DB: db, EventRepo: eventRepo, NotifSvc: notifSvc, PendingSvc: pendingSvc,
		ReminderWorker: reminderWorker, TodoReminderWorker: todoReminderWorker,
		PendingNudgeWorker: pendingNudgeWorker, ExecutiveSummaryWorker: executiveSummaryWorker,
		TriggerWorker: triggerWorker, MorningBriefingWorker: morningBriefingWorker,
		BehavioralWorker: behavioralWorker, AgentSys: agentSys,
		FinanceRepo: agentSys.FinanceRepo, FinanceSvc: agentSys.FinanceSvc,
		SpendingLimitEval: spendingLimitEval, WhatsAppSvc: waSvc,
	})
	botHandler, botRunner := setupBotSubsystem(db, triggerRepo, notifSvc, cognitiveRes.BudgetSvc, agentSys)
	if botRunner != nil {
		triggerWorker.SetEvaluator(botRunner)
	}
	inboxSys := setupInboxComplianceSubsystem(db, cognitiveRes.BudgetSvc, agentSys, todoRepo)

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

	// Handler de voz bidirecional conectado ao motor ADK e TTS
	voiceStreamHandler := handler.NewVoiceStreamHandler()
	if agentSys.AssistantEngine != nil {
		voiceStreamHandler.SetAgentLoop(agentSys.AssistantEngine)
		voiceStreamHandler.SetAudioServices(whisperTranscriber, ttsSvc)
		voiceStreamHandler.SetAISettingsRepository(aiSettingsRepo)
	}

	if agentSys.AIProviderSvc != nil {
		chatHandler.SetAIProviderService(agentSys.AIProviderSvc)
	}
	if agentSys.ConversationStore != nil {
		chatHandler.SetConversationStore(agentSys.ConversationStore)
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
		NotifInboxHandler:       inboxSys.NotifInboxHandler,
		StoreComplianceHandler:  inboxSys.StoreComplianceHandler,
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
