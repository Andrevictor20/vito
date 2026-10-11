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
)

func main() {
	cfg := config.Load()
	if err := cfg.Validate(); err != nil {
		log.Fatalf("❌ Falha crítica de segurança na configuração: %v", err)
	}


	// 1. Conexão ao SQLite com WAL mode e Migrações
	log.Printf("📦 [Vito DB] Inicializando banco SQLite em '%s'...", cfg.DBPath)
	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("❌ Falha crítica ao inicializar banco de dados: %v", err)
	}
	defer db.Close()
	log.Println("✅ [Vito DB] Banco SQLite e migrações aplicadas com sucesso.")

	// 2. Repositórios
	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)
	memoryRepo := repository.NewMemoryRepository(db)
	notifRepo := repository.NewDeviceTokenRepository(db)
	triggerRepo := repository.NewTriggerRepository(db)
	briefingRepo := repository.NewBriefingRepository(db)
	aiSettingsRepo := repository.NewAISettingsRepository(db)

	// 3. Provedores de IA & AI Gateway com Failover
	var aiProviders []ai.Provider
	var geminiProv *ai.GeminiProvider
	if cfg.GeminiAPIKey != "" {
		log.Printf("🤖 [AI Provider] Google AI Studio ativado (%s).", cfg.GeminiModel)
		geminiProv = ai.NewGeminiProvider(cfg.GeminiAPIKey, cfg.GeminiModel)
		aiProviders = append(aiProviders, geminiProv)
	}
	if cfg.GroqAPIKey != "" {
		log.Println("🤖 [AI Provider] Groq Cloud ativado como fallback.")
		aiProviders = append(aiProviders, ai.NewGroqProvider(cfg.GroqAPIKey, "qwen/qwen3.8-27b"))
	}
	if cfg.OpenRouterAPIKey != "" {
		log.Println("🤖 [AI Provider] OpenRouter ativado como fallback.")
		aiProviders = append(aiProviders, ai.NewOpenRouterProvider(cfg.OpenRouterAPIKey, "openrouter/auto"))
	}

	aiGateway := ai.NewGateway(aiProviders...)

	// 4. Serviços
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	triggerSvc := service.NewTriggerService(triggerRepo)
	astSvc := service.NewAssistantService(aiGateway, calSvc, todoSvc, memoryRepo, triggerSvc)
	astSvc.SetUserRepository(userRepo)
	astSvc.SetAISettingsRepository(aiSettingsRepo)

	syncRepo := repository.NewCalendarSyncRepository(db)
	syncSvc := service.NewCalendarSyncService(syncRepo, eventRepo, cfg.JWTSecret)
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

	// Worker em segundo plano para vigília autônoma de disparadores
	var triggerEvaluator service.TriggerEvaluator = &service.DefaultTriggerEvaluator{}
	if geminiProv != nil {
		triggerEvaluator = service.NewAITriggerEvaluator(func(ctx context.Context, t *domain.Trigger) (*domain.TriggerTestResult, error) {
			return geminiProv.TestEvaluateTrigger(ctx, t)
		})
	}
	triggerWorker := service.NewTriggerWorker(triggerRepo, notifSvc, triggerEvaluator, 1*time.Minute)
	triggerWorker.Start()
	defer triggerWorker.Stop()

	// Worker em segundo plano para briefing matinal proativo
	morningBriefingWorker := service.NewMorningBriefingWorker(briefingRepo, eventRepo, todoRepo, userRepo, notifSvc, 1*time.Minute)
	morningBriefingWorker.Start()
	defer morningBriefingWorker.Stop()

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
		AuthSvc:           authSvc,
	})

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      srv.Router(),
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 90 * time.Second,
		IdleTimeout:  120 * time.Second,
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
