package service_test

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

// mockVisionDescriber devolve uma descrição fixa e conta as chamadas.
type mockVisionDescriber struct {
	called      int
	description string
	err         error
}

func (m *mockVisionDescriber) DescribeImage(ctx context.Context, imageB64, imageMime, prompt string) (string, error) {
	m.called++
	if m.err != nil {
		return "", m.err
	}
	return m.description, nil
}

// pngValidoBase64 é um PNG 1x1 — oayload de mídia precisa ser uma imagem de
// verdade (o PrepareImage recusa conteúdo que não é imagem).
const pngValidoBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY44YAAAAASUVORK5CYII="

// setupEnricher monta o enriquecedor de mídia com um shadow inbox isolado.
func setupEnricher(t *testing.T, vision ai.ImageDescriber) (*service.WhatsAppMediaEnricher, *mockExtendedEvolutionClient, *service.WhatsAppContextService) {
	t.Helper()
	db, err := database.Open(filepath.Join(t.TempDir(), "media.db"))
	if err != nil {
		t.Fatalf("erro ao abrir banco de teste: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID:        "user-conv-1",
		Email:     "conv@vito.local",
		Name:      "André Teste",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("erro ao criar usuário: %v", err)
	}

	convRepo := repository.NewWhatsAppConversationRepository(db)
	contextSvc := service.NewWhatsAppContextService(convRepo, service.DefaultWhatsAppContextConfig())

	mockClient := &mockExtendedEvolutionClient{
		mockState:       "open",
		mockMediaBase64: pngValidoBase64,
	}

	enricher := service.NewWhatsAppMediaEnricher(
		mockClient,
		contextSvc,
		&simpleTranscriber{transcribedText: "me lembra de pagar o boleto amanhã"},
		vision,
		service.DefaultWhatsAppMediaEnricherConfig(),
	)
	return enricher, mockClient, contextSvc
}

// TestEnricher_TranscreveAudio valida o enriquecimento de áudio.
func TestEnricher_TranscreveAudio(t *testing.T) {
	enricher, _, contextSvc := setupEnricher(t, &mockVisionDescriber{})

	msg := domain.WhatsAppConversationMessage{
		ID:           "media-audio-1",
		UserID:       "user-conv-1",
		InstanceName: "vito_conv_user",
		MediaKind:    domain.WhatsAppMediaKindAudio,
		MediaStatus:  domain.WhatsAppMediaStatusPending,
		MediaPayload: `{"key":{"id":"media-audio-1"},"message":{"audioMessage":{}}}`,
	}
	// A mensagem precisa estar arquivada: o enriquecimento atualiza o registro.
	if err := contextSvc.Archive(context.Background(), &msg); err != nil {
		t.Fatalf("falha ao arquivar: %v", err)
	}

	content, err := enricher.Enrich(context.Background(), msg)
	if err != nil {
		t.Fatalf("Enrich falhou: %v", err)
	}
	if !strings.Contains(content, "pagar o boleto") {
		t.Errorf("esperava a transcrição, obteve %q", content)
	}

	// O resultado precisa ficar gravado no shadow inbox (é o que a janela e a
	// mensagem citada vão ler depois).
	archived, err := contextSvc.MessageByID(context.Background(), "user-conv-1", msg.ID)
	if err != nil || archived == nil {
		t.Fatalf("mensagem não encontrada no shadow inbox: %v", err)
	}
	if archived.MediaStatus != domain.WhatsAppMediaStatusDone {
		t.Errorf("media_status esperado done, obteve %q", archived.MediaStatus)
	}
	if !strings.Contains(archived.MediaText, "pagar o boleto") {
		t.Errorf("media_text esperado com a transcrição, obteve %q", archived.MediaText)
	}
}

// TestEnricher_DescreveImagem valida o enriquecimento de imagem (visão).
func TestEnricher_DescreveImagem(t *testing.T) {
	vision := &mockVisionDescriber{description: "um recibo de energia de R$ 180,00"}
	enricher, _, _ := setupEnricher(t, vision)

	msg := domain.WhatsAppConversationMessage{
		ID:           "media-img-1",
		UserID:       "user-conv-1",
		InstanceName: "vito_conv_user",
		MediaKind:    domain.WhatsAppMediaKindImage,
		MediaMime:    "image/jpeg",
		MediaStatus:  domain.WhatsAppMediaStatusPending,
		MediaPayload: `{"key":{"id":"media-img-1"},"message":{"imageMessage":{}}}`,
	}

	content, err := enricher.Enrich(context.Background(), msg)
	if err != nil {
		t.Fatalf("Enrich falhou: %v", err)
	}
	if !strings.Contains(content, "R$ 180,00") {
		t.Errorf("esperava a descrição da imagem, obteve %q", content)
	}
	if vision.called != 1 {
		t.Errorf("esperava 1 chamada à visão, obteve %d", vision.called)
	}
}

// TestEnricher_NaoReprocessaMidiaConcluida garante a idempotência (custo!).
func TestEnricher_NaoReprocessaMidiaConcluida(t *testing.T) {
	vision := &mockVisionDescriber{description: "já processada"}
	enricher, _, _ := setupEnricher(t, vision)

	msg := domain.WhatsAppConversationMessage{
		ID:           "media-img-2",
		UserID:       "user-conv-1",
		InstanceName: "vito_conv_user",
		MediaKind:    domain.WhatsAppMediaKindImage,
		MediaStatus:  domain.WhatsAppMediaStatusDone,
		MediaText:    "descrição que já existe",
		MediaPayload: `{"key":{"id":"media-img-2"},"message":{"imageMessage":{}}}`,
	}

	content, err := enricher.Enrich(context.Background(), msg)
	if err != nil {
		t.Fatalf("Enrich falhou: %v", err)
	}
	if content != "descrição que já existe" {
		t.Errorf("esperava o texto já existente, obteve %q", content)
	}
	if vision.called != 0 {
		t.Errorf("mídia já concluída não deveria ser reprocessada (chamadas: %d)", vision.called)
	}
}

// TestEnricher_FalhaMarcaFailed garante que a mídia com problema não fica
// pendurada para sempre.
func TestEnricher_FalhaMarcaFailed(t *testing.T) {
	vision := &mockVisionDescriber{err: errors.New("falha simulada")}
	enricher, _, contextSvc := setupEnricher(t, vision)

	msg := domain.WhatsAppConversationMessage{
		ID:           "media-img-3",
		UserID:       "user-conv-1",
		InstanceName: "vito_conv_user",
		MediaKind:    domain.WhatsAppMediaKindImage,
		MediaStatus:  domain.WhatsAppMediaStatusPending,
		MediaPayload: `{"key":{"id":"media-img-3"},"message":{"imageMessage":{}}}`,
	}
	if err := contextSvc.Archive(context.Background(), &msg); err != nil {
		t.Fatalf("falha ao arquivar: %v", err)
	}

	if _, err := enricher.Enrich(context.Background(), msg); err == nil {
		t.Fatal("esperava erro quando a visão falha")
	}
	archived, err := contextSvc.MessageByID(context.Background(), "user-conv-1", msg.ID)
	if err != nil || archived == nil {
		t.Fatalf("mensagem não encontrada: %v", err)
	}
	if archived.MediaStatus != domain.WhatsAppMediaStatusFailed {
		t.Errorf("media_status esperado failed, obteve %q", archived.MediaStatus)
	}
}

// TestEnricher_EnriqueceBackfillRespeitaOTeto valida o teto por ciclo.
func TestEnricher_EnriqueceBackfillRespeitaOTeto(t *testing.T) {
	vision := &mockVisionDescriber{description: "uma foto"}
	enricher, _, contextSvc := setupEnricher(t, vision)

	// Arquiva 5 mídias pendentes.
	for i := 0; i < 5; i++ {
		id := "backfill-" + string(rune('a'+i))
		payload := `{"key":{"id":"` + id + `"},"message":{"imageMessage":{}}}`
		if err := contextSvc.Archive(context.Background(), &domain.WhatsAppConversationMessage{
			ID:               id,
			UserID:           "user-conv-1",
			InstanceName:     "vito_conv_user",
			ChatJID:          "5511999998888@s.whatsapp.net",
			ChatKind:         domain.WhatsAppChatKindSelf,
			Kind:             "image",
			MediaKind:        domain.WhatsAppMediaKindImage,
			MediaStatus:      domain.WhatsAppMediaStatusPending,
			MediaPayload:     payload,
			MessageTimestamp: time.Now().UTC().Add(-time.Duration(i) * time.Minute),
		}); err != nil {
			t.Fatalf("falha ao arquivar: %v", err)
		}
	}

	enriched, err := enricher.EnrichPending(context.Background(), "user-conv-1", 2)
	if err != nil {
		t.Fatalf("EnrichPending falhou: %v", err)
	}
	if enriched != 2 {
		t.Errorf("esperava 2 mídias enriquecidas (teto), obteve %d", enriched)
	}
	if vision.called != 2 {
		t.Errorf("esperava 2 chamadas à visão, obteve %d", vision.called)
	}
}

// TestEnricher_IgnoraMidiaSemPayload evita chamada à Evolution sem referência.
func TestEnricher_IgnoraMidiaSemPayload(t *testing.T) {
	vision := &mockVisionDescriber{description: "x"}
	enricher, _, _ := setupEnricher(t, vision)

	msg := domain.WhatsAppConversationMessage{
		ID:          "media-sem-payload",
		UserID:      "user-conv-1",
		MediaKind:   domain.WhatsAppMediaKindImage,
		MediaStatus: domain.WhatsAppMediaStatusPending,
	}
	if _, err := enricher.Enrich(context.Background(), msg); err == nil {
		t.Fatal("esperava erro para mídia sem payload")
	}
	if vision.called != 0 {
		t.Errorf("não deveria chamar a visão sem payload (chamadas: %d)", vision.called)
	}
}
