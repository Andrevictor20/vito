package handler

import "github.com/go-chi/chi/v5"

// RegisterPublicRoutes registra os endpoints públicos de autenticação por e-mail/senha e refresh JWT.
func (h *AuthHandler) RegisterPublicRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Post("/auth/register", h.Register)
	r.Post("/auth/login", h.Login)
	r.Post("/auth/refresh", h.Refresh)
}

// RegisterProtectedRoutes registra os endpoints autenticados da conta e sessões ativas.
func (h *AuthHandler) RegisterProtectedRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Get("/auth/me", h.Me)
	r.Get("/auth/sessions", h.ListSessions)
	r.Delete("/auth/sessions/{id}", h.RevokeSession)
	r.Post("/auth/logout", h.Logout)
}

// RegisterRoutes registra os endpoints OAuth Google (browser web e nativo Mobile).
func (h *GoogleAuthHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Get("/auth/google/start", h.Start)
	r.Get("/auth/google/callback", h.Callback)
	r.Post("/auth/google/native", h.NativeAuth)
}

// RegisterRoutes registra os endpoints do assistente conversacional, streaming SSE, voz e visão.
func (h *AssistantStreamHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Post("/assistant/chat", h.Chat)
	r.Post("/assistant/stream", h.Stream)
	r.Post("/assistant/chat/stream", h.Stream)
	r.Post("/assistant/confirm", h.Confirm)
	r.Post("/assistant/audio", h.AudioChat)
	r.Post("/assistant/vision", h.VisionChat)
}

// RegisterRoutes registra os endpoints de síntese de voz (TTS).
func (h *VoiceTTSHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Post("/voice/tts", h.HandleTTS)
}

// RegisterRoutes registra os endpoints de memórias de longo prazo.
func (h *MemoryHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/memories", func(mr chi.Router) {
		mr.Get("/", h.ListMemories)
		mr.Post("/facts", h.CreateFact)
		mr.Delete("/episodes/{id}", h.DeleteEpisode)
		mr.Delete("/themes/{slug}", h.DeleteThematicSummary)
		mr.Delete("/facts/{id}", h.DeleteFact)
	})
}

// RegisterRoutes registra as configurações de briefing matinal.
func (h *BriefingHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/users/briefing", func(br chi.Router) {
		br.Get("/", h.GetSettings)
		br.Put("/", h.UpdateSettings)
	})
}

// RegisterRoutes registra as configurações de personalidade e autonomia do assistente.
func (h *AISettingsHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/users/ai-settings", func(air chi.Router) {
		air.Get("/", h.GetSettings)
		air.Put("/", h.UpdateSettings)
	})
}

// RegisterRoutes registra o catálogo, testes e preferências de provedores de IA BYOK.
func (h *AIProviderHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/ai", func(air chi.Router) {
		air.Get("/providers", h.ListProviders)
		air.Put("/providers/{key}", h.ConnectProvider)
		air.Post("/providers/{key}/test", h.TestProvider)
		air.Delete("/providers/{key}", h.RemoveProvider)
		air.Get("/providers/{key}/models", h.GetProviderModels)
		air.Get("/models", h.ListSelectableModels)
		air.Get("/preferences", h.GetPreferences)
		air.Put("/preferences", h.UpdatePreferences)
	})
}

// RegisterRoutes registra o histórico de sessões de chat e preferência de modelo por thread.
func (h *ChatHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/chat", func(cr chi.Router) {
		cr.Get("/sessions", h.ListSessions)
		cr.Get("/sessions/{id}", h.GetSessionMessages)
		cr.Post("/sync", h.SyncSession)
		cr.Delete("/sessions/{id}", h.DeleteSession)
		cr.Post("/messages/feedback", h.RecordMessageFeedback)
	})
	r.Patch("/threads/{id}/model", h.UpdateThreadModelPref)
}

// RegisterRoutes registra as rotas de assinaturas, privacidade LGPD, suporte e denúncia de IA.
func (h *StoreComplianceHandler) RegisterRoutes(r chi.Router) {
	if h == nil {
		return
	}
	r.Route("/billing", func(br chi.Router) {
		br.Get("/subscription", h.GetSubscription)
		br.Post("/subscription", h.UpdateSubscription)
		br.Post("/restore", h.RestoreSubscription)
	})
	r.Get("/privacy/settings", h.GetPrivacySettings)
	r.Put("/privacy/settings", h.UpdatePrivacySettings)
	r.Post("/account/export", h.ExportAccount)
	r.Post("/account/delete", h.DeleteAccount)
	r.Post("/support/contact", h.ContactSupport)
	r.Post("/ai/report", h.ReportAIContent)
}

// RegisterNotificationRoutes registra as rotas de push devices e inbox/preferências de notificações.
func RegisterNotificationRoutes(r chi.Router, notifH *NotificationHandler, inboxH *NotificationsInboxHandler) {
	if notifH == nil && inboxH == nil {
		return
	}
	r.Route("/notifications", func(nr chi.Router) {
		if notifH != nil {
			nr.Get("/status", notifH.GetNotificationStatus)
			nr.Post("/device-token", notifH.RegisterDeviceToken)
			nr.Delete("/device-token", notifH.UnregisterDeviceToken)
			nr.Post("/test", notifH.SendTestNotification)
		}
		if inboxH != nil {
			nr.Get("/", inboxH.ListNotifications)
			nr.Post("/read-all", inboxH.MarkAllRead)
			nr.Post("/{id}/action", inboxH.ExecuteAction)
			nr.Get("/preferences", inboxH.GetPreferences)
			nr.Put("/preferences", inboxH.UpdatePreferences)
		}
	})
}
