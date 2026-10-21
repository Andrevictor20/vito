package service

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"html"
	"log"
	"mime"
	"net"
	"net/smtp"
	"strings"
	"time"

	"github.com/google/uuid"
)

// EmailSender interface para desacoplar envio e permitir mocks em testes unitários.
type EmailSender interface {
	SendMail(addr string, a smtp.Auth, from string, to []string, msg []byte) error
}

type realSMTPSender struct {
	host string
}

func (s *realSMTPSender) SendMail(addr string, a smtp.Auth, from string, to []string, msg []byte) error {
	host, _, _ := net.SplitHostPort(addr)
	if host == "" {
		host = s.host
	}

	conn, err := net.DialTimeout("tcp", addr, 15*time.Second)
	if err != nil {
		return fmt.Errorf("falha ao conectar no host SMTP %s: %w", addr, err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		return fmt.Errorf("falha ao criar cliente SMTP: %w", err)
	}
	defer client.Quit()

	// STARTTLS se suportado
	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{
			ServerName: host,
			MinVersion: tls.VersionTLS12,
		}
		if err = client.StartTLS(tlsConfig); err != nil {
			return fmt.Errorf("falha ao iniciar STARTTLS: %w", err)
		}
	}

	if a != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err = client.Auth(a); err != nil {
				return fmt.Errorf("falha na autenticação SMTP: %w", err)
			}
		}
	}

	if err = client.Mail(from); err != nil {
		return fmt.Errorf("erro no comando MAIL FROM: %w", err)
	}
	for _, rec := range to {
		if err = client.Rcpt(rec); err != nil {
			return fmt.Errorf("erro no comando RCPT TO (%s): %w", rec, err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("erro no comando DATA: %w", err)
	}
	if _, err = w.Write(msg); err != nil {
		return fmt.Errorf("falha ao escrever corpo do e-mail: %w", err)
	}
	return w.Close()
}

// EmailService gerencia envios de e-mails transacionais e convites .ics.
type EmailService struct {
	Host     string
	Port     int
	User     string
	Password string
	From     string
	sender   EmailSender
}

// NewEmailService inicializa o serviço de e-mail com higienização de senha.
func NewEmailService(host string, port int, user, password, from string, customSender ...EmailSender) *EmailService {
	cleanPass := strings.ReplaceAll(password, " ", "")
	var snd EmailSender
	if len(customSender) > 0 && customSender[0] != nil {
		snd = customSender[0]
	} else {
		snd = &realSMTPSender{host: host}
	}

	if from == "" && user != "" {
		from = fmt.Sprintf("Vito Assistente <%s>", user)
	}

	return &EmailService{
		Host:     host,
		Port:     port,
		User:     user,
		Password: cleanPass,
		From:     from,
		sender:   snd,
	}
}

// IsConfigured verifica se o serviço tem as credenciais mínimas para disparo.
func (s *EmailService) IsConfigured() bool {
	return s != nil && s.Host != "" && s.User != "" && s.Password != ""
}

// GenerateICS gera o conteúdo padrão RFC 5545 para Google/Outlook/Apple Calendar.
func GenerateICS(eventUID, summary, description, organizerEmail string, startAt, endAt time.Time, attendeeEmail ...string) string {
	formatUTC := func(t time.Time) string {
		return t.UTC().Format("20060102T150405Z")
	}

	attendeeLine := ""
	if len(attendeeEmail) > 0 && strings.Contains(attendeeEmail[0], "@") {
		att := strings.TrimSpace(attendeeEmail[0])
		attendeeLine = fmt.Sprintf("ATTENDEE;CUTYPE=INDIVIDUAL;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE;CN=%s:mailto:%s\r\n", escapeICS(att), att)
	}

	now := time.Now().UTC()
	return fmt.Sprintf("BEGIN:VCALENDAR\r\n"+
		"VERSION:2.0\r\n"+
		"PRODID:-//Vito Executive Assistant//PT-BR\r\n"+
		"CALSCALE:GREGORIAN\r\n"+
		"METHOD:REQUEST\r\n"+
		"BEGIN:VEVENT\r\n"+
		"UID:%s\r\n"+
		"DTSTAMP:%s\r\n"+
		"DTSTART:%s\r\n"+
		"DTEND:%s\r\n"+
		"SUMMARY:%s\r\n"+
		"DESCRIPTION:%s\r\n"+
		"ORGANIZER;CN=Vito Assistente:mailto:%s\r\n"+
		"%s"+
		"STATUS:CONFIRMED\r\n"+
		"SEQUENCE:0\r\n"+
		"BEGIN:VALARM\r\n"+
		"TRIGGER:-PT15M\r\n"+
		"ACTION:DISPLAY\r\n"+
		"DESCRIPTION:Lembrete de Reunião\r\n"+
		"END:VALARM\r\n"+
		"END:VEVENT\r\n"+
		"END:VCALENDAR\r\n",
		eventUID,
		formatUTC(now),
		formatUTC(startAt),
		formatUTC(endAt),
		escapeICS(summary),
		escapeICS(description),
		organizerEmail,
		attendeeLine,
	)
}

func escapeICS(s string) string {
	r := strings.ReplaceAll(s, "\\", "\\\\")
	r = strings.ReplaceAll(r, ";", "\\;")
	r = strings.ReplaceAll(r, ",", "\\,")
	r = strings.ReplaceAll(r, "\n", "\\n")
	return r
}

// wrapBase64 codifica em Base64 e quebra linhas a cada 76 caracteres com CRLF (RFC 2045 §6.8),
// evitando pontuação de spam por linhas longas (MIME_BASE64_TEXT / LONG_LINE).
func wrapBase64(data []byte) string {
	encoded := base64.StdEncoding.EncodeToString(data)
	var sb strings.Builder
	for i := 0; i < len(encoded); i += 76 {
		end := i + 76
		if end > len(encoded) {
			end = len(encoded)
		}
		sb.WriteString(encoded[i:end])
		sb.WriteString("\r\n")
	}
	return sb.String()
}

// BuildConfirmationEmailPlainText gera a alternativa text/plain (obrigatória contra filtros de spam).
func BuildConfirmationEmailPlainText(toName, meetingTitle, dateFormatted, timeRange, publicURL string) string {
	var sb strings.Builder
	sb.WriteString("VITO · ASSISTENTE EXECUTIVO\r\n")
	sb.WriteString("========================================\r\n\r\n")
	sb.WriteString(fmt.Sprintf("Reunião Confirmada: %s\r\n\r\n", meetingTitle))
	sb.WriteString(fmt.Sprintf("Olá %s,\r\n", toName))
	sb.WriteString(fmt.Sprintf("O horário oficial da reunião \"%s\" foi definido:\r\n\r\n", meetingTitle))
	sb.WriteString(fmt.Sprintf("• Data: %s\r\n", dateFormatted))
	sb.WriteString(fmt.Sprintf("• Horário: %s (Horário de Brasília)\r\n\r\n", timeRange))
	sb.WriteString("O convite oficial de calendário (.ics) está anexado a este e-mail para adição direta ao Google Agenda, Outlook ou Apple Calendar.\r\n")
	if publicURL != "" {
		sb.WriteString(fmt.Sprintf("\r\nDetalhes da reunião: %s\r\n", publicURL))
	}
	sb.WriteString("\r\n--\r\nOrganizado com Vito · Assistente Executivo com IA\r\n")
	return sb.String()
}

// BuildConfirmationEmailHTML gera o template HTML seguindo o Design System Editorial Minimalist OLED do Vito
// (--bg: #0B0D10, --surface: #14171C, --surface-high: #1C2026, --border: #262B33, --accent: #34D399).
func BuildConfirmationEmailHTML(toName, meetingTitle, dateFormatted, timeRange, publicURL string) string {
	safeName := html.EscapeString(toName)
	safeTitle := html.EscapeString(meetingTitle)
	safeDate := html.EscapeString(dateFormatted)
	safeTime := html.EscapeString(timeRange)

	ctaBlock := ""
	if publicURL != "" {
		safeURL := html.EscapeString(publicURL)
		ctaBlock = fmt.Sprintf(`
    <div style="margin: 0 0 24px 0;">
      <a href="%s" style="display: block; text-align: center; background-color: #F4F4F6; color: #0B0D10; font-weight: 700; font-size: 14px; padding: 14px 20px; border-radius: 12px; text-decoration: none; letter-spacing: -0.1px;">
        Ver Detalhes da Reunião
      </a>
    </div>`, safeURL)
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="supported-color-schemes" content="dark">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0D10; color: #F4F4F6; padding: 32px 16px; margin: 0; -webkit-font-smoothing: antialiased;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #14171C; border: 1px solid #262B33; border-radius: 16px; padding: 28px 24px;">
    <div style="margin-bottom: 20px;">
      <span style="display: inline-block; padding: 5px 12px; background-color: #1C2026; border: 1px solid #262B33; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; color: #9CA3AF;">
        <span style="color: #34D399;">●</span>&nbsp; VITO · REUNIÕES
      </span>
    </div>

    <h1 style="margin: 0 0 10px 0; font-size: 22px; font-weight: 700; letter-spacing: -0.4px; color: #F4F4F6; line-height: 1.25;">
      Reunião Confirmada
    </h1>
    <p style="color: #9CA3AF; font-size: 14px; line-height: 1.6; margin: 0 0 22px 0;">
      Olá <strong style="color: #F4F4F6;">%s</strong>, o horário oficial da reunião <strong style="color: #F4F4F6;">"%s"</strong> foi definido e reservado:
    </p>

    <div style="background-color: #1C2026; border: 1px solid #262B33; border-left: 3px solid #34D399; border-radius: 12px; padding: 18px; margin-bottom: 22px;">
      <div style="font-size: 11px; color: #34D399; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 6px;">
        ✓ Horário Oficial Confirmado
      </div>
      <div style="font-size: 17px; font-weight: 700; color: #F4F4F6; letter-spacing: -0.2px;">
        %s
      </div>
      <div style="font-size: 14px; color: #9CA3AF; margin-top: 4px; font-weight: 500;">
        %s · Horário de Brasília
      </div>
    </div>

    <div style="background-color: #0B0D10; border: 1px solid #262B33; border-radius: 12px; padding: 14px 16px; margin-bottom: 22px;">
      <p style="color: #9CA3AF; font-size: 13px; line-height: 1.5; margin: 0;">
        📅 O convite oficial de calendário (<strong style="color: #F4F4F6;">invite.ics</strong>) acompanha este e-mail para sincronização direta com o Google Agenda, Apple Calendar ou Outlook.
      </p>
    </div>
%s
    <div style="border-top: 1px solid #262B33; padding-top: 16px; font-size: 12px; color: #6B7280; text-align: center;">
      Organizado com <strong style="color: #9CA3AF;">Vito</strong> · Assistente Executivo com IA
    </div>
  </div>
</body>
</html>`,
		safeName,
		safeTitle,
		safeDate,
		safeTime,
		ctaBlock,
	)
}

func extractDomainFromEmail(email string) string {
	parts := strings.Split(strings.TrimSpace(email), "@")
	if len(parts) == 2 && parts[1] != "" {
		return strings.TrimRight(parts[1], ">")
	}
	return "vito.app"
}

func formatFromHeader(fromRaw, fallbackUser string) string {
	trimmed := strings.TrimSpace(fromRaw)
	if idx := strings.Index(trimmed, "<"); idx > 0 && strings.HasSuffix(trimmed, ">") {
		displayName := strings.TrimSpace(strings.Trim(trimmed[:idx], `"`))
		addr := trimmed[idx:]
		return fmt.Sprintf("%s %s", mime.QEncoding.Encode("utf-8", displayName), addr)
	}
	if trimmed != "" {
		return trimmed
	}
	return fmt.Sprintf("%s <%s>", mime.QEncoding.Encode("utf-8", "Vito Assistente"), fallbackUser)
}

// SendMeetingConfirmation envia um e-mail com anexo .ics com adição automática na agenda,
// seguindo rigorosamente os padrões RFC 5322, RFC 2045 e RFC 2047 para máxima entregabilidade (Anti-Spam).
func (s *EmailService) SendMeetingConfirmation(ctx context.Context, toEmail, toName, meetingTitle, description string, startAt, endAt time.Time, publicURL string) error {
	if !s.IsConfigured() {
		return fmt.Errorf("serviço de e-mail não configurado")
	}

	toEmail = strings.TrimSpace(toEmail)
	if toEmail == "" || !strings.Contains(toEmail, "@") {
		return fmt.Errorf("destinatário inválido: %s", toEmail)
	}

	loc := brtLocation()
	localStart := startAt.In(loc)
	localEnd := endAt.In(loc)
	dateFormatted := localStart.Format("02/01/2006 (Monday)")
	ptDays := map[string]string{
		"Monday": "Segunda-feira", "Tuesday": "Terça-feira", "Wednesday": "Quarta-feira",
		"Thursday": "Quinta-feira", "Friday": "Sexta-feira", "Saturday": "Sábado", "Sunday": "Domingo",
	}
	for en, pt := range ptDays {
		dateFormatted = strings.ReplaceAll(dateFormatted, en, pt)
	}
	timeRange := fmt.Sprintf("%s às %s", localStart.Format("15:04"), localEnd.Format("15:04"))

	senderDomain := extractDomainFromEmail(s.User)
	msgUUID := uuid.New().String()
	eventUID := fmt.Sprintf("vito-%s@%s", msgUUID, senderDomain)
	icsContent := GenerateICS(eventUID, meetingTitle, description, s.User, startAt, endAt, toEmail)

	mixedBoundary := fmt.Sprintf("=_vito_mixed_%d", time.Now().UnixNano())
	altBoundary := fmt.Sprintf("=_vito_alt_%d", time.Now().UnixNano()+1)

	plainBody := BuildConfirmationEmailPlainText(toName, meetingTitle, dateFormatted, timeRange, publicURL)
	htmlBody := BuildConfirmationEmailHTML(toName, meetingTitle, dateFormatted, timeRange, publicURL)

	subjectRaw := fmt.Sprintf("Reunião Confirmada: %s", meetingTitle)
	encodedSubject := mime.QEncoding.Encode("utf-8", subjectRaw)

	// Monta cabeçalhos RFC 5322 completos (Date, Message-ID, From, Reply-To, To, Subject, MIME-Version)
	var raw strings.Builder
	raw.WriteString(fmt.Sprintf("Date: %s\r\n", time.Now().In(loc).Format(time.RFC1123Z)))
	raw.WriteString(fmt.Sprintf("Message-ID: <%s@%s>\r\n", msgUUID, senderDomain))
	raw.WriteString(fmt.Sprintf("From: %s\r\n", formatFromHeader(s.From, s.User)))
	raw.WriteString(fmt.Sprintf("Reply-To: %s\r\n", s.User))
	raw.WriteString(fmt.Sprintf("To: %s\r\n", toEmail))
	raw.WriteString(fmt.Sprintf("Subject: %s\r\n", encodedSubject))
	raw.WriteString("MIME-Version: 1.0\r\n")
	raw.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=\"%s\"\r\n\r\n", mixedBoundary))

	// Bloco 1: multipart/alternative (text/plain + text/html + text/calendar inline)
	raw.WriteString(fmt.Sprintf("--%s\r\n", mixedBoundary))
	raw.WriteString(fmt.Sprintf("Content-Type: multipart/alternative; boundary=\"%s\"\r\n\r\n", altBoundary))

	// Parte 1A: text/plain (essencial contra filtros anti-spam)
	raw.WriteString(fmt.Sprintf("--%s\r\n", altBoundary))
	raw.WriteString("Content-Type: text/plain; charset=UTF-8\r\n")
	raw.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
	raw.WriteString(wrapBase64([]byte(plainBody)))
	raw.WriteString("\r\n")

	// Parte 1B: text/html (Design Editorial Minimalist OLED)
	raw.WriteString(fmt.Sprintf("--%s\r\n", altBoundary))
	raw.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	raw.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
	raw.WriteString(wrapBase64([]byte(htmlBody)))
	raw.WriteString("\r\n")

	// Parte 1C: text/calendar inline (renderiza card nativo de agenda no Gmail / Outlook)
	raw.WriteString(fmt.Sprintf("--%s\r\n", altBoundary))
	raw.WriteString("Content-Type: text/calendar; method=REQUEST; charset=UTF-8\r\n")
	raw.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
	raw.WriteString(wrapBase64([]byte(icsContent)))
	raw.WriteString("\r\n")

	raw.WriteString(fmt.Sprintf("--%s--\r\n\r\n", altBoundary))

	// Bloco 2: Anexo .ics explícito (fallback universal para clientes de e-mail)
	raw.WriteString(fmt.Sprintf("--%s\r\n", mixedBoundary))
	raw.WriteString("Content-Type: application/ics; name=\"invite.ics\"\r\n")
	raw.WriteString("Content-Disposition: attachment; filename=\"invite.ics\"\r\n")
	raw.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
	raw.WriteString(wrapBase64([]byte(icsContent)))
	raw.WriteString("\r\n")

	raw.WriteString(fmt.Sprintf("--%s--\r\n", mixedBoundary))

	auth := smtp.PlainAuth("", s.User, s.Password, s.Host)
	addr := fmt.Sprintf("%s:%d", s.Host, s.Port)

	log.Printf("[EmailService] Enviando confirmação de reunião para %s via %s", toEmail, addr)
	return s.sender.SendMail(addr, auth, s.User, []string{toEmail}, []byte(raw.String()))
}
