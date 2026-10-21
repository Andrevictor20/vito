package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"runtime/debug"
	"strconv"
	"strings"
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

// applyMemoryLimit define o teto de heap do Go.
//
// O Raspberry Pi 4 (8 GB) hospeda o backend, a Evolution API (Node) e o PostgreSQL
// (256M) no mesmo host. Sem teto, o GC do Go deixa a heap crescer e o kernel passa
// a matar o PostgreSQL — a vítima mais frágil do box. GOMEMLIMIT (Go 1.19+) faz o
// coletor trabalhar mais perto do limite em vez de deixar a memória crescer.
func applyMemoryLimit() {
	raw := strings.TrimSpace(os.Getenv("GOMEMLIMIT"))
	if raw == "" {
		raw = "256MiB"
	}
	limit, err := parseMemoryLimit(raw)
	if err != nil || limit <= 0 {
		log.Printf("⚠️ [Vito Server] GOMEMLIMIT inválido (%q); usando o padrão de 256MiB", raw)
		limit = 256 << 20
	}
	debug.SetMemoryLimit(limit)
	log.Printf("🧠 [Vito Server] Teto de heap do Go definido: %s (%.0f MB)", raw, float64(limit)/(1024*1024))
}

// parseMemoryLimit converte "256MiB" / "512M" / "1GiB" em bytes.
func parseMemoryLimit(raw string) (int64, error) {
	cleaned := strings.TrimSpace(strings.ToUpper(raw))
	multiplier := int64(1)
	switch {
	case strings.HasSuffix(cleaned, "MIB"):
		multiplier = 1 << 20
		cleaned = strings.TrimSuffix(cleaned, "MIB")
	case strings.HasSuffix(cleaned, "GIB"):
		multiplier = 1 << 30
		cleaned = strings.TrimSuffix(cleaned, "GIB")
	case strings.HasSuffix(cleaned, "MB"):
		multiplier = 1 << 20
		cleaned = strings.TrimSuffix(cleaned, "MB")
	case strings.HasSuffix(cleaned, "GB"):
		multiplier = 1 << 30
		cleaned = strings.TrimSuffix(cleaned, "GB")
	case strings.HasSuffix(cleaned, "M"):
		multiplier = 1 << 20
		cleaned = strings.TrimSuffix(cleaned, "M")
	case strings.HasSuffix(cleaned, "G"):
		multiplier = 1 << 30
		cleaned = strings.TrimSuffix(cleaned, "G")
	}
	value, err := strconv.ParseFloat(strings.TrimSpace(cleaned), 64)
	if err != nil {
		return 0, err
	}
	return int64(value * float64(multiplier)), nil
}

func main() {
	applyMemoryLimit()
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
	// Ordem: Gemini 2.5 Flash primário (forte em resolução de referência e
	// diretivas de contexto), Groq/Mistral como fallback de cota e OpenRouter por
	// último. O modelo pequeno do Groq (gpt-oss-20b) ignorava o bloco de
	// contexto e respondia "não sei" mesmo com a janela montada.
	var aiProviders []ai.Provider
	if cfg.GeminiAPIKey != "" {
		log.Printf("🤖 [AI Provider] Google AI Studio primário (%s).", cfg.GeminiModel)
		aiProviders = append(aiProviders, ai.NewGeminiProvider(cfg.GeminiAPIKey, cfg.GeminiModel))
	}
	if cfg.GroqAPIKey != "" {
		log.Printf("🤖 [AI Provider] Groq Cloud como fallback (%s).", cfg.GroqModel)
		aiProviders = append(aiProviders, ai.NewGroqProvider(cfg.GroqAPIKey, cfg.GroqModel))
	}
	if cfg.MistralAPIKey != "" {
		log.Printf("🤖 [AI Provider] Mistral La Plateforme como fallback (%s).", cfg.MistralModel)
		aiProviders = append(aiProviders, ai.NewMistralProvider(cfg.MistralAPIKey, cfg.MistralModel))
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
	triggerWorker.SetDeltaFetcher(func(fetchCtx context.Context, t *domain.Trigger) ([]string, []string, error) {
		items, err := ai.RouteTriggerSource(t).Fetch(fetchCtx, t)
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

	// Worker em segundo plano para limpeza de contas placeholder órfãs (@vito.local)
	// criadas por logins de WhatsApp — libera o número de telefone de terceiros.
	accountCleanupSvc := service.NewAccountCleanupService(userRepo, sessionRepo, eventRepo, todoRepo, memoryRepo)
	accountCleanupWorker := service.NewAccountCleanupWorker(accountCleanupSvc, 15*time.Minute)
	accountCleanupWorker.Start()
	defer accountCleanupWorker.Stop()

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
		ClientID:       cfg.GoogleClientID,
		ClientSecret:   cfg.GoogleClientSecret,
		RedirectURL:    cfg.GoogleRedirectURL,
		JWTSecret:      cfg.JWTSecret,
		AllowedOrigins: cfg.AllowedOrigins(),
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
	meetingSvc.SetUserRepository(userRepo)
	meetingSvc.SetSyncPusher(syncSvc)
	meetingSvc.SetEmailService(emailSvc)
	astSvc.SetMeetingService(meetingSvc)
	meetingHandler := handler.NewMeetingHandler(meetingSvc)

	waRepo := repository.NewWhatsAppRepository(db)

	p2pSvc := service.NewP2PMeetingService(p2pRepo, userRepo, calSvc, notifSvc)
	p2pHandler := handler.NewP2PMeetingHandler(p2pSvc, userRepo, waRepo)

	chatSvc := service.NewChatService(chatRepo)
	chatHandler := handler.NewChatHandler(chatSvc)

	evoClient := service.NewDefaultEvolutionClient(cfg.EvolutionAPIURL, cfg.EvolutionAPIKey, nil)
	waSvc := service.NewWhatsAppService(service.WhatsAppServiceConfig{
		WebhookBaseURL:  cfg.PublicBaseURL,
		EvolutionAPIURL: cfg.EvolutionAPIURL,
		EvolutionAPIKey: cfg.EvolutionAPIKey,
	}, waRepo, evoClient, astSvc)
	waSvc.SetNotificationSender(notifSvc)
	waSvc.SetUserRepo(userRepo)
	if cfg.GroqAPIKey != "" {
		waSvc.SetAudioTranscriber(ai.NewGroqWhisper(cfg.GroqAPIKey))
	}

	// Assistente de WhatsApp: contexto, diretório de contatos, pendências, Radar e backfill.
	waWiring := setupWhatsAppAssistant(cfg, db, waRepo, evoClient, waSvc, astSvc, notifSvc, accountCleanupWorker)
	waNudgeWorker := waWiring.NudgeWorker
	waNudgeWorker.Start()
	defer waNudgeWorker.Stop()
	if waWiring.BackfillWorker != nil {
		defer waWiring.BackfillWorker.Stop()
	}

	whatsappHandler := handler.NewWhatsAppHandler(waSvc)
	whatsappHandler.SetContextService(waWiring.ContextSvc)
	whatsappHandler.SetDirectoryService(waWiring.Directory)
	if bkpMgr != nil {
		// "Limpar histórico" invalida os snapshots: as cópias criptografadas
		// também continham as mensagens apagadas.
		whatsappHandler.SetBackupManager(bkpMgr)
	}
	// O app e o desktop também recebem o contexto do WhatsApp (a resposta só é
	// vista pelo usuário, então o escopo "todos os chats" é seguro nessas surfaces).
	astHandler.SetContextService(waWiring.ContextSvc)

	// Gmail Conector & Scanner
	gmailRepo := repository.NewGmailRepository(db)
	gmailSvc := service.NewGmailService(gmailRepo, cfg.DataEncryptionKey, cfg.GoogleClientID, cfg.GoogleClientSecret)
	googleAuthSvc.SetGmailRepository(gmailRepo, cfg.DataEncryptionKey)
	astSvc.SetGmailService(gmailSvc)
	gmailHandler := handler.NewGmailHandler(gmailSvc)

	// WhatsApp Passwordless Login OTP
	waAuthRepo := repository.NewWhatsAppAuthRepository(db)
	waAuthSvc := service.NewWhatsAppAuthService(waAuthRepo, userRepo, authSvc, evoClient, "vito_system", cfg.JWTSecret)
	waAuthSvc.SetWhatsAppRepo(waRepo)
	whatsappAuthHandler := handler.NewWhatsAppAuthHandler(waAuthSvc)

	// 6. Servidor HTTP
	srv := server.New(server.Config{
		AuthHandler:         authHandler,
		GoogleAuthHandler:   googleAuthHandler,
		CalHandler:          calHandler,
		TodoHandler:         todoHandler,
		AstHandler:          astHandler,
		NotifHandler:        notifHandler,
		SyncHandler:         syncHandler,
		TriggerHandler:      triggerHandler,
		BriefingHandler:     briefingHandler,
		AISettingsHandler:   aiSettingsHandler,
		PendingHandler:      pendingHandler,
		BookingHandler:      bookingHandler,
		MeetingHandler:      meetingHandler,
		P2PHandler:          p2pHandler,
		ChatHandler:         chatHandler,
		WhatsAppHandler:     whatsappHandler,
		GmailHandler:        gmailHandler,
		WhatsAppAuthHandler: whatsappAuthHandler,
		AuthSvc:             authSvc,
		AllowedOrigins:      cfg.AllowedOrigins(),
		Environment:         cfg.Environment,
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
