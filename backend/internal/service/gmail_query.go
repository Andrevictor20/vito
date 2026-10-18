package service

import (
	"strings"
)

// ScanOptions define opções avançadas de busca e triagem de e-mails.
type ScanOptions struct {
	Query      string `json:"query,omitempty"`
	Folder     string `json:"folder,omitempty"`      // "primary" (padrão), "promotions", "social", "updates", "spam", "trash", "all"
	UnreadOnly bool   `json:"unread_only,omitempty"` // se true, filtra apenas mensagens não lidas
	Limit      int    `json:"limit,omitempty"`       // limite de mensagens a consultar (default 10, max 20)
}

// BuildGmailQuery compõe a query oficial para a Gmail API com base nas opções informadas.
func BuildGmailQuery(opts ScanOptions) string {
	if strings.TrimSpace(opts.Query) != "" {
		return strings.TrimSpace(opts.Query)
	}

	var parts []string
	folder := strings.ToLower(strings.TrimSpace(opts.Folder))
	switch folder {
	case "spam":
		parts = append(parts, "in:spam")
	case "trash", "lixeira", "lixo":
		parts = append(parts, "in:trash")
	case "promotions", "promocoes", "promoções", "promocao", "promoção":
		parts = append(parts, "category:promotions")
	case "social":
		parts = append(parts, "category:social")
	case "updates", "atualizacoes", "atualizações", "atualizacao", "atualização":
		parts = append(parts, "category:updates")
	case "forums", "foruns", "fóruns":
		parts = append(parts, "category:forums")
	case "all", "todas", "tudo":
		parts = append(parts, "in:anywhere -in:spam -in:trash")
	case "primary", "principal", "":
		parts = append(parts, "in:inbox category:primary")
	default:
		parts = append(parts, "in:inbox category:primary")
	}

	if opts.UnreadOnly {
		parts = append(parts, "is:unread")
	}

	return strings.Join(parts, " ")
}
