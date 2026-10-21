package service_test

import (
	"context"
	"regexp"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/service"
)

// MockWhatsAppRepoForLinking mocka o repositório de integrações para resolução de instâncias
type MockWhatsAppRepoForLinking struct {
	integrations map[string]*domain.WhatsAppIntegration
}

func newMockWhatsAppRepoForLinking() *MockWhatsAppRepoForLinking {
	return &MockWhatsAppRepoForLinking{
		integrations: make(map[string]*domain.WhatsAppIntegration),
	}
}

func (m *MockWhatsAppRepoForLinking) GetByUserID(ctx context.Context, userID string) (*domain.WhatsAppIntegration, error) {
	for _, it := range m.integrations {
		if it.UserID == userID {
			return it, nil
		}
	}
	return nil, domain.ErrWhatsAppIntegrationNotFound
}

func (m *MockWhatsAppRepoForLinking) GetByInstanceName(ctx context.Context, instanceName string) (*domain.WhatsAppIntegration, error) {
	it, ok := m.integrations[instanceName]
	if !ok {
		return nil, domain.ErrWhatsAppIntegrationNotFound
	}
	return it, nil
}

func (m *MockWhatsAppRepoForLinking) Upsert(ctx context.Context, integration *domain.WhatsAppIntegration) error {
	m.integrations[integration.InstanceName] = integration
	return nil
}

func (m *MockWhatsAppRepoForLinking) UpdateStatus(ctx context.Context, id string, status string, lastConnectedAt *time.Time) error {
	for _, it := range m.integrations {
		if it.ID == id {
			it.Status = status
			it.LastConnectedAt = lastConnectedAt
			return nil
		}
	}
	return domain.ErrWhatsAppIntegrationNotFound
}

func (m *MockWhatsAppRepoForLinking) Delete(ctx context.Context, userID string) error {
	for k, it := range m.integrations {
		if it.UserID == userID {
			delete(m.integrations, k)
		}
	}
	return nil
}

func (m *MockWhatsAppRepoForLinking) FindConnectedInstance(ctx context.Context) (*domain.WhatsAppIntegration, error) {
	for _, it := range m.integrations {
		if it.Status == domain.WhatsAppStatusConnected {
			return it, nil
		}
	}
	return nil, domain.ErrWhatsAppIntegrationNotFound
}

func (m *MockWhatsAppRepoForLinking) GetByPhone(ctx context.Context, phone string) (*domain.WhatsAppIntegration, error) {
	for _, it := range m.integrations {
		if it.Phone == phone {
			return it, nil
		}
	}
	return nil, domain.ErrWhatsAppIntegrationNotFound
}

// TestWhatsAppAuth_AccountLinking_GoogleAndWhatsAppUnified testa o ciclo completo de Account Linking
func TestWhatsAppAuth_AccountLinking_GoogleAndWhatsAppUnified(t *testing.T) {
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
		"hmac-secret-linking-2026",
	)
	waAuthSvc.SetWhatsAppRepo(waRepo)

	// 1. Cria usuário legítimo via Google (sem telefone no início)
	googleUser := &domain.User{
		ID:        "user-google-101",
		Name:      "André Victor",
		Email:     "andre@gmail.com",
		Phone:     nil,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(googleUser); err != nil {
		t.Fatalf("falha ao criar usuário Google: %v", err)
	}

	// Simula login Desktop para o usuário Google
	desktopTokens, err := authSvc.IssueSessionForUser(googleUser, "Navegador Web (Windows)", "192.168.1.10")
	if err != nil {
		t.Fatalf("falha ao emitir sessão Desktop: %v", err)
	}
	if desktopTokens.AccessToken == "" {
		t.Fatal("token desktop vazio")
	}

	phone := "11999998888"
	normalizedPhone := "+5511999998888"

	// 2. Simula que anteriormente foi criada uma conta placeholder órfã pelo WhatsApp (+5511999998888@vito.local)
	placeholderUser := &domain.User{
		ID:        "user-placeholder-orphan",
		Name:      "Usuário Vito",
		Email:     "5511999998888@vito.local",
		Phone:     &normalizedPhone,
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}
	if err := userRepo.Create(placeholderUser); err != nil {
		t.Fatalf("falha ao criar usuário placeholder: %v", err)
	}

	// 3. O usuário Google autenticado vincula o seu número de WhatsApp à sua conta.
	//    Prova de posse: o número é o da integração de WhatsApp pareada pelo próprio usuário.
	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "integration-google-101",
		UserID:       googleUser.ID,
		InstanceName: "vito_user_google_101",
		Phone:        "+5511999998888",
		Status:       domain.WhatsAppStatusConnected,
	})
	err = waAuthSvc.LinkPhone(ctx, googleUser.ID, phone)
	if err != nil {
		t.Fatalf("falha ao vincular telefone ao usuário Google: %v", err)
	}

	// 4. Verifica se o telefone foi transferido para a conta Google e removido do placeholder
	updatedGoogleUser, err := userRepo.GetByID(googleUser.ID)
	if err != nil || updatedGoogleUser.Phone == nil || *updatedGoogleUser.Phone != normalizedPhone {
		t.Fatalf("esperava telefone vinculado %s, obteve %v", normalizedPhone, updatedGoogleUser.Phone)
	}

	// 5. Agora o usuário entra pelo celular usando WhatsApp OTP
	// 5.1 Solicita OTP
	err = waAuthSvc.RequestOTP(ctx, phone)
	if err != nil {
		t.Fatalf("falha ao solicitar OTP: %v", err)
	}

	re := regexp.MustCompile(`\b\d{6}\b`)
	otpCode := re.FindString(evoClient.sentText)
	if otpCode == "" {
		t.Fatalf("código OTP não encontrado na mensagem enviada: %s", evoClient.sentText)
	}

	// 5.2 Verifica OTP com identificador Mobile
	mobileTokens, verifiedUser, err := waAuthSvc.VerifyOTP(ctx, phone, otpCode, "Vito Mobile (Android)", "192.168.1.20")
	if err != nil {
		t.Fatalf("falha ao verificar OTP: %v", err)
	}
	if mobileTokens.AccessToken == "" {
		t.Fatal("token mobile vazio")
	}

	// PONTO CRUCIAL: O usuário autenticado DEVE ser o usuário Google original, NÃO uma nova conta!
	if verifiedUser.ID != googleUser.ID {
		t.Fatalf("ERRO DE CONTA DUPLICADA: esperado User ID '%s', obteve '%s'", googleUser.ID, verifiedUser.ID)
	}
	if verifiedUser.Email != "andre@gmail.com" {
		t.Fatalf("esperado e-mail da conta vinculada 'andre@gmail.com', obteve '%s'", verifiedUser.Email)
	}

	// 6. Verificação de Dispositivos Conectados:
	// A chamada ListSessions para o ID do usuário DEVE retornar AMBAS as sessões simultaneamente (Desktop e Mobile)!
	sessions, err := authSvc.ListSessions(googleUser.ID, "")
	if err != nil {
		t.Fatalf("falha ao listar sessões: %v", err)
	}

	if len(sessions) < 2 {
		t.Fatalf("esperava ao menos 2 sessões ativas para a mesma conta, obteve %d", len(sessions))
	}

	hasDesktop := false
	hasMobile := false
	for _, s := range sessions {
		if s.DeviceName == "Navegador Web (Windows)" {
			hasDesktop = true
		}
		if s.DeviceName == "Vito Mobile (Android)" {
			hasMobile = true
		}
	}

	if !hasDesktop {
		t.Errorf("sessão desktop não encontrada na lista compartilhada de dispositivos: %+v", sessions)
	}
	if !hasMobile {
		t.Errorf("sessão mobile não encontrada na lista compartilhada de dispositivos: %+v", sessions)
	}
}

// TestWhatsAppAuth_RequestOTP_UsesConnectedInstanceFallback garante que se a instância de sistema
// não estiver aberta ("open"), o serviço descobre e usa qualquer instância ativa registrada no banco.
func TestWhatsAppAuth_RequestOTP_UsesConnectedInstanceFallback(t *testing.T) {
	ctx := context.Background()
	authSvc, userRepo, _ := setupAuthServiceWithSessions(t)
	otpRepo := newMockWhatsAppAuthRepo()
	evoClient := &MockEvolutionClientForAuth{}
	waRepo := newMockWhatsAppRepoForLinking()

	// Registra instância pareada de usuário com status "connected"
	_ = waRepo.Upsert(ctx, &domain.WhatsAppIntegration{
		ID:           "integration-user-1",
		UserID:       "user-101",
		InstanceName: "vito_user_active_sender",
		Phone:        "+5511988887777",
		Status:       domain.WhatsAppStatusConnected,
	})

	waAuthSvc := service.NewWhatsAppAuthService(
		otpRepo,
		userRepo,
		authSvc,
		evoClient,
		"vito_system_offline",
		"hmac-secret-fallback-2026",
	)
	waAuthSvc.SetWhatsAppRepo(waRepo)

	// Simula que vito_system_offline retorna erro ou não está conectada
	err := waAuthSvc.RequestOTP(ctx, "11988887777")
	if err != nil {
		t.Fatalf("falha ao solicitar OTP com fallback de instância: %v", err)
	}

	if evoClient.sentTo != "+5511988887777" {
		t.Errorf("esperado destinatário '+5511988887777', obteve '%s'", evoClient.sentTo)
	}
}

func (m *MockWhatsAppRepoForLinking) ListAll(ctx context.Context) ([]domain.WhatsAppIntegration, error) {
	list := make([]domain.WhatsAppIntegration, 0, len(m.integrations))
	for _, it := range m.integrations {
		list = append(list, *it)
	}
	return list, nil
}
