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
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/server"
	"github.com/andrevmp/vito/backend/internal/service"
)

func main() {
	cfg := config.Load()

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

	// 3. Provedores de IA & AI Gateway com Failover
	var aiProviders []ai.Provider
	if cfg.GeminiAPIKey != "" {
		log.Println("🤖 [AI Provider] Google AI Studio ativado.")
		aiProviders = append(aiProviders, ai.NewGeminiProvider(cfg.GeminiAPIKey, "gemini-2.5-flash"))
	}
	if cfg.OpenRouterAPIKey != "" {
		log.Println("🤖 [AI Provider] OpenRouter ativado como fallback.")
		aiProviders = append(aiProviders, ai.NewOpenRouterProvider(cfg.OpenRouterAPIKey, "google/gemini-2.0-flash-exp:free"))
	}
	if cfg.GroqAPIKey != "" {
		log.Println("🤖 [AI Provider] Groq Cloud ativado como fallback.")
		aiProviders = append(aiProviders, ai.NewGroqProvider(cfg.GroqAPIKey, "llama-3.3-70b-versatile"))
	}

	aiGateway := ai.NewGateway(aiProviders...)

	// 4. Serviços
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)
	astSvc := service.NewAssistantService(aiGateway, calSvc, todoSvc)

	// 5. Handlers HTTP
	authHandler := handler.NewAuthHandler(authSvc, userRepo)
	calHandler := handler.NewCalendarHandler(calSvc)
	todoHandler := handler.NewTodoHandler(todoSvc)
	astHandler := handler.NewAssistantHandler(astSvc)

	// 6. Servidor HTTP
	srv := server.New(server.Config{
		AuthHandler: authHandler,
		CalHandler:  calHandler,
		TodoHandler: todoHandler,
		AstHandler:  astHandler,
		AuthSvc:     authSvc,
	})

	httpServer := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      srv.Router(),
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
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
