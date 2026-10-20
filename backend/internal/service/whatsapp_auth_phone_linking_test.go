package service_test

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// TestWhatsAppAuth_VerifyOTP_LinksRealAccountWithLegacyPhoneFormat garante que o login por
// WhatsApp cai na conta real já existente (Google) mesmo quando o telefone foi gravado no
// formato legado (somente dígitos, sem '+'), como o auto-link da Evolution API gravava.
func TestWhatsAppAuth_VerifyOTP_LinksRealAccountWithLegacyPhoneFormat(t *testing.T) {
	ctx := context.Background()
	authSvc, userRepo, _ := setupAuthServiceWithSessions(t)
	otpRepo := newMockWhatsAppAuthRepo()
	evoClient := &MockEvolutionClientForAuth{}
	waRepo := newMockWhatsAppRepoForLinking()

	waAuthSvc := service.NewWhatsAppAuthService(
		otpRepo,
		userRepo,
		authSvc,
		evoClient,
		"vito_system",
		"hmac-secret-legacy-phone",
	)
	waAuthSvc.SetWhatsAppRepo(waRepo)

	// Conta real (Google) com telefone no formato legado, sem '+'
	legacyPhone := "5598984417165"
	realUser := &domain.User{
		ID:        "user-google-legacy-phone",
		Name:      "André Victor",
		Email:     "victorandre280@gmail.com",
		Phone:     &legacyPhone,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(realUser); err != nil {
		t.Fatalf("falha ao criar usuário real: %v", err)
	}

	e164 := "+5598984417165"
	if err := waAuthSvc.RequestOTP(ctx, e164); err != nil {
		t.Fatalf("falha ao solicitar OTP: %v", err)
	}

	re := regexp.MustCompile(`\b\d{6}\b`)
	otpCode := re.FindString(evoClient.sentText)
	if otpCode == "" {
		t.Fatalf("código OTP não encontrado: %s", evoClient.sentText)
	}

	_, verifiedUser, err := waAuthSvc.VerifyOTP(ctx, e164, otpCode, "Vito Mobile (Android)", "192.168.1.30")
	if err != nil {
		t.Fatalf("falha ao verificar OTP: %v", err)
	}

	if verifiedUser.ID != realUser.ID {
		t.Fatalf("ERRO DE CONTA DUPLICADA: esperado '%s', obteve '%s' (%s)", realUser.ID, verifiedUser.ID, verifiedUser.Email)
	}
	if verifiedUser.Email != "victorandre280@gmail.com" {
		t.Fatalf("esperado e-mail 'victorandre280@gmail.com', obteve '%s'", verifiedUser.Email)
	}
}

// TestWhatsAppAuth_VerifyOTP_TransfersPhoneFromPlaceholderToRealAccount reproduz o estado de
// produção: o telefone está preso numa conta placeholder (@vito.local) e a conta real (Google)
// tem o mesmo número no formato legado. O login deve devolver a conta real e transferir o
// telefone, liberando o placeholder.
func TestWhatsAppAuth_VerifyOTP_TransfersPhoneFromPlaceholderToRealAccount(t *testing.T) {
	ctx := context.Background()
	authSvc, userRepo, _ := setupAuthServiceWithSessions(t)
	otpRepo := newMockWhatsAppAuthRepo()
	evoClient := &MockEvolutionClientForAuth{}
	waRepo := newMockWhatsAppRepoForLinking()

	waAuthSvc := service.NewWhatsAppAuthService(
		otpRepo,
		userRepo,
		authSvc,
		evoClient,
		"vito_system",
		"hmac-secret-transfer-phone",
	)
	waAuthSvc.SetWhatsAppRepo(waRepo)

	e164 := "+5598984417165"
	legacyPhone := "5598984417165"

	placeholderUser := &domain.User{
		ID:        "user-placeholder-transfer",
		Name:      "Usuário Vito",
		Email:     "5598984417165@vito.local",
		Phone:     &e164,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(placeholderUser); err != nil {
		t.Fatalf("falha ao criar placeholder: %v", err)
	}

	realUser := &domain.User{
		ID:        "user-google-transfer",
		Name:      "André Victor",
		Email:     "victorandre280@gmail.com",
		Phone:     &legacyPhone,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(realUser); err != nil {
		t.Fatalf("falha ao criar usuário real: %v", err)
	}

	if err := waAuthSvc.RequestOTP(ctx, e164); err != nil {
		t.Fatalf("falha ao solicitar OTP: %v", err)
	}

	re := regexp.MustCompile(`\b\d{6}\b`)
	otpCode := re.FindString(evoClient.sentText)
	if otpCode == "" {
		t.Fatalf("código OTP não encontrado: %s", evoClient.sentText)
	}

	_, verifiedUser, err := waAuthSvc.VerifyOTP(ctx, e164, otpCode, "Vito Mobile (Android)", "192.168.1.31")
	if err != nil {
		t.Fatalf("falha ao verificar OTP: %v", err)
	}

	if verifiedUser.ID != realUser.ID {
		t.Fatalf("ERRO DE CONTA DUPLICADA: esperado '%s', obteve '%s' (%s)", realUser.ID, verifiedUser.ID, verifiedUser.Email)
	}

	// O telefone deve ter sido transferido para a conta real em E.164
	updatedReal, err := userRepo.GetByID(realUser.ID)
	if err != nil {
		t.Fatalf("falha ao reler usuário real: %v", err)
	}
	if updatedReal.Phone == nil || *updatedReal.Phone != e164 {
		t.Fatalf("esperava telefone '%s' na conta real, obteve %v", e164, updatedReal.Phone)
	}

	// O placeholder deve ter sido liberado (sem telefone)
	updatedPlaceholder, err := userRepo.GetByID(placeholderUser.ID)
	if err != nil {
		t.Fatalf("falha ao reler placeholder: %v", err)
	}
	if updatedPlaceholder.Phone != nil && *updatedPlaceholder.Phone != "" {
		t.Fatalf("esperava placeholder sem telefone, obteve %q", *updatedPlaceholder.Phone)
	}
}
