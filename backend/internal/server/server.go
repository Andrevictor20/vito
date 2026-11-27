package server

import (
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/andrevmp/vito/backend/internal/bots"
	"github.com/andrevmp/vito/backend/internal/calendar"
	"github.com/andrevmp/vito/backend/internal/calendar/booking"
	"github.com/andrevmp/vito/backend/internal/calendar/meeting"
	"github.com/andrevmp/vito/backend/internal/calendar/p2p"
	calsync "github.com/andrevmp/vito/backend/internal/calendar/sync"
	"github.com/andrevmp/vito/backend/internal/finance"
	"github.com/andrevmp/vito/backend/internal/gmail"
	"github.com/andrevmp/vito/backend/internal/handler"
	"github.com/andrevmp/vito/backend/internal/handler/middleware"
	"github.com/andrevmp/vito/backend/internal/service"
	"github.com/andrevmp/vito/backend/internal/tasks"
	"github.com/andrevmp/vito/backend/internal/whatsapp"
	waauth "github.com/andrevmp/vito/backend/internal/whatsapp/auth"
)

// Server encapsula o roteador Chi e dependências HTTP do Vito.
type Server struct {
	router *chi.Mux
	cfg    Config
}

// Config contém as dependências necessárias para inicializar o Server.
type Config struct {
	// Environment espelha APP_ENV (development/production) para o fail-closed do CORS.
	Environment             string
	AuthHandler             *handler.AuthHandler
	GoogleAuthHandler       *handler.GoogleAuthHandler
	CalHandler              *calendar.CalendarHandler
	TodoHandler             *tasks.TodoHandler
	AstStreamHandler        *handler.AssistantStreamHandler
	MemoryHandler           *handler.MemoryHandler
	NotifHandler            *handler.NotificationHandler
	NotifInboxHandler       *handler.NotificationsInboxHandler
	StoreComplianceHandler  *handler.StoreComplianceHandler
	SyncHandler             *calsync.CalendarSyncHandler
	BotHandler              *bots.BotHandler
	BriefingHandler         *handler.BriefingHandler
	AISettingsHandler       *handler.AISettingsHandler
	AIProviderHandler       *handler.AIProviderHandler
	PendingHandler          *tasks.PendingHandler
	BookingHandler          *booking.BookingHandler
	MeetingHandler          *meeting.MeetingHandler
	P2PHandler              *p2p.P2PMeetingHandler
	ChatHandler             *handler.ChatHandler
	WhatsAppHandler         *whatsapp.WhatsAppHandler
	GmailHandler            *gmail.GmailHandler
	WhatsAppAuthHandler     *waauth.WhatsAppAuthHandler
	VoiceHandler            *handler.VoiceStreamHandler
	VoiceTTSHandler         *handler.VoiceTTSHandler
	FinanceHandler          *finance.FinanceHandler
	FinanceLimitHandler     *finance.FinanceLimitHandler
	FinanceAnalyticsHandler *finance.FinanceAnalyticsHandler
	AuthSvc                 *service.AuthService
	// AllowedOrigins restringe o CORS (SEC-03). Vazio = ["*"] apenas fora
	// de produção (dev/testes); em produção, vazio nega origens (fail-closed).
	AllowedOrigins []string
}

// New instancia o servidor com o roteador Chi, middlewares e rotas registrados.
func New(cfg ...Config) *Server {
	s := &Server{router: chi.NewRouter()}
	if len(cfg) > 0 {
		s.cfg = cfg[0]
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

	// CORS restrito por ambiente (SEC-03): fail-closed em produção sem origens configuradas.
	origins := s.cfg.AllowedOrigins
	if len(origins) == 0 && !strings.EqualFold(s.cfg.Environment, "production") {
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
	c := s.cfg

	s.router.Get("/", s.handleHomePage)
	s.router.Get("/healthz", s.handleHealthCheck)
	s.router.Get("/privacy", s.handlePrivacyPolicy)
	s.router.Get("/terms", s.handleTermsOfService)
	s.router.Get("/.well-known/assetlinks.json", s.handleAssetLinks)
	s.router.Get("/.well-known/apple-app-site-association", s.handleAppleAppSiteAssociation)
	s.router.Get("/apple-app-site-association", s.handleAppleAppSiteAssociation)

	if c.VoiceHandler != nil {
		s.router.Group(func(vr chi.Router) {
			if c.AuthSvc != nil {
				vr.Use(middleware.AuthMiddleware(c.AuthSvc))
			}
			vr.Handle("/v1/voice/stream", c.VoiceHandler.Handler())
			vr.Handle("/api/v1/voice/stream", c.VoiceHandler.Handler())
		})
	}

	bookingLimiter := middleware.NewRateLimiter(60, 1*time.Minute)
	if c.BookingHandler != nil {
		s.router.Group(func(pub chi.Router) {
			pub.Use(bookingLimiter)
			c.BookingHandler.RegisterPublicRoutes(pub)
		})
	}

	meetingLimiter := middleware.NewRateLimiter(60, 1*time.Minute)
	if c.MeetingHandler != nil || c.P2PHandler != nil {
		s.router.Group(func(pub chi.Router) {
			pub.Use(meetingLimiter)
			c.MeetingHandler.RegisterPublicRoutes(pub)
			c.P2PHandler.RegisterPublicRoutes(pub)
		})
	}

	authLimiter := middleware.NewRateLimiter(10, 1*time.Minute)
	aiLimiter := middleware.NewRateLimiter(30, 1*time.Minute)
	apiLimiter := middleware.NewRateLimiter(120, 1*time.Minute)

	s.router.Route("/api/v1", func(apiRouter chi.Router) {
		// Webhooks internos da Evolution API fora do rate limiter global (SEC-05).
		c.WhatsAppHandler.RegisterWebhookRoutes(apiRouter)

		apiRouter.Group(func(r chi.Router) {
			r.Use(apiLimiter)

			if c.AuthHandler != nil || c.WhatsAppAuthHandler != nil {
				r.Group(func(ar chi.Router) {
					ar.Use(authLimiter)
					c.AuthHandler.RegisterPublicRoutes(ar)
					c.WhatsAppAuthHandler.RegisterPublicRoutes(ar)
				})
			}
			c.GoogleAuthHandler.RegisterRoutes(r)
			c.P2PHandler.RegisterContactsRoutes(r)

			if c.AuthSvc != nil {
				r.Group(func(protected chi.Router) {
					protected.Use(middleware.AuthMiddleware(c.AuthSvc))

					c.AuthHandler.RegisterProtectedRoutes(protected)
					c.CalHandler.RegisterRoutes(protected)
					c.TodoHandler.RegisterRoutes(protected)
					if c.AstStreamHandler != nil {
						protected.Group(func(air chi.Router) {
							air.Use(aiLimiter)
							c.AstStreamHandler.RegisterRoutes(air)
						})
					}
					c.MemoryHandler.RegisterRoutes(protected)
					c.VoiceTTSHandler.RegisterRoutes(protected)
					c.SyncHandler.RegisterRoutes(protected)
					c.WhatsAppHandler.RegisterRoutes(protected)
					c.GmailHandler.RegisterRoutes(protected)
					c.BriefingHandler.RegisterRoutes(protected)
					c.AISettingsHandler.RegisterRoutes(protected)
					c.PendingHandler.RegisterRoutes(protected)
					c.BookingHandler.RegisterRoutes(protected)
					c.MeetingHandler.RegisterRoutes(protected)
					c.WhatsAppAuthHandler.RegisterProtectedRoutes(protected)
					c.P2PHandler.RegisterRoutes(protected)
					c.ChatHandler.RegisterRoutes(protected)
					finance.RegisterRoutes(protected, c.FinanceHandler, c.FinanceLimitHandler, c.FinanceAnalyticsHandler)
					c.BotHandler.RegisterRoutes(protected)
					c.AIProviderHandler.RegisterRoutes(protected)
					handler.RegisterNotificationRoutes(protected, c.NotifHandler, c.NotifInboxHandler)
					c.StoreComplianceHandler.RegisterRoutes(protected)
				})
			}
		})
	})
}
