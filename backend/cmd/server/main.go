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

	"github.com/andrevmp/kito/backend/internal/config"
	"github.com/andrevmp/kito/backend/internal/database"
	"github.com/andrevmp/kito/backend/internal/handler"
	"github.com/andrevmp/kito/backend/internal/repository"
	"github.com/andrevmp/kito/backend/internal/server"
	"github.com/andrevmp/kito/backend/internal/service"
)

func main() {
	cfg := config.Load()

	// 1. Conexão ao SQLite com WAL mode e Migrações
	log.Printf("📦 [Kito DB] Inicializando banco SQLite em '%s'...", cfg.DBPath)
	db, err := database.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("❌ Falha crítica ao inicializar banco de dados: %v", err)
	}
	defer db.Close()
	log.Println("✅ [Kito DB] Banco SQLite e migrações aplicadas com sucesso.")

	// 2. Repositórios
	userRepo := repository.NewUserRepository(db)
	eventRepo := repository.NewEventRepository(db)
	todoRepo := repository.NewTodoRepository(db)

	// 3. Serviços
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	calSvc := service.NewCalendarService(eventRepo)
	todoSvc := service.NewTodoService(todoRepo)

	// 4. Handlers HTTP
	authHandler := handler.NewAuthHandler(authSvc, userRepo)
	calHandler := handler.NewCalendarHandler(calSvc)
	todoHandler := handler.NewTodoHandler(todoSvc)

	// 5. Servidor HTTP
	srv := server.New(server.Config{
		AuthHandler: authHandler,
		CalHandler:  calHandler,
		TodoHandler: todoHandler,
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

		log.Println("🛑 [Kito Server] Recebido sinal de encerramento, finalizando graciosamente...")
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		shutdownErr <- httpServer.Shutdown(ctx)
	}()

	log.Printf("🚀 [Kito Server] Servidor ativo em :%s (Ambiente: %s)...", cfg.Port, cfg.Environment)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("❌ Erro fatal ao iniciar o servidor: %v", err)
	}

	if err := <-shutdownErr; err != nil {
		log.Printf("⚠️ Erro durante o shutdown gracioso: %v", err)
	}
	log.Println("✅ [Kito Server] Servidor finalizado com sucesso.")
}
