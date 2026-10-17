package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/config"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/integrations/calendar"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/google/uuid"
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("❌ Falha crítica de segurança na configuração: %v", err)
	}


	// 1. Conexão ao SQLite com WAL mode, Single-Writer Queue e Migrações
	log.Printf("📦 [Vito DB] Inicializando banco SQLite em '%s'...", cfg.DBPath)
	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("❌ Falha crítica ao inicializar banco de dados: %v", err)
	}
	defer db.Close()

	writerQueue := database.NewSingleWriterQueue(256)
	defer writerQueue.Close()
	database.SetDefaultWriterQueue(writerQueue)

	if cfg.DBPath != ":memory:" && len(cfg.DataEncryptionKey) >= 16 {
		backupDir := os.Getenv("BACKUP_DIR")
		if backupDir == "" {
			backupDir = "/app/data/backups"
			if cfg.Environment != "production" {
				backupDir = "./backups"
			}
		}
		if bkpMgr, bkpErr := database.NewBackupManager(database.BackupConfig{
			DB:         db,
			BackupDir:  backupDir,
			MasterKey:  cfg.DataEncryptionKey,
			MaxBackups: 7,
			Interval:   6 * time.Hour,
		}); bkpErr == nil {
			bkpMgr.Start()
			defer bkpMgr.Stop()
			log.Printf("🔒 [BackupWorker] Rotina de backup criptografado AES-256-GCM ativa (%s).", backupDir)
		}
	}
	log.Println("✅ [Vito DB] Banco SQLite e migrações aplicadas com sucesso.")

	// 2. Repositórios
	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)
	coreProfileRepo := repository.NewCoreProfileRepository(db)
	notifRepo := repository.NewDeviceTokenRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	briefingRepo := repository.NewBriefingRepository(db)
	aiSettingsRepo := repository.NewAISettingsRepository(db)
	pendingRepo := repository.NewPendingRepository(db)
	bookingRepo := repository.NewBookingRepositorySQLite(db)
	meetingRepo := repository.NewMeetingRepositorySQLite(db)
	p2pRepo := repository.NewP2PInviteRepositorySQLite(db)
	chatRepo := repository.NewChatRepository(db)

	// 3. Provedores de IA & AI Gateway com Failover.
	// Ordem: Groq primário (free generoso: 30 RPM/1000 RPD), Gemini como
	// fallback de qualidade (+grounding) e OpenRouter por último.
	var aiProviders []ai.Provider
	var geminiProv *ai.GeminiProvider
	if cfg.GroqAPIKey != "" {
		log.Printf("🤖 [AI Provider] Groq Cloud primário (%s).", cfg.GroqModel)
		aiProviders = append(aiProviders, ai.NewGroqProvider(cfg.GroqAPIKey, cfg.GroqModel))
	}
	if cfg.MistralAPIKey != "" {
		log.Printf("🤖 [AI Provider] Mistral La Plateforme (%s).", cfg.MistralModel)
		aiProviders = append(aiProviders, ai.NewMistralProvider(cfg.MistralAPIKey, cfg.MistralModel))
	}
	if cfg.GeminiAPIKey != "" {
		log.Printf("🤖 [AI Provider] Google AI Studio como fallback (%s).", cfg.GeminiModel)
		geminiProv = ai.NewGeminiProvider(cfg.GeminiAPIKey, cfg.GeminiModel)
		aiProviders = append(aiProviders, geminiProv)
	}
	if cfg.OpenRouterAPIKey != "" {
		log.Printf("🤖 [AI Provider] OpenRouter ativado como fallback (%s).", cfg.OpenRouterModel)
		aiProviders = append(aiProviders, ai.NewOpenRouterProvider(cfg.OpenRouterAPIKey, cfg.OpenRouterModel))
	}

	aiGateway := ai.NewGateway(aiProviders...)

	// 4. Serviços
	sessionRepo := repository.NewSessionRepository(db)
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	authSvc.SetSessionRepository(sessionRepo)
	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	triggerSvc := service.NewTriggerService(triggerRepo)
	pendingSvc := service.NewPendingService(pendingRepo)
	astSvc := service.NewAssistantService(aiGateway, calSvc, todoSvc, memoryRepo, triggerSvc)
	astSvc.SetUserRepository(userRepo)
	astSvc.SetAISettingsRepository(aiSettingsRepo)
	astSvc.SetCoreProfileRepository(coreProfileRepo)
	astSvc.SetPendingService(pendingSvc)
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

	syncRepo := repository.NewCalendarSyncRepository(db)
	syncSvc := service.NewCalendarSyncService(syncRepo, eventRepo, cfg.DataEncryptionKey)
	googleCalCfg := calendar.GoogleConfig{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURI:  cfg.GoogleRedirectURL,
	}
	syncSvc.RegisterProvider(calendar.NewGoogleProvider(googleCalCfg))
	syncSvc.RegisterProvider(calendar.NewAppleCalDAVProvider(calendar.AppleCalDAVConfig{}))
	calSvc.SetSyncPusher(syncSvc)

	// Worker em segundo plano para lembretes de compromissos
	reminderWorker := service.NewReminderWorker(eventRepo, notifSvc, 15*time.Minute)
	reminderWorker.Start()
	defer reminderWorker.Stop()

	// Worker em segundo plano para vigília autônoma de disparadores com cascata completa de IA (Groq -> Mistral -> Gemini -> OpenRouter)
	var triggerEvaluator service.TriggerEvaluator = &service.DefaultTriggerEvaluator{}
	if len(aiProviders) > 0 {
		triggerEvaluator = service.NewAITriggerEvaluator(func(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
			return aiGateway.EvaluateTrigger(ctx, t)
		})
	}
	triggerWorker := service.NewTriggerWorker(triggerRepo, notifSvc, triggerEvaluator, 1*time.Minute)
	// Delta gate pré-IA (§9.3): hashes dos fatos atuais via conectores por categoria.
	triggerWorker.SetDeltaFetcher(func(fetchCtx context.Context, t *domain.Trigger) ([]string, []string, error) {		items, err := ai.RouteTriggerSource(t).Fetch(fetchCtx, t)
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
			h := ai.HashDataPoint(it)
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
		items, err := ai.RouteTriggerSource(t).Fetch(fetchCtx, t)
		if err != nil {
			return 0, "", false, err
		}
		for _, it := range items {
			if v, ok := service.ParseMoneyValue(it.Value); ok {
				return v, it.Value, true, nil
			}
		}
		return 0, "", false, nil
	})
	triggerWorker.Start()
	defer triggerWorker.Stop()

	// Worker em segundo plano para briefing matinal proativo com síntese de IA em cascata
	morningBriefingWorker := service.NewMorningBriefingWorker(briefingRepo, eventRepo, todoRepo, userRepo, notifSvc, 1*time.Minute)
	if len(aiProviders) > 0 {
		morningBriefingWorker.SetTextGenerator(aiGateway)
	}
	morningBriefingWorker.Start()
	defer morningBriefingWorker.Stop()

	// Worker em segundo plano para lembretes de pendências (nudge diário)
	pendingNudgeWorker := service.NewPendingNudgeWorker(pendingRepo, userRepo, notifSvc, 1*time.Minute)
	pendingNudgeWorker.Start()
	defer pendingNudgeWorker.Stop()

	// Worker em segundo plano para lembretes de tarefas com prazo
	todoReminderWorker := service.NewTodoReminderWorker(todoRepo, notifSvc, 15*time.Minute)
	todoReminderWorker.Start()
	defer todoReminderWorker.Stop()

	// Worker em segundo plano para consolidação comportamental noturna (§8.4 ciclo 3)
	behavioralWorker := service.NewBehavioralWorker(todoRepo, eventRepo, memoryRepo)
	behavioralWorker.Start(func() []string {
		ids, err := userRepo.ListIDs()
		if err != nil {
			return nil
		}
		return ids
	})
	defer behavioralWorker.Stop()

	// Worker em segundo plano para resumos executivos (diário, semanal e mensal)
	executiveSummaryWorker := service.NewExecutiveSummaryWorker(db, userRepo, notifSvc, 1*time.Minute)
	executiveSummaryWorker.Start()
	defer executiveSummaryWorker.Stop()

	googleAuthCfg := service.GoogleAuthConfig{
		ClientID:     cfg.GoogleClientID,
		ClientSecret: cfg.GoogleClientSecret,
		RedirectURL:  cfg.GoogleRedirectURL,
		JWTSecret:    cfg.JWTSecret,
	}
	googleAuthSvc := service.NewGoogleAuthService(googleAuthCfg, userRepo, authSvc, syncSvc)

	// Transcritor de voz Whisper
	var whisperTranscriber ai.AudioTranscriber
	if cfg.GroqAPIKey != "" {
		whisperTranscriber = ai.NewGroqWhisper(cfg.GroqAPIKey)
		log.Println("🎙️ [Audio Whisper] Groq Whisper Large v3 ativado para transcrição de voz.")
	}

	// 5. Handlers HTTP
	authHandler := handler.NewAuthHandler(authSvc, userRepo)
	googleAuthHandler := handler.NewGoogleAuthHandler(googleAuthSvc, authSvc)
	calHandler := handler.NewCalendarHandler(calSvc)
	todoHandler := handler.NewTodoHandler(todoSvc)
	astHandler := handler.NewAssistantHandler(astSvc, whisperTranscriber)
	notifHandler := handler.NewNotificationHandler(notifSvc)
	syncHandler := handler.NewCalendarSyncHandler(syncSvc)
	triggerHandler := handler.NewTriggerHandler(triggerSvc, triggerWorker)
	briefingHandler := handler.NewBriefingHandler(briefingRepo)
	aiSettingsHandler := handler.NewAISettingsHandler(aiSettingsRepo)
	pendingHandler := handler.NewPendingHandler(pendingSvc)

	linkShortener := service.NewShortIoShortenerService(cfg.ShortIoAPIKey, cfg.ShortIoDomain, cfg.PublicBaseURL)
	turnstileValidator := service.NewTurnstileValidator(cfg.TurnstileSecretKey)
	bookingSvc := service.NewBookingService(bookingRepo, eventRepo, userRepo, notifSvc, linkShortener, turnstileValidator, cfg.PublicBaseURL)
	bookingSvc.SetSyncPusher(syncSvc)
	astSvc.SetBookingService(bookingSvc)
	bookingHandler := handler.NewBookingHandler(bookingSvc)

	emailSvc := service.NewEmailService(cfg.SMTPHost, cfg.SMTPPort, cfg.SMTPUser, cfg.SMTPPassword, cfg.SMTPFrom)
	bookingSvc.SetEmailService(emailSvc)

	meetingSvc := service.NewMeetingService(meetingRepo, eventRepo, notifSvc, linkShortener, cfg.PublicBaseURL)
	meetingSvc.SetSyncPusher(syncSvc)
	meetingSvc.SetEmailService(emailSvc)
	astSvc.SetMeetingService(meetingSvc)
	meetingHandler := handler.NewMeetingHandler(meetingSvc)

	p2pSvc := service.NewP2PMeetingService(p2pRepo, userRepo, calSvc, notifSvc)
	p2pHandler := handler.NewP2PMeetingHandler(p2pSvc, userRepo)

	chatSvc := service.NewChatService(chatRepo)
	chatHandler := handler.NewChatHandler(chatSvc)

	// 6. Servidor HTTP
	srv := server.New(server.Config{
		AuthHandler:       authHandler,
		GoogleAuthHandler: googleAuthHandler,
		CalHandler:        calHandler,
		TodoHandler:       todoHandler,
		AstHandler:        astHandler,
		NotifHandler:      notifHandler,
		SyncHandler:       syncHandler,
		TriggerHandler:    triggerHandler,
		BriefingHandler:   briefingHandler,
		AISettingsHandler: aiSettingsHandler,
		PendingHandler:    pendingHandler,
		BookingHandler:    bookingHandler,
		MeetingHandler:    meetingHandler,
		P2PHandler:        p2pHandler,
		ChatHandler:       chatHandler,
		AuthSvc:           authSvc,
		AllowedOrigins:    cfg.AllowedOrigins(),
		Environment:       cfg.Environment,
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
