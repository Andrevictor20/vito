package server

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
)

// Server encapsula o roteador Chi e dependências HTTP do Vito.
type Server struct {
	router            *chi.Mux
	allowedOrigins    []string
	environment       string
	authHandler       *handler.AuthHandler
	googleAuthHandler *handler.GoogleAuthHandler
	calHandler        *handler.CalendarHandler
	todoHandler       *handler.TodoHandler
	astHandler        *handler.AssistantHandler
	notifHandler      *handler.NotificationHandler
	syncHandler       *handler.CalendarSyncHandler
	triggerHandler    *handler.TriggerHandler
	briefingHandler   *handler.BriefingHandler
	aiSettingsHandler *handler.AISettingsHandler
	pendingHandler    *handler.PendingHandler
	bookingHandler    *handler.BookingHandler
	meetingHandler    *handler.MeetingHandler
	p2pHandler        *handler.P2PMeetingHandler
	chatHandler         *handler.ChatHandler
	whatsappHandler     *handler.WhatsAppHandler
	gmailHandler        *handler.GmailHandler
	whatsappAuthHandler *handler.WhatsAppAuthHandler
	authSvc             *service.AuthService
}

// Config contém as dependências necessárias para inicializar o Server.
type Config struct {
	// Environment espelha APP_ENV (development/production) para o fail-closed do CORS.
	Environment       string
	AuthHandler       *handler.AuthHandler
	GoogleAuthHandler *handler.GoogleAuthHandler
	CalHandler        *handler.CalendarHandler
	TodoHandler       *handler.TodoHandler
	AstHandler        *handler.AssistantHandler
	NotifHandler      *handler.NotificationHandler
	SyncHandler       *handler.CalendarSyncHandler
	TriggerHandler    *handler.TriggerHandler
	BriefingHandler   *handler.BriefingHandler
	AISettingsHandler *handler.AISettingsHandler
	PendingHandler    *handler.PendingHandler
	BookingHandler    *handler.BookingHandler
	MeetingHandler      *handler.MeetingHandler
	P2PHandler          *handler.P2PMeetingHandler
	ChatHandler         *handler.ChatHandler
	WhatsAppHandler     *handler.WhatsAppHandler
	GmailHandler        *handler.GmailHandler
	WhatsAppAuthHandler *handler.WhatsAppAuthHandler
	AuthSvc             *service.AuthService
	// AllowedOrigins restringe o CORS (SEC-03). Vazio = ["*"] apenas fora
	// de produção (dev/testes); em produção, vazio nega origens (fail-closed).
	AllowedOrigins []string
}

// New instancia o servidor com o roteador Chi, middlewares e rotas registrados.
func New(cfg ...Config) *Server {
	s := &Server{
		router: chi.NewRouter(),
	}

	if len(cfg) > 0 {
		s.allowedOrigins = cfg[0].AllowedOrigins
		s.environment = cfg[0].Environment
		s.authHandler = cfg[0].AuthHandler
		s.googleAuthHandler = cfg[0].GoogleAuthHandler
		s.calHandler = cfg[0].CalHandler
		s.todoHandler = cfg[0].TodoHandler
		s.astHandler = cfg[0].AstHandler
		s.notifHandler = cfg[0].NotifHandler
		s.syncHandler = cfg[0].SyncHandler
		s.triggerHandler = cfg[0].TriggerHandler
		s.briefingHandler = cfg[0].BriefingHandler
		s.aiSettingsHandler = cfg[0].AISettingsHandler
		s.pendingHandler = cfg[0].PendingHandler
		s.bookingHandler = cfg[0].BookingHandler
		s.meetingHandler = cfg[0].MeetingHandler
		s.p2pHandler = cfg[0].P2PHandler
		s.chatHandler = cfg[0].ChatHandler
		s.whatsappHandler = cfg[0].WhatsAppHandler
		s.gmailHandler = cfg[0].GmailHandler
		s.whatsappAuthHandler = cfg[0].WhatsAppAuthHandler
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
	s.router.Use(middleware.BodyLimitMiddleware)

	// CORS restrito por ambiente (SEC-03): env explícito, PublicBaseURL em produção, * em dev.
	// Em produção sem origens, o handler nem é instalado (o go-chi/cors trata
	// lista vazia como allow-all): navegadores bloqueiam tudo (fail-closed) e
	// o app nativo segue normal, pois não usa CORS.
	origins := s.allowedOrigins
	if len(origins) == 0 && !strings.EqualFold(s.environment, "production") {
		origins = []string{"*"}
	}
	if len(origins) == 0 {
		return
	}
	s.router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   origins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
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
	s.router.Get("/.well-known/assetlinks.json", s.handleAssetLinks)
	s.router.Get("/.well-known/apple-app-site-association", s.handleAppleAppSiteAssociation)
	s.router.Get("/apple-app-site-association", s.handleAppleAppSiteAssociation)

	bookingLimiter := middleware.NewRateLimiter(60, 1*time.Minute)
	if s.bookingHandler != nil {
		s.router.Group(func(pub chi.Router) {
			pub.Use(bookingLimiter)
			pub.Get("/book/{username}/{slug}", s.bookingHandler.ServePublicPage)
			pub.Get("/api/public/book/{username}/{slug}/slots", s.bookingHandler.GetPublicSlots)
			pub.Post("/api/public/book/{username}/{slug}/reserve", s.bookingHandler.ReservePublicSlot)
		})
	}

	meetingLimiter := middleware.NewRateLimiter(60, 1*time.Minute)
	if s.meetingHandler != nil {
		s.router.Group(func(pub chi.Router) {
			pub.Use(meetingLimiter)
			pub.Get("/meet/{id}", s.meetingHandler.ServePublicPage)
			pub.Get("/api/public/meet/{id}", s.meetingHandler.GetPublicMeeting)
			pub.Post("/api/public/meet/{id}/vote", s.meetingHandler.SubmitPublicVote)
		})
	}
	if s.p2pHandler != nil {
		s.router.Group(func(pub chi.Router) {
			pub.Use(meetingLimiter)
			pub.Get("/verify-phone/{token}", s.p2pHandler.VerifyPhonePublicPage)
		})
	}

	authLimiter := middleware.NewRateLimiter(10, 1*time.Minute)
	aiLimiter := middleware.NewRateLimiter(30, 1*time.Minute)
	// Rate limit global da API (SEC-05): 120 req/min por IP/usuário, além dos estritos.
	apiLimiter := middleware.NewRateLimiter(120, 1*time.Minute)

	s.router.Route("/api/v1", func(r chi.Router) {
		r.Use(apiLimiter)
		// Rotas públicas de autenticação com proteção anti-bruteforce
		if s.authHandler != nil {
			r.Group(func(ar chi.Router) {
				ar.Use(authLimiter)
				ar.Post("/auth/register", s.authHandler.Register)
				ar.Post("/auth/login", s.authHandler.Login)
				ar.Post("/auth/refresh", s.authHandler.Refresh)
				if s.whatsappAuthHandler != nil {
					ar.Post("/auth/whatsapp/request-otp", s.whatsappAuthHandler.RequestOTP)
					ar.Post("/auth/whatsapp/verify-otp", s.whatsappAuthHandler.VerifyOTP)
				}
			})
		}
		if s.googleAuthHandler != nil {
			r.Get("/auth/google/start", s.googleAuthHandler.Start)
			r.Get("/auth/google/callback", s.googleAuthHandler.Callback)
		}

		if s.p2pHandler != nil {
			r.Get("/contacts/challenge", s.p2pHandler.GetChallenge)
			r.Post("/contacts/match", s.p2pHandler.MatchContacts)
		}

		if s.whatsappHandler != nil {
			r.Post("/integrations/whatsapp/webhook", s.whatsappHandler.Webhook)
		}

		if s.triggerHandler != nil {
			r.Route("/triggers", func(tr chi.Router) {
				tr.Get("/templates", s.triggerHandler.ListTemplates)

				tr.Group(func(ptr chi.Router) {
					if s.authSvc != nil {
						ptr.Use(middleware.AuthMiddleware(s.authSvc))
					}
					ptr.Post("/", s.triggerHandler.CreateTrigger)
					ptr.Get("/", s.triggerHandler.ListTriggers)
					ptr.Post("/templates/{id}/activate", s.triggerHandler.ActivateTemplate)
					ptr.Post("/parse", s.triggerHandler.ParsePrompt)
					ptr.Route("/{id}", func(idr chi.Router) {
						idr.Get("/", s.triggerHandler.GetTrigger)
						idr.Patch("/", s.triggerHandler.UpdateTrigger)
						idr.Delete("/", s.triggerHandler.DeleteTrigger)
						idr.Patch("/toggle", s.triggerHandler.ToggleStatus)
						idr.Post("/test", s.triggerHandler.TestTrigger)
						idr.Post("/run", s.triggerHandler.RunTrigger)
						idr.Get("/logs", s.triggerHandler.ListLogs)
						idr.Delete("/logs", s.triggerHandler.ClearLogs)
						idr.Delete("/logs/{logId}", s.triggerHandler.DeleteLog)
					})
				})
			})
		}

		// Rotas protegidas por JWT
		if s.authSvc != nil {
			r.Group(func(protected chi.Router) {
				protected.Use(middleware.AuthMiddleware(s.authSvc))

				if s.authHandler != nil {
					protected.Get("/auth/me", s.authHandler.Me)
					protected.Get("/auth/sessions", s.authHandler.ListSessions)
					protected.Delete("/auth/sessions/{id}", s.authHandler.RevokeSession)
					protected.Post("/auth/logout", s.authHandler.Logout)
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
						tr.Patch("/{id}", s.todoHandler.UpdateTodo)
						tr.Patch("/{id}/complete", s.todoHandler.CompleteTodo)
						tr.Patch("/{id}/reopen", s.todoHandler.ReopenTodo)
						tr.Delete("/{id}", s.todoHandler.DeleteTodo)
						tr.Post("/{id}/subtasks", s.todoHandler.AddSubtask)
						tr.Patch("/{id}/subtasks/{subtaskId}/toggle", s.todoHandler.ToggleSubtask)
						tr.Delete("/{id}/subtasks/{subtaskId}", s.todoHandler.DeleteSubtask)
					})
				}

				if s.astHandler != nil {
					protected.Group(func(air chi.Router) {
						air.Use(aiLimiter)
						air.Post("/assistant/chat", s.astHandler.Chat)
						air.Post("/assistant/audio", s.astHandler.AudioChat)
						air.Post("/assistant/vision", s.astHandler.VisionChat)
					})
				}


				if s.notifHandler != nil {
					protected.Route("/notifications", func(nr chi.Router) {
						nr.Get("/status", s.notifHandler.GetNotificationStatus)
						nr.Post("/device-token", s.notifHandler.RegisterDeviceToken)
						nr.Delete("/device-token", s.notifHandler.UnregisterDeviceToken)
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

				if s.whatsappHandler != nil {
					protected.Route("/integrations/whatsapp", func(wr chi.Router) {
						wr.Get("/status", s.whatsappHandler.GetStatus)
						wr.Post("/pairing-code", s.whatsappHandler.RequestPairingCode)
						wr.Delete("/disconnect", s.whatsappHandler.Disconnect)
						wr.Get("/contacts", s.whatsappHandler.GetContacts)
					})
				}

				if s.gmailHandler != nil {
					protected.Route("/integrations/gmail", func(gr chi.Router) {
						gr.Get("/status", s.gmailHandler.GetStatus)
						gr.Post("/scan", s.gmailHandler.ScanEmails)
						gr.Delete("/disconnect", s.gmailHandler.Disconnect)
						gr.Post("/draft", s.gmailHandler.CreateDraft)
					})
				}



				if s.briefingHandler != nil {
					protected.Route("/users/briefing", func(br chi.Router) {
						br.Get("/", s.briefingHandler.GetSettings)
						br.Put("/", s.briefingHandler.UpdateSettings)
					})
				}

				if s.aiSettingsHandler != nil {
					protected.Route("/users/ai-settings", func(air chi.Router) {
						air.Get("/", s.aiSettingsHandler.GetSettings)
						air.Put("/", s.aiSettingsHandler.UpdateSettings)
					})
				}

				if s.pendingHandler != nil {
					protected.Route("/pending", func(pr chi.Router) {
						pr.Get("/", s.pendingHandler.ListPending)
						pr.Post("/", s.pendingHandler.CreatePending)
						pr.Get("/{id}", s.pendingHandler.GetPending)
						pr.Patch("/{id}", s.pendingHandler.UpdatePending)
						pr.Post("/{id}/schedule", s.pendingHandler.SchedulePending)
						pr.Post("/{id}/complete", s.pendingHandler.CompletePending)
						pr.Delete("/{id}", s.pendingHandler.DeletePending)
					})
				}

				if s.bookingHandler != nil {
					protected.Route("/booking", func(br chi.Router) {
						br.Get("/types", s.bookingHandler.ListTypes)
						br.Post("/types", s.bookingHandler.CreateType)
						br.Put("/types/{id}", s.bookingHandler.UpdateType)
						br.Delete("/types/{id}", s.bookingHandler.DeleteType)
						br.Get("/appointments", s.bookingHandler.ListAppointments)
						br.Delete("/appointments/{id}", s.bookingHandler.DeleteAppointment)
					})
				}

				if s.meetingHandler != nil {
					protected.Route("/meetings", func(mr chi.Router) {
						mr.Get("/", s.meetingHandler.ListMeetings)
						mr.Post("/", s.meetingHandler.CreateMeeting)
						mr.Get("/{id}", s.meetingHandler.GetMeeting)
						mr.Put("/{id}", s.meetingHandler.UpdateMeeting)
						mr.Patch("/{id}", s.meetingHandler.UpdateMeeting)
						mr.Delete("/{id}", s.meetingHandler.DeleteMeeting)
						mr.Post("/{id}/confirm", s.meetingHandler.ConfirmConsensus)
						mr.Get("/{id}/share", s.meetingHandler.GetWhatsAppShare)
					})
				}

				if s.whatsappAuthHandler != nil {
					protected.Post("/auth/whatsapp/link", s.whatsappAuthHandler.LinkPhone)
				}

				if s.p2pHandler != nil {
					protected.Post("/users/phone", s.p2pHandler.UpdatePhone)
					protected.Post("/users/phone/request-verification", s.p2pHandler.RequestPhoneVerification)
					protected.Post("/users/phone/verify", s.p2pHandler.VerifyPhoneCode)
					protected.Route("/meetings/p2p", func(p2pr chi.Router) {
						p2pr.Get("/mutual-slots", s.p2pHandler.GetMutualSlots)
						p2pr.Post("/invite", s.p2pHandler.SendInvite)
						p2pr.Get("/invites/pending", s.p2pHandler.ListPendingInvites)
						p2pr.Get("/invites", s.p2pHandler.ListUserInvites)
						p2pr.Post("/invites/{id}/accept", s.p2pHandler.AcceptInvite)
						p2pr.Post("/invites/{id}/decline", s.p2pHandler.DeclineInvite)
						p2pr.Post("/invites/{id}/cancel", s.p2pHandler.CancelInvite)
					})
				}

				if s.chatHandler != nil {
					protected.Route("/chat", func(cr chi.Router) {
						cr.Get("/sessions", s.chatHandler.ListSessions)
						cr.Get("/sessions/{id}", s.chatHandler.GetSessionMessages)
						cr.Post("/sync", s.chatHandler.SyncSession)
						cr.Delete("/sessions/{id}", s.chatHandler.DeleteSession)
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
