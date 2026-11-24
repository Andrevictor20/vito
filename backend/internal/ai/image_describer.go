package ai

import (
	"context"
	"fmt"
	"strings"
	"time"
)

// ImageDescriber descreve uma imagem em texto puro (usado pelo enriquecimento do histórico do WhatsApp).
type ImageDescriber interface {
	DescribeImage(ctx context.Context, imageB64, imageMime, prompt string) (string, error)
}

// ChatContactSummary resume um contato ou conversa recente do WhatsApp para o diretório e toolsets.
type ChatContactSummary struct {
	Name    string `json:"name"`
	Alias   string `json:"alias,omitempty"`
	Preview string `json:"preview,omitempty"`
	Age     string `json:"age,omitempty"`
	Pending bool   `json:"pending,omitempty"`
}

// ChatMessageContext representa uma mensagem de contexto de conversa (WhatsApp / Chat).
type ChatMessageContext struct {
	Sender string `json:"sender"`
	Text   string `json:"text"`
	Chat   string `json:"chat,omitempty"`
	Quoted string `json:"quoted,omitempty"`
	Kind   string `json:"kind,omitempty"`
}

// WeekdayPT retorna o nome do dia da semana em português.
func WeekdayPT(wd time.Weekday) string {
	switch wd {
	case time.Sunday:
		return "Domingo"
	case time.Monday:
		return "Segunda-feira"
	case time.Tuesday:
		return "Terça-feira"
	case time.Wednesday:
		return "Quarta-feira"
	case time.Thursday:
		return "Quinta-feira"
	case time.Friday:
		return "Sexta-feira"
	case time.Saturday:
		return "Sábado"
	default:
		return ""
	}
}

// WrapUntrustedContent encapsula dados externos não confiáveis contra prompt injection.
func WrapUntrustedContent(source, raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}
	if strings.TrimSpace(source) == "" {
		source = "external"
	}

	neutralized := strings.ReplaceAll(trimmed, "</untrusted_content>", "[escaped_closed_tag]")
	neutralized = strings.ReplaceAll(neutralized, "<untrusted_content", "[escaped_open_tag")

	return fmt.Sprintf("<untrusted_content source=%q>\n%s\n</untrusted_content>", source, neutralized)
}
