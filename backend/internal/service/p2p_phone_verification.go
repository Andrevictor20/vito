package service

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"net/url"
	"strings"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

// NormalizeE164Phone normaliza números de telefone (especialmente BR) para o padrão internacional E.164 (+5511987654321).
// A implementação canônica vive em domain.NormalizePhone (também usada pelo repositório na escrita).
func NormalizeE164Phone(raw string) string {
	return domain.NormalizePhone(raw)
}

// RequestPhoneVerification inicia o fluxo de confirmação ativa de telefone via WhatsApp.
func (s *P2PMeetingService) RequestPhoneVerification(ctx context.Context, userID, rawPhone, publicBaseURL string) (*domain.PhoneVerificationChallenge, error) {
	if userID == "" {
		return nil, domain.ErrValidation
	}
	e164 := NormalizeE164Phone(rawPhone)
	if e164 == "" {
		return nil, domain.ErrValidation
	}

	// Verifica se outro usuário já possui este número confirmado
	existing, err := s.userRepo.GetByPhone(e164)
	if err != nil && !errors.Is(err, domain.ErrUserNotFound) {
		return nil, err
	}
	if existing != nil && existing.ID != userID {
		return nil, domain.ErrUserAlreadyExists
	}

	tokenBytes := make([]byte, 16)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, fmt.Errorf("falha ao gerar token de verificação: %w", err)
	}
	token := hex.EncodeToString(tokenBytes)

	n, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return nil, fmt.Errorf("falha ao gerar código numérico: %w", err)
	}
	code := fmt.Sprintf("%06d", n.Int64()+100000)

	base := strings.TrimRight(strings.TrimSpace(publicBaseURL), "/")
	if base == "" {
		base = "https://vito.rasppi.cloud"
	}
	verifyURL := fmt.Sprintf("%s/verify-phone/%s", base, token)

	waDigits := strings.TrimPrefix(e164, "+")
	msg := fmt.Sprintf(
		"🔐 *Confirmação de Telefone Vito*\n\nCódigo de verificação: *%s*\n\nToque no link abaixo para confirmar seu número instantaneamente:\n%s",
		code,
		verifyURL,
	)
	waURL := fmt.Sprintf("https://wa.me/%s?text=%s", waDigits, url.QueryEscape(msg))

	challenge := &domain.PhoneVerificationChallenge{
		Token:       token,
		Code:        code,
		UserID:      userID,
		Phone:       e164,
		VerifyURL:   verifyURL,
		WhatsAppURL: waURL,
		ExpiresAt:   time.Now().UTC().Add(15 * time.Minute),
		Verified:    false,
	}

	s.mu.Lock()
	if s.phoneVerifications == nil {
		s.phoneVerifications = make(map[string]*domain.PhoneVerificationChallenge)
	}
	// Limpa expirados antigos
	now := time.Now().UTC()
	for k, v := range s.phoneVerifications {
		if now.After(v.ExpiresAt.Add(10 * time.Minute)) {
			delete(s.phoneVerifications, k)
		}
	}
	s.phoneVerifications[token] = challenge
	s.mu.Unlock()

	return challenge, nil
}

// ConfirmPhoneVerificationByToken confirma o número quando o usuário clica no link mágico dentro do WhatsApp.
func (s *P2PMeetingService) ConfirmPhoneVerificationByToken(ctx context.Context, token string) (*domain.PhoneVerificationChallenge, error) {
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, domain.ErrPhoneVerificationInvalid
	}

	s.mu.Lock()
	ch, ok := s.phoneVerifications[token]
	if !ok || ch == nil || time.Now().UTC().After(ch.ExpiresAt) {
		s.mu.Unlock()
		return nil, domain.ErrPhoneVerificationInvalid
	}
	userID := ch.UserID
	phone := ch.Phone
	s.mu.Unlock()

	if err := s.userRepo.UpdatePhone(userID, phone); err != nil {
		return nil, err
	}

	s.mu.Lock()
	ch.Verified = true
	resCopy := *ch
	s.mu.Unlock()

	s.notifyPhoneVerified(userID, phone)
	return &resCopy, nil
}

// ConfirmPhoneVerificationByCode confirma o número usando o código de 6 dígitos exibido na conversa do WhatsApp.
func (s *P2PMeetingService) ConfirmPhoneVerificationByCode(ctx context.Context, userID, code string) (*domain.PhoneVerificationChallenge, error) {
	cleanCode := strings.TrimSpace(code)
	if userID == "" || len(cleanCode) != 6 {
		return nil, domain.ErrPhoneVerificationInvalid
	}

	now := time.Now().UTC()
	var matched *domain.PhoneVerificationChallenge

	s.mu.RLock()
	for _, ch := range s.phoneVerifications {
		if ch.UserID == userID && now.Before(ch.ExpiresAt) {
			if subtle.ConstantTimeCompare([]byte(ch.Code), []byte(cleanCode)) == 1 {
				matched = ch
				break
			}
		}
	}
	s.mu.RUnlock()

	if matched == nil {
		return nil, domain.ErrPhoneVerificationInvalid
	}

	if err := s.userRepo.UpdatePhone(userID, matched.Phone); err != nil {
		return nil, err
	}

	s.mu.Lock()
	matched.Verified = true
	resCopy := *matched
	s.mu.Unlock()

	s.notifyPhoneVerified(userID, resCopy.Phone)
	return &resCopy, nil
}

// GetPhoneVerificationStatus consulta se o token de verificação já foi confirmado via WhatsApp.
func (s *P2PMeetingService) GetPhoneVerificationStatus(ctx context.Context, userID, token string) (*domain.PhoneVerificationChallenge, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	ch, ok := s.phoneVerifications[strings.TrimSpace(token)]
	if !ok || ch == nil || ch.UserID != userID {
		return nil, domain.ErrPhoneVerificationInvalid
	}
	resCopy := *ch
	return &resCopy, nil
}

func (s *P2PMeetingService) notifyPhoneVerified(userID, phone string) {
	if s.notifService == nil {
		return
	}
	go func() {
		_, _ = s.notifService.SendPushToUser(
			userID,
			"Telefone Confirmado ✓",
			fmt.Sprintf("Seu número %s foi verificado com sucesso no Vito.", phone),
			"high",
			map[string]interface{}{
				"type":      "phone_verified",
				"phone":     phone,
				"channelId": "vito_booking",
			},
		)
	}()
}
