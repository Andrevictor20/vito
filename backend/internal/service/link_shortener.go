package service

import "context"

// LinkShortener define o contrato abstrato para serviços de encurtamento de links.
// Permite desacoplar implementações de terceiros (Short.io, rotas nativas, etc.)
// do fluxo de negócios do Vito Booking.
type LinkShortener interface {
	ShortenLink(ctx context.Context, targetURL, key string) (string, error)
}
