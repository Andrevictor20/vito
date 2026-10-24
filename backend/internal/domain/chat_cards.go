package domain

// ChatWhatsAppMessage representa o payload estruturado para renderização do card de WhatsApp no chat.
type ChatWhatsAppMessage struct {
	ID             string `json:"id,omitempty"`
	RecipientName  string `json:"recipient_name"`
	RecipientPhone string `json:"recipient_phone,omitempty"`
	RecipientPhoto string `json:"recipient_photo,omitempty"`
	Message        string `json:"message"`
	Status         string `json:"status,omitempty"` // "draft", "ready", "sent", "cancelled"
	SentAt         string `json:"sent_at,omitempty"`
}

// ChatGmailMessage representa o payload estruturado para renderização do card de Gmail no chat.
type ChatGmailMessage struct {
	ID             string `json:"id,omitempty"`
	RecipientName  string `json:"recipient_name,omitempty"`
	RecipientEmail string `json:"recipient_email"`
	Subject        string `json:"subject"`
	Body           string `json:"body"`
	Status         string `json:"status,omitempty"` // "draft", "ready", "sent", "cancelled"
	SentAt         string `json:"sent_at,omitempty"`
}
