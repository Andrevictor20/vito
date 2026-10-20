package service_test

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

func newGuardSuite(t *testing.T) (*service.WhatsAppAuthService, *MockUserRepositoryInMemory, *MockEvolutionClientForAuth, *MockWhatsAppRepoForLinking) {
	t.Helper()
	ctx := context.Background()
	_ = ctx

	otpRepo := newMockWhatsAppAuthRepo()
	userRepo := NewMockUserRepositoryInMemory()
	authSvc := service.NewAuthService(userRepo, "test-jwt-secret-guard")
	evoClient := &MockEvolutionClientForAuth{}
	waRepo := newMockWhatsAppRepoForLinking()

	svc := service.NewWhatsAppAuthService(
		otpRepo,
		userRepo,
		authSvc,
		evoClient,
		"vito_system",
		"hmac-secret-guard",
	)
	svc.SetWhatsAppRepo(waRepo)
	return svc, userRepo, evoClient, waRepo
}

// TestWhatsAppAuth_RequestOTP_RefusesUnknownPhone garante que números sem conta Vito
// não recebam mensagem alguma (nada é enviado a terceiros) e que nenhuma conta seja criada.
func TestWhatsAppAuth_RequestOTP_RefusesUnknownPhone(t *testing.T) {
	ctx := context.Background()
	svc, userRepo, evoClient, _ := newGuardSuite(t)

	err := svc.RequestOTP(ctx, "+5511999998888")
	if !errors.Is(err, domain.ErrPhoneNotLinked) {
		t.Fatalf("esperava ErrPhoneNotLinked, obteve %v", err)
	}
	if evoClient.sentText != "" {
		t.Errorf("nenhuma mensagem deveria ter sido enviada para número desconhecido: %q", evoClient.sentText)
	}
	if evoClient.sentTo != "" {
		t.Errorf("nenhum destinatário deveria ter sido definido: %q", evoClient.sentTo)
	}

	users, _ := userRepo.ListAll()
	if len(users) != 0 {
		t.Fatalf("nenhuma conta deveria ter sido criada, obteve %d", len(users))
	}
}

// TestWhatsAppAuth_RequestOTP_ReleasesPhoneHeldByPlaceholder garante que o número preso numa
// conta placeholder (@vito.local) seja devolvido — o número pertence ao dono real.
func TestWhatsAppAuth_RequestOTP_ReleasesPhoneHeldByPlaceholder(t *testing.T) {
	ctx := context.Background()
	svc, userRepo, evoClient, _ := newGuardSuite(t)

	placeholderPhone := "+5511999998888"
	placeholder := &domain.User{
		ID:        "user-placeholder-guard",
		Name:      "Usuário Vito",
		Email:     "5511999998888@vito.local",
		Phone:     &placeholderPhone,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(placeholder); err != nil {
		t.Fatalf("falha ao criar placeholder: %v", err)
	}

	if err := svc.RequestOTP(ctx, placeholderPhone); !errors.Is(err, domain.ErrPhoneNotLinked) {
		t.Fatalf("esperava ErrPhoneNotLinked, obteve %v", err)
	}
	if evoClient.sentText != "" {
		t.Errorf("nenhuma mensagem deveria ter sido enviada: %q", evoClient.sentText)
	}

	updated, err := userRepo.GetByID(placeholder.ID)
	if err != nil {
		t.Fatalf("falha ao reler placeholder: %v", err)
	}
	if updated.Phone != nil && *updated.Phone != "" {
		t.Errorf("placeholder ainda segura o telefone %q", *updated.Phone)
	}
}

// TestWhatsAppAuth_VerifyOTP_NeverCreatesAccountForUnknownPhone garante a defesa em
// profundidade: mesmo com um OTP válido, nenhuma conta é criada para número desconhecido.
func TestWhatsAppAuth_VerifyOTP_NeverCreatesAccountForUnknownPhone(t *testing.T) {
	ctx := context.Background()
	svc, userRepo, evoClient, _ := newGuardSuite(t)

	phone := "+5511888887777"
	linkedPhone := phone
	linked := &domain.User{
		ID:        "user-temp-linked",
		Name:      "André",
		Email:     "temp@test.com",
		Phone:     &linkedPhone,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(linked); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	// Solicita o código (permitido: o número pertence a uma conta)
	if err := svc.RequestOTP(ctx, phone); err != nil {
		t.Fatalf("falha ao solicitar OTP: %v", err)
	}
	re := regexp.MustCompile(`\b\d{6}\b`)
	code := re.FindString(evoClient.sentText)
	if code == "" {
		t.Fatalf("código OTP não encontrado: %s", evoClient.sentText)
	}

	// A conta é removida entre a solicitação e a confirmação (ex.: usuário excluído)
	if err := userRepo.Delete(linked.ID); err != nil {
		t.Fatalf("falha ao remover usuário: %v", err)
	}

	_, _, err := svc.VerifyOTP(ctx, phone, code, "Vito Mobile (Android)", "192.168.1.40")
	if !errors.Is(err, domain.ErrPhoneNotLinked) {
		t.Fatalf("esperava ErrPhoneNotLinked, obteve %v", err)
	}

	users, _ := userRepo.ListAll()
	if len(users) != 0 {
		t.Fatalf("nenhuma conta deveria existir após a recusa, obteve %d", len(users))
	}
}

// TestWhatsAppAuth_LinkPhone_RequiresProofOfPossession garante que o vínculo do telefone
// exija prova de posse (integração de WhatsApp pareada) — ninguém reivindica o número de outro.
func TestWhatsAppAuth_LinkPhone_RequiresProofOfPossession(t *testing.T) {
	ctx := context.Background()
	svc, userRepo, _, waRepo := newGuardSuite(t)

	realPhone := "+5511999998888"
	user := &domain.User{
		ID:        "user-link-proof",
		Name:      "André",
		Email:     "link.proof@test.com",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(user); err != nil {
		t.Fatalf("falha ao criar usuário: %v", err)
	}

	// Sem integração pareada: recusa
	if err := svc.LinkPhone(ctx, user.ID, realPhone); !errors.Is(err, domain.ErrPhoneNotVerified) {
		t.Fatalf("esperava ErrPhoneNotVerified, obteve %v", err)
	}
	updated, _ := userRepo.GetByID(user.ID)
	if updated.Phone != nil && *updated.Phone != "" {
		t.Errorf("telefone não deveria ter sido vinculado: %q", *updated.Phone)
	}

	// Com a integração pareada no mesmo número: vínculo permitido
	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "integration-link-proof",
		UserID:       user.ID,
		InstanceName: "vito_user_link_proof",
		Phone:        realPhone,
		Status:       domain.WhatsAppStatusConnected,
	})
	if err := svc.LinkPhone(ctx, user.ID, realPhone); err != nil {
		t.Fatalf("esperava vínculo com prova de posse, obteve %v", err)
	}
	updated, _ = userRepo.GetByID(user.ID)
	if updated.Phone == nil || *updated.Phone != realPhone {
		t.Errorf("esperava telefone vinculado %q, obteve %v", realPhone, updated.Phone)
	}
}
