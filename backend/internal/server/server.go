package server

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// Server encapsula o roteador Chi e dependências HTTP do Kito.
type Server struct {
	router            *chi.Mux
	authHandler       *handler.AuthHandler
	googleAuthHandler *handler.GoogleAuthHandler
	calHandler        *handler.CalendarHandler
	todoHandler       *handler.TodoHandler
	astHandler        *handler.AssistantHandler
	notifHandler      *handler.NotificationHandler
	syncHandler       *handler.CalendarSyncHandler
	authSvc           *service.AuthService
}

// Config contém as dependências necessárias para inicializar o Server.
type Config struct {
	AuthHandler       *handler.AuthHandler
	GoogleAuthHandler *handler.GoogleAuthHandler
	CalHandler        *handler.CalendarHandler
	TodoHandler       *handler.TodoHandler
	AstHandler        *handler.AssistantHandler
	NotifHandler      *handler.NotificationHandler
	SyncHandler       *handler.CalendarSyncHandler
	AuthSvc           *service.AuthService
}

// New instancia o servidor com o roteador Chi, middlewares e rotas registrados.
func New(cfg ...Config) *Server {
	s := &Server{
		router: chi.NewRouter(),
	}

	if len(cfg) > 0 {
		s.authHandler = cfg[0].AuthHandler
		s.googleAuthHandler = cfg[0].GoogleAuthHandler
		s.calHandler = cfg[0].CalHandler
		s.todoHandler = cfg[0].TodoHandler
		s.astHandler = cfg[0].AstHandler
		s.notifHandler = cfg[0].NotifHandler
		s.syncHandler = cfg[0].SyncHandler
		s.authSvc = cfg[0].AuthSvc
	}

	s.setupMiddlewares()
	s.registerRoutes()
	return s
}

// Router retorna o handler HTTP principal.
func (s *Server) Router() http.Handler {
	return s.router
}

func (s *Server) setupMiddlewares() {
	s.router.Use(chimiddleware.RequestID)
	s.router.Use(chimiddleware.RealIP)
	s.router.Use(chimiddleware.Logger)
	s.router.Use(chimiddleware.Recoverer)
	s.router.Use(middleware.SecurityHeadersMiddleware)

	// Configuração segura e completa de CORS para Mobile e Web
	s.router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: false,
		MaxAge:           300,
	}))
}

func (s *Server) registerRoutes() {
	s.router.Get("/", s.handleHomePage)
	s.router.Get("/healthz", s.handleHealthCheck)
	s.router.Get("/privacy", s.handlePrivacyPolicy)
	s.router.Get("/terms", s.handleTermsOfService)

	s.router.Route("/api/v1", func(r chi.Router) {
		// Rotas públicas de autenticação
		if s.authHandler != nil {
			r.Post("/auth/register", s.authHandler.Register)
			r.Post("/auth/login", s.authHandler.Login)
		}
		if s.googleAuthHandler != nil {
			r.Get("/auth/google/start", s.googleAuthHandler.Start)
			r.Get("/auth/google/callback", s.googleAuthHandler.Callback)
		}

		// Rotas protegidas por JWT
		if s.authSvc != nil {
			r.Group(func(protected chi.Router) {
				protected.Use(middleware.AuthMiddleware(s.authSvc))

				if s.authHandler != nil {
					protected.Get("/auth/me", s.authHandler.Me)
				}

				if s.calHandler != nil {
					protected.Route("/events", func(cr chi.Router) {
						cr.Post("/", s.calHandler.CreateEvent)
						cr.Get("/", s.calHandler.ListEvents)
						cr.Patch("/{id}", s.calHandler.UpdateEvent)
						cr.Delete("/{id}", s.calHandler.DeleteEvent)
					})
				}

				if s.todoHandler != nil {
					protected.Route("/todos", func(tr chi.Router) {
						tr.Post("/", s.todoHandler.CreateTodo)
						tr.Get("/", s.todoHandler.ListTodos)
						tr.Patch("/{id}/complete", s.todoHandler.CompleteTodo)
						tr.Delete("/{id}", s.todoHandler.DeleteTodo)
					})
				}

				if s.astHandler != nil {
					protected.Post("/assistant/chat", s.astHandler.Chat)
					protected.Post("/assistant/audio", s.astHandler.AudioChat)
					protected.Post("/assistant/vision", s.astHandler.VisionChat)
				}

				if s.notifHandler != nil {
					protected.Route("/notifications", func(nr chi.Router) {
						nr.Post("/device-token", s.notifHandler.RegisterDeviceToken)
						nr.Post("/test", s.notifHandler.SendTestNotification)
					})
				}

				if s.syncHandler != nil {
					protected.Route("/integrations/calendars", func(ir chi.Router) {
						ir.Get("/", s.syncHandler.ListIntegrations)
						ir.Post("/connect", s.syncHandler.ConnectIntegration)
						ir.Post("/{provider}/sync", s.syncHandler.SyncIntegration)
						ir.Delete("/{provider}", s.syncHandler.DisconnectIntegration)
						ir.Post("/google/webhook", s.syncHandler.GoogleWebhook)
					})
				}
			})
		}
	})
}

func (s *Server) handleHealthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)

	_ = json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "vito-backend",
		"version": "v0.1.3",
		"router":  "chi/v5",
	})
}

func (s *Server) handleHomePage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <title>Vito assistant</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="google-site-verification" content="PuSMriy69YLNFxqoXeHisikpyCA0Iw9XEKAvPY55vXM" />
</head>
<body style="font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #18181B; background: #FFFFFF;">
  <h1>Vito assistant</h1>
  <p>Secretário Executivo com Inteligência Artificial Pessoal e Familiar self-hosted.</p>
  <p><a href="/privacy">Política de Privacidade</a> | <a href="/terms">Termos de Uso</a></p>
</body>
</html>`))
}

func (s *Server) handlePrivacyPolicy(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Política de Privacidade — Vito assistant</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, sans-serif; max-width: 680px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #18181B; background: #FFFFFF;">
  <h1>Política de Privacidade do Vito assistant</h1>
  <p><strong>Última atualização:</strong> Outubro de 2026</p>
  <p>O <strong>Vito assistant</strong> é um assistente executivo pessoal e familiar projetado sob o princípio de <strong>privacidade total (Zero-Trust) e hospedagem própria (Self-Hosted)</strong>.</p>
  <h2>1. Coleta e Uso de Dados</h2>
  <p>O aplicativo conecta-se à sua conta Google para autenticação de identidade (Single Sign-On) e sincronização bidirecional de eventos no Google Calendar.</p>
  <h2>2. Armazenamento e Criptografia</h2>
  <p>Todos os tokens de autenticação do Google Calendar e dados de agenda são criptografados em repouso com o padrão militar <strong>AES-256-GCM</strong> e armazenados exclusivamente no seu próprio servidor local/privado.</p>
  <h2>3. Não Compartilhamento</h2>
  <p>Seus dados nunca são vendidos, compartilhados ou transferidos para terceiros nem usados para treinamento de modelos de inteligência artificial de forma não autorizada.</p>
  <h2>4. Exclusão de Dados</h2>
  <p>Você pode revogar o acesso a qualquer momento através do aplicativo na opção "Desconectar Google Calendar" ou pela página de permissões da sua Conta Google.</p>
  <p><a href="/">Voltar à Página Inicial</a></p>
</body>
</html>`))
}

func (s *Server) handleTermsOfService(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="utf-8"><title>Termos de Serviço — Vito assistant</title><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: system-ui, sans-serif; max-width: 680px; margin: 40px auto; padding: 20px; line-height: 1.6; color: #18181B; background: #FFFFFF;">
  <h1>Termos de Serviço do Vito assistant</h1>
  <p><strong>Última atualização:</strong> Outubro de 2026</p>
  <p>Ao utilizar o Vito assistant, você concorda com o uso da ferramenta para fins de gestão de compromissos, lembretes e tarefas pessoais.</p>
  <h2>Uso do Serviço</h2>
  <p>O serviço é fornecido no modelo self-hosted para gestão pessoal e familiar de compromissos.</p>
  <p><a href="/">Voltar à Página Inicial</a></p>
</body>
</html>`))
}
