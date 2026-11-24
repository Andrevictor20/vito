package whatsapp

import "github.com/andrevmp/vito/backend/internal/whatsapp/evolution"

type EvolutionAPIClient = evolution.EvolutionAPIClient
type DefaultEvolutionClient = evolution.DefaultEvolutionClient
type EvolutionFindMessagesInput = evolution.EvolutionFindMessagesInput
type WhatsAppContact = evolution.WhatsAppContact
type WhatsAppChatMessage = evolution.WhatsAppChatMessage
type WhatsAppGroup = evolution.WhatsAppGroup
type QuotedRefEvolutionClient = evolution.QuotedRefEvolutionClient
type QuotedMessageRef = evolution.QuotedMessageRef

var NewDefaultEvolutionClient = evolution.NewDefaultEvolutionClient
var firstNonEmpty = evolution.FirstNonEmpty
var extractMessageText = evolution.ExtractMessageText
