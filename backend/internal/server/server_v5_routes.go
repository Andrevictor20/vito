package server

import "github.com/go-chi/chi/v5"

func (s *Server) registerV5Routes(protected chi.Router) {
	if s.notifInboxHandler != nil {
		protected.Route("/notifications", func(nr chi.Router) {
			if s.notifHandler != nil {
				nr.Get("/status", s.notifHandler.GetNotificationStatus)
				nr.Post("/device-token", s.notifHandler.RegisterDeviceToken)
				nr.Delete("/device-token", s.notifHandler.UnregisterDeviceToken)
				nr.Post("/test", s.notifHandler.SendTestNotification)
			}
			nr.Get("/", s.notifInboxHandler.ListNotifications)
			nr.Post("/read-all", s.notifInboxHandler.MarkAllRead)
			nr.Post("/{id}/action", s.notifInboxHandler.ExecuteAction)
			nr.Get("/preferences", s.notifInboxHandler.GetPreferences)
			nr.Put("/preferences", s.notifInboxHandler.UpdatePreferences)
		})
	} else if s.notifHandler != nil {
		protected.Route("/notifications", func(nr chi.Router) {
			nr.Get("/status", s.notifHandler.GetNotificationStatus)
			nr.Post("/device-token", s.notifHandler.RegisterDeviceToken)
			nr.Delete("/device-token", s.notifHandler.UnregisterDeviceToken)
			nr.Post("/test", s.notifHandler.SendTestNotification)
		})
	}

	if s.storeComplianceHandler != nil {
		protected.Route("/billing", func(br chi.Router) {
			br.Get("/subscription", s.storeComplianceHandler.GetSubscription)
			br.Post("/subscription", s.storeComplianceHandler.UpdateSubscription)
			br.Post("/restore", s.storeComplianceHandler.RestoreSubscription)
		})
		protected.Get("/privacy/settings", s.storeComplianceHandler.GetPrivacySettings)
		protected.Put("/privacy/settings", s.storeComplianceHandler.UpdatePrivacySettings)
		protected.Post("/account/export", s.storeComplianceHandler.ExportAccount)
		protected.Post("/account/delete", s.storeComplianceHandler.DeleteAccount)
		protected.Post("/support/contact", s.storeComplianceHandler.ContactSupport)
		protected.Post("/ai/report", s.storeComplianceHandler.ReportAIContent)
	}
}
