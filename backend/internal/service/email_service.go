package service

import (
	"context"
	"crypto/tls"
	"encoding/base64"
	"fmt"
	"log"
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
func GenerateICS(eventUID, summary, description, organizerEmail string, startAt, endAt time.Time) string {
	formatUTC := func(t time.Time) string {
		return t.UTC().Format("20060102T150405Z")
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
	)
}

func escapeICS(s string) string {
	r := strings.ReplaceAll(s, "\\", "\\\\")
	r = strings.ReplaceAll(r, ";", "\\;")
	r = strings.ReplaceAll(r, ",", "\\,")
	r = strings.ReplaceAll(r, "\n", "\\n")
	return r
}

// SendMeetingConfirmation envia um e-mail com anexo .ics com adição automática na agenda.
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
	// Tradução rápida dos dias para pt-BR
	ptDays := map[string]string{
		"Monday": "Segunda-feira", "Tuesday": "Terça-feira", "Wednesday": "Quarta-feira",
		"Thursday": "Quinta-feira", "Friday": "Sexta-feira", "Saturday": "Sábado", "Sunday": "Domingo",
	}
	for en, pt := range ptDays {
		dateFormatted = strings.ReplaceAll(dateFormatted, en, pt)
	}
	timeRange := fmt.Sprintf("%s às %s", localStart.Format("15:04"), localEnd.Format("15:04"))

	eventUID := fmt.Sprintf("vito-%s@vito.app", uuid.New().String())
	icsContent := GenerateICS(eventUID, meetingTitle, description, s.User, startAt, endAt)

	boundary := fmt.Sprintf("=_vito_boundary_%d", time.Now().UnixNano())

	htmlBody := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f141c; color: #f1f5f9; padding: 24px; margin: 0;">
  <div style="max-width: 560px; margin: 0 auto; background: #1a2230; border: 1px solid #2d3748; border-radius: 14px; padding: 28px; box-shadow: 0 8px 24px rgba(0,0,0,0.3);">
    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 20px;">
      <span style="font-size: 20px;">🗓️</span>
      <span style="font-size: 16px; font-weight: 700; color: #38bdf8; letter-spacing: 0.5px;">VITO REUNIÕES</span>
    </div>

    <h2 style="margin: 0 0 12px 0; font-size: 22px; color: #ffffff;">Reunião Confirmada!</h2>
    <p style="color: #94a3b8; font-size: 15px; line-height: 1.5; margin: 0 0 20px 0;">
      Olá <strong>%s</strong>, a votação da reunião <strong>"%s"</strong> foi finalizada e o horário oficial foi definido:
    </p>

    <div style="background: #111827; border-left: 4px solid #10b981; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <div style="font-size: 13px; color: #10b981; font-weight: 700; text-transform: uppercase; margin-bottom: 4px;">Horário Confirmado</div>
      <div style="font-size: 18px; font-weight: 700; color: #ffffff;">%s</div>
      <div style="font-size: 15px; color: #cbd5e1; margin-top: 2px;">%s (Horário de Brasília)</div>
    </div>

    <p style="color: #94a3b8; font-size: 14px; line-height: 1.5; margin-bottom: 24px;">
      📎 O convite oficial de calendário (<strong>.ics</strong>) está em anexo. A maioria dos e-mails (Google Agenda, Outlook e Apple Calendar) adiciona automaticamente este compromisso na sua agenda.
    </p>

    %s

    <div style="border-top: 1px solid #2d3748; padding-top: 16px; font-size: 12px; color: #64748b; text-align: center;">
      Organizado com <strong>Vito</strong> · Assistente Executivo com IA
    </div>
  </div>
</body>
</html>`,
		toName,
		meetingTitle,
		dateFormatted,
		timeRange,
		func() string {
			if publicURL != "" {
				return fmt.Sprintf(`<a href="%s" style="display: block; text-align: center; background: #38bdf8; color: #0f172a; font-weight: 700; padding: 12px 20px; border-radius: 8px; text-decoration: none; margin-bottom: 24px;">Ver Detalhes da Reunião</a>`, publicURL)
			}
			return ""
		}(),
	)

	// Monta MIME multipart
	var raw strings.Builder
	raw.WriteString(fmt.Sprintf("From: %s\r\n", s.From))
	raw.WriteString(fmt.Sprintf("To: %s\r\n", toEmail))
	raw.WriteString(fmt.Sprintf("Subject: Reunião Confirmada: %s\r\n", meetingTitle))
	raw.WriteString("MIME-Version: 1.0\r\n")
	raw.WriteString(fmt.Sprintf("Content-Type: multipart/mixed; boundary=\"%s\"\r\n\r\n", boundary))

	// Parte 1: HTML
	raw.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	raw.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	raw.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
	raw.WriteString(base64.StdEncoding.EncodeToString([]byte(htmlBody)))
	raw.WriteString("\r\n\r\n")

	// Parte 2: .ics Calendar Invitation
	raw.WriteString(fmt.Sprintf("--%s\r\n", boundary))
	raw.WriteString("Content-Type: text/calendar; method=REQUEST; charset=UTF-8; name=\"invite.ics\"\r\n")
	raw.WriteString("Content-Disposition: inline; filename=\"invite.ics\"\r\n")
	raw.WriteString("Content-Transfer-Encoding: base64\r\n\r\n")
	raw.WriteString(base64.StdEncoding.EncodeToString([]byte(icsContent)))
	raw.WriteString("\r\n\r\n")

	raw.WriteString(fmt.Sprintf("--%s--\r\n", boundary))

	auth := smtp.PlainAuth("", s.User, s.Password, s.Host)
	addr := fmt.Sprintf("%s:%d", s.Host, s.Port)

	log.Printf("[EmailService] Enviando confirmação de reunião para %s via %s", toEmail, addr)
	return s.sender.SendMail(addr, auth, s.User, []string{toEmail}, []byte(raw.String()))
}
