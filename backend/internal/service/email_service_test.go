package service

import (
	"context"
	"net/smtp"
	"strings"
	"testing"
	"time"
)

type mockEmailSender struct {
	sentAddr string
	sentFrom string
	sentTo   []string
	sentMsg  []byte
}

func (m *mockEmailSender) SendMail(addr string, a smtp.Auth, from string, to []string, msg []byte) error {
	m.sentAddr = addr
	m.sentFrom = from
	m.sentTo = to
	m.sentMsg = msg
	return nil
}

func TestEmailService_IsConfiguredAndCleanPassword(t *testing.T) {
	svc := NewEmailService("smtp.gmail.com", 587, "vito@gmail.com", "ralw cfpk ttos zugn", "Vito <vito@gmail.com>")
	if !svc.IsConfigured() {
		t.Fatalf("esperava serviço configurado")
	}
	if svc.Password != "ralwcfpkttoszugn" {
		t.Fatalf("esperava senha sem espaços, obteve '%s'", svc.Password)
	}

	unconf := NewEmailService("", 587, "", "", "")
	if unconf.IsConfigured() {
		t.Fatalf("esperava serviço não configurado")
	}
}

func TestEmailService_SendMeetingConfirmation(t *testing.T) {
	mockSender := &mockEmailSender{}
	svc := NewEmailService(
		"smtp.gmail.com",
		587,
		"vito@gmail.com",
		"password123",
		"Vito Assistente <vito@gmail.com>",
		mockSender,
	)

	start := time.Date(2026, 10, 17, 18, 0, 0, 0, time.UTC)
	end := start.Add(60 * time.Minute)

	err := svc.SendMeetingConfirmation(
		context.Background(),
		"convidado@teste.com",
		"Convidado Teste",
		"Reunião de Alinhamento",
		"Discussão sobre arquitetura",
		start,
		end,
		"https://vito.rasppi.cloud/meet/123",
	)

	if err != nil {
		t.Fatalf("erro inesperado ao enviar e-mail: %v", err)
	}

	if mockSender.sentAddr != "smtp.gmail.com:587" {
		t.Errorf("esperava host smtp.gmail.com:587, obteve %s", mockSender.sentAddr)
	}
	if len(mockSender.sentTo) != 1 || mockSender.sentTo[0] != "convidado@teste.com" {
		t.Errorf("esperava destinatário convidado@teste.com, obteve %v", mockSender.sentTo)
	}

	rawMsg := string(mockSender.sentMsg)
	if !strings.Contains(rawMsg, "Date: ") {
		t.Errorf("cabeçalho Date obrigatório (RFC 5322) ausente no MIME")
	}
	if !strings.Contains(rawMsg, "Message-ID: <") {
		t.Errorf("cabeçalho Message-ID obrigatório (RFC 5322) ausente no MIME")
	}
	if !strings.Contains(rawMsg, "Reply-To: ") {
		t.Errorf("cabeçalho Reply-To ausente no MIME")
	}
	if !strings.Contains(rawMsg, "multipart/alternative") {
		t.Errorf("esperava multipart/alternative com text/plain + text/html contra filtros de spam")
	}
	if !strings.Contains(rawMsg, "Content-Type: text/plain; charset=UTF-8") {
		t.Errorf("parte text/plain obrigatória contra spam ausente no MIME")
	}
	if !strings.Contains(rawMsg, "text/calendar; method=REQUEST") {
		t.Errorf("anexo de calendário .ics ausente no MIME")
	}
	// Verifica que nenhuma linha do MIME excede 998 caracteres (RFC 5322 / RFC 2045 base64 wrapping)
	for i, line := range strings.Split(rawMsg, "\r\n") {
		if len(line) > 998 {
			t.Errorf("linha %d excede limite RFC 5322 (len=%d)", i+1, len(line))
		}
	}

	// Verifica identidade visual Editorial Minimalist OLED no HTML decodificado
	htmlBody := BuildConfirmationEmailHTML(
		"Convidado Teste",
		"Reunião de Alinhamento",
		"17/10/2026 (Sábado)",
		"15:00 às 16:00",
		"https://vito.rasppi.cloud/meet/123",
	)
	for _, token := range []string{"#0B0D10", "#14171C", "#1C2026", "#262B33", "#34D399"} {
		if !strings.Contains(htmlBody, token) {
			t.Errorf("esperava token visual OLED %s no HTML do e-mail", token)
		}
	}
}

func TestGenerateICS(t *testing.T) {
	start := time.Date(2026, 10, 17, 18, 0, 0, 0, time.UTC)
	end := start.Add(60 * time.Minute)
	ics := GenerateICS("uid-123", "Título Reunião", "Descrição Detalhada", "vito@gmail.com", start, end)

	if !strings.Contains(ics, "BEGIN:VCALENDAR") || !strings.Contains(ics, "END:VCALENDAR") {
		t.Errorf("bloco VCALENDAR malformado")
	}
	if !strings.Contains(ics, "SUMMARY:Título Reunião") {
		t.Errorf("summary ausente no ICS")
	}
	if !strings.Contains(ics, "DTSTART:20261017T180000Z") {
		t.Errorf("DTSTART incorreto no ICS: %s", ics)
	}
}
