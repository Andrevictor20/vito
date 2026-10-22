package domain

import (
	"context"
	"errors"
	"time"
)

var (
	ErrWhatsAppIntegrationNotFound = errors.New("integração do WhatsApp não encontrada")
	ErrWhatsAppInvalidPhone        = errors.New("número de telefone inválido para WhatsApp")
	ErrWhatsAppAlreadyConnecting   = errors.New("já existe uma tentativa de conexão em andamento")
)

const (
	WhatsAppStatusDisconnected = "disconnected"
	WhatsAppStatusConnecting   = "connecting"
	WhatsAppStatusConnected    = "connected"
)

// WhatsAppIntegration armazena os dados da sessão do WhatsApp via Evolution API.
type WhatsAppIntegration struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	InstanceName    string     `json:"instance_name"`
	Phone           string     `json:"phone,omitempty"`
	Status          string     `json:"status"` // "disconnected", "connecting", "connected"
	PairingCode     string     `json:"pairing_code,omitempty"`
	LastConnectedAt *time.Time `json:"last_connected_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// WhatsAppRepository define o contrato de persistência para as sessões do WhatsApp.
type WhatsAppRepository interface {
	GetByUserID(ctx context.Context, userID string) (*WhatsAppIntegration, error)
	GetByInstanceName(ctx context.Context, instanceName string) (*WhatsAppIntegration, error)
	GetByPhone(ctx context.Context, phone string) (*WhatsAppIntegration, error)
	FindConnectedInstance(ctx context.Context) (*WhatsAppIntegration, error)
	ListAll(ctx context.Context) ([]WhatsAppIntegration, error)
	Upsert(ctx context.Context, integration *WhatsAppIntegration) error
	UpdateStatus(ctx context.Context, id string, status string, lastConnectedAt *time.Time) error
	Delete(ctx context.Context, userID string) error
}

// Tipos de conversa: definem quais contextos podem ser cruzados (ver SPEC §2.1).
const (
	WhatsAppChatKindSelf      = "self"       // conversa comigo mesmo ("Você")
	WhatsAppChatKindSelfGroup = "self_group" // grupo do WhatsApp com apenas o usuário
	WhatsAppChatKindGroup     = "group"      // grupo com outras pessoas
	WhatsAppChatKindDirect    = "direct"     // 1-on-1 com terceiro
)

// Escopos de contexto configuráveis pelo usuário (SPEC §6.2).
const (
	WhatsAppContextScopeOff    = "off"    // nenhum contexto
	WhatsAppContextScopeQuoted = "quoted" // apenas a mensagem citada
	WhatsAppContextScopeChat   = "chat"   // apenas o chat atual
	WhatsAppContextScopeAll    = "all"    // chat atual + demais chats
)

// WhatsAppConversationMessage é uma mensagem arquivada do WhatsApp (shadow inbox).
type WhatsAppConversationMessage struct {
	ID               string    `json:"id"`
	UserID           string    `json:"user_id"`
	InstanceName     string    `json:"instance_name"`
	ChatJID          string    `json:"chat_jid"`
	ChatKind         string    `json:"chat_kind"`
	ChatLabel        string    `json:"chat_label"`
	SenderJID        string    `json:"sender_jid"`
	SenderName       string    `json:"sender_name"`
	FromMe           bool      `json:"from_me"`
	Kind             string    `json:"kind"`
	Text             string    `json:"text"`
	QuotedText       string    `json:"quoted_text"`
	MessageTimestamp time.Time `json:"message_timestamp"`
	CreatedAt        time.Time `json:"created_at"`
	// MediaKind/MediaMime descrevem a mídia da mensagem (image, audio, ...).
	MediaKind string `json:"media_kind,omitempty"`
	MediaMime string `json:"media_mime,omitempty"`
	// MediaStatus marca o estado do enriquecimento: none | pending | done | failed.
	MediaStatus string `json:"media_status,omitempty"`
	// MediaText é o conteúdo lido da mídia: transcrição (áudio) ou descrição (imagem).
	MediaText string `json:"media_text,omitempty"`
	// MediaPayload é o envelope {key,message} da Evolution — o que permite
	// baixar a mídia DEPOIS (a foto antiga só é legível se a referência for guardada).
	MediaPayload string `json:"media_payload,omitempty"`
	// QuotedID é o stanzaId da mensagem citada ("responder a esta mensagem").
	QuotedID string `json:"quoted_id,omitempty"`
}

// Estados do enriquecimento de mídia do WhatsApp.
const (
	WhatsAppMediaStatusNone    = ""
	WhatsAppMediaStatusPending = "pending"
	WhatsAppMediaStatusDone    = "done"
	WhatsAppMediaStatusFailed  = "failed"
)

// Tipos de mídia reconhecidos no WhatsApp.
const (
	WhatsAppMediaKindImage = "image"
	WhatsAppMediaKindAudio = "audio"
)

// WhatsAppContextSettings guarda as preferências de contexto do usuário.
type WhatsAppContextSettings struct {
	UserID     string    `json:"user_id"`
	Scope      string    `json:"scope"`
	WindowSize int       `json:"window_size"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// WhatsAppChatSummary resume uma conversa do WhatsApp (última mensagem + volume)
// para o diretório de contatos e a lista de pendências.
type WhatsAppChatSummary struct {
	ChatJID      string    `json:"chat_jid"`
	ChatLabel    string    `json:"chat_label"`
	ChatKind     string    `json:"chat_kind"`
	LastText     string    `json:"last_text"`
	LastSender   string    `json:"last_sender"`
	LastFromMe   bool      `json:"last_from_me"`
	LastAt       time.Time `json:"last_at"`
	MessageCount int       `json:"message_count"`
}

// WhatsAppPendingState controla a cobrança de uma pendência de resposta.
//
// A pendência em si é DERIVADA (última mensagem do chat não é do usuário);
// aqui fica só o estado de cobrança, para não martelar o mesmo assunto.
type WhatsAppPendingState struct {
	UserID       string     `json:"user_id"`
	ChatJID      string     `json:"chat_jid"`
	LastNudgedAt *time.Time `json:"last_nudged_at,omitempty"`
	SnoozedUntil *time.Time `json:"snoozed_until,omitempty"`
	DismissedAt  *time.Time `json:"dismissed_at,omitempty"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// WhatsAppConversationRepository persiste as mensagens arquivadas e as preferências de escopo.
type WhatsAppConversationRepository interface {
	SaveMessage(ctx context.Context, msg *WhatsAppConversationMessage) error
	RecentMessages(ctx context.Context, userID, chatJID string, limit int, since time.Time) ([]WhatsAppConversationMessage, error)
	RecentMessagesAcrossChats(ctx context.Context, userID string, limit int, since time.Time) ([]WhatsAppConversationMessage, error)
	RecentMessagesByKind(ctx context.Context, userID, chatKind string, limit int, since time.Time) ([]WhatsAppConversationMessage, error)
	RecentChats(ctx context.Context, userID string, since time.Time, limit int) ([]WhatsAppChatSummary, error)
	CountMessages(ctx context.Context, userID string, since time.Time) (int64, error)
	UpdateChatLabels(ctx context.Context, userID string, labels map[string]string) (int64, error)
	// MessageByID busca uma mensagem arquivada pelo id (usado para resolver a
	// mensagem citada/"responder a esta mensagem").
	MessageByID(ctx context.Context, userID, id string) (*WhatsAppConversationMessage, error)
	// PendingMedia devolve mensagens com mídia ainda não analisada, mais antigas
	// primeiro (o worker de enriquecimento consome nessa ordem).
	PendingMedia(ctx context.Context, userID string, limit int, since time.Time) ([]WhatsAppConversationMessage, error)
	// MediaStatus conta as mídias do usuário por estado (none/pending/done/failed).
	MediaStatus(ctx context.Context, userID string, since time.Time) (map[string]int64, error)
	// UpdateMediaResult grava o resultado do enriquecimento de uma mídia.
	UpdateMediaResult(ctx context.Context, userID, id, status, text string) error
	// SearchMessages busca no histórico por conteúdo (texto + descrição de mídia).
	SearchMessages(ctx context.Context, userID, query string, limit int) ([]WhatsAppConversationMessage, error)
	// SenderNamesByChat devolve o nome de PERFIL (pushName) mais recente de cada
	// chat. É a fonte confiável do nome que a pessoa escolheu no WhatsApp — o
	// `findContacts` da Evolution costuma devolver o pushName vazio.
	SenderNamesByChat(ctx context.Context, userID string, since time.Time) (map[string]string, error)
	GetPendingState(ctx context.Context, userID, chatJID string) (*WhatsAppPendingState, error)
	SavePendingState(ctx context.Context, state *WhatsAppPendingState) error
	GetContextSettings(ctx context.Context, userID string) (*WhatsAppContextSettings, error)
	SaveContextSettings(ctx context.Context, settings *WhatsAppContextSettings) error
	DeleteMessages(ctx context.Context, userID string) error
	PruneOlderThan(ctx context.Context, cutoff time.Time) (int64, error)
}
