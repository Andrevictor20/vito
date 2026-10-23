package service_test

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/database"
	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

// TestVitoSignatureHelper_UnicoChamador: com apenas 1 pessoa chamando o Vito
// no chat, a assinatura segue o padrão "💼 Vito:" (sem parênteses).
func TestVitoSignatureHelper_UnicoChamador(t *testing.T) {
	ctx := context.Background()
	ctxSvc := setupContextServiceForSignature(t)

	// Arquiva 2 mensagens de André chamando o Vito (mesmo chamador).
	arquivaChamada(ctxSvc, "user-1", "grupo-1", "André", "@vito agenda uma reunião", true)
	arquivaChamada(ctxSvc, "user-1", "grupo-1", "André", "@vito qual é o meu próximo compromisso?", true)

	chamadores, err := ctxSvc.DistinctVitoCallers(ctx, "user-1", "grupo-1")
	if err != nil {
		t.Fatalf("DistinctVitoCallers retornou erro: %v", err)
	}
	if chamadores != 1 {
		t.Errorf("esperava 1 chamador distinto, obteve %d", chamadores)
	}

	assinatura := service.VitoSignature(ctx, ctxSvc, "user-1", "grupo-1", "André")
	if assinatura != "💼 Vito:" {
		t.Errorf("esperava assinatura padrão '💼 Vito:', obteve %q", assinatura)
	}
}

// TestVitoSignatureHelper_DoisChamadores: com 2 pessoas distintas chamando
// o Vito no mesmo chat, a assinatura inclui o nome entre parênteses.
func TestVitoSignatureHelper_DoisChamadores(t *testing.T) {
	ctx := context.Background()
	ctxSvc := setupContextServiceForSignature(t)

	// André chama o Vito.
	arquivaChamada(ctxSvc, "user-1", "grupo-1", "André", "@vito agenda uma reunião", true)
	// Isabella chama o Vito no mesmo chat.
	arquivaChamada(ctxSvc, "user-1", "grupo-1", "Isabella", "@vito qual é o meu próximo compromisso?", false)

	chamadores, err := ctxSvc.DistinctVitoCallers(ctx, "user-1", "grupo-1")
	if err != nil {
		t.Fatalf("DistinctVitoCallers retornou erro: %v", err)
	}
	if chamadores != 2 {
		t.Errorf("esperava 2 chamadores distintos, obteve %d", chamadores)
	}

	// Resposta para André: deve incluir o nome dele.
	assinaturaAndre := service.VitoSignature(ctx, ctxSvc, "user-1", "grupo-1", "André")
	if assinaturaAndre != "💼 Vito(André):" {
		t.Errorf("esperava '💼 Vito(André):', obteve %q", assinaturaAndre)
	}

	// Resposta para Isabella: deve incluir o nome dela.
	assinaturaIsabella := service.VitoSignature(ctx, ctxSvc, "user-1", "grupo-1", "Isabella")
	if assinaturaIsabella != "💼 Vito(Isabella):" {
		t.Errorf("esperava '💼 Vito(Isabella):', obteve %q", assinaturaIsabella)
	}
}

// TestVitoSignature_MensagemDoVitoNaoContaComoChamador: mensagens arquivadas
// como "vito" (respostas do próprio Vito) não devem contar como chamador.
func TestVitoSignature_MensagemDoVitoNaoContaComoChamador(t *testing.T) {
	ctx := context.Background()
	ctxSvc := setupContextServiceForSignature(t)

	// Mensagem do próprio Vito (não deve contar): Kind "vito".
	if err := ctxSvc.Archive(context.Background(), &domain.WhatsAppConversationMessage{
		ID:               "msg-vito-1",
		UserID:           "user-1",
		InstanceName:     "inst-teste",
		ChatJID:          "grupo-1",
		ChatKind:         domain.WhatsAppChatKindGroup,
		ChatLabel:        "Grupo",
		SenderJID:        "jid-vito",
		SenderName:       "Vito",
		FromMe:           true,
		Kind:             "vito",
		Text:             "💼 Vito:\n\nPronto, agendei!",
		MessageTimestamp: time.Now().UTC(),
		CreatedAt:        time.Now().UTC(),
	}); err != nil {
		panic(err)
	}
	// Uma mensagem de André com trigger (deve contar).
	arquivaChamada(ctxSvc, "user-1", "grupo-1", "André", "@vito oi", true)

	chamadores, err := ctxSvc.DistinctVitoCallers(ctx, "user-1", "grupo-1")
	if err != nil {
		t.Fatalf("DistinctVitoCallers retornou erro: %v", err)
	}
	if chamadores != 1 {
		t.Errorf("esperava 1 chamador distinto (apenas André), obteve %d", chamadores)
	}
}

// TestVitoSignature_RespostaNormalDoisChamadores: quando 2 pessoas já
// chamaram o Vito no chat, a resposta normal do Vito usa a assinatura com
// o nome de quem está sendo atendido.
func TestVitoSignature_RespostaNormalDoisChamadores(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)
	ctx := context.Background()

	// Pré-carrega o shadow inbox: André e Isabella já chamaram o Vito no
	// mesmo grupo (arquivado diretamente, pois cada um tem sua própria
	// instância e apenas fromMe=true é processado pelo Vito via webhook).
	ctxSvc := svc.ContextSvcForTest()
	arquivaChamada(ctxSvc, "user-conv-1", "grupo-1@g.us", "André", "@vito agenda uma reunião", true)
	arquivaChamada(ctxSvc, "user-conv-1", "grupo-1@g.us", "Isabella", "@vito qual é o meu compromisso?", false)

	// Agora André chama o Vito novamente (fromMe=true, dono da instância).
	enviarChamada(svc, ctx, "grupo-1@g.us", "André", true, "@vito lembra de comprar pão")

	if len(mockClient.sentMessages) == 0 {
		t.Fatal("esperava resposta do Vito")
	}
	ultima := mockClient.sentMessages[len(mockClient.sentMessages)-1].Text
	if !strings.Contains(ultima, "💼 Vito(André):") {
		t.Errorf("resposta para André deveria ter assinatura '💼 Vito(André):', obteve: %s", ultima)
	}
}

// TestVitoSignature_RespostaNormalUmChamador: com apenas 1 pessoa chamando,
// a resposta segue o padrão sem parênteses.
func TestVitoSignature_RespostaNormalUmChamador(t *testing.T) {
	svc, mockClient, _, _ := setupConversationalWhatsAppTest(t)
	ctx := context.Background()

	// Chamada única de André.
	enviarChamada(svc, ctx, "grupo-1", "André", true, "@vito oi")

	if len(mockClient.sentMessages) == 0 {
		t.Fatal("esperava resposta do Vito")
	}
	ultima := mockClient.sentMessages[len(mockClient.sentMessages)-1].Text
	if !strings.Contains(ultima, "💼 Vito:") {
		t.Errorf("resposta deveria ter assinatura '💼 Vito:', obteve: %s", ultima)
	}
	if strings.Contains(ultima, "Vito(André):") {
		t.Errorf("resposta com 1 chamador não deveria ter nome entre parênteses: %s", ultima)
	}
}

// ---- helpers ----

func setupContextServiceForSignature(t *testing.T) *service.WhatsAppContextService {
	t.Helper()
	dbPath := t.TempDir() + "/test_signature.db"
	db, err := database.Open(dbPath)
	if err != nil {
		t.Fatalf("erro ao abrir banco de teste: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })
	userRepo := repository.NewUserRepository(db)
	if err := userRepo.Create(&domain.User{
		ID:        "user-1",
		Email:     "sig@vito.local",
		Name:      "Usuário Teste",
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
	}); err != nil {
		t.Fatalf("erro ao criar usuário de teste: %v", err)
	}
	convRepo := repository.NewWhatsAppConversationRepository(db)
	return service.NewWhatsAppContextService(convRepo, service.DefaultWhatsAppContextConfig())
}

func arquivaChamada(ctxSvc *service.WhatsAppContextService, userID, chatJID, senderName, texto string, fromMe bool) {
	ctx := context.Background()
	fromMeInt := 0
	if fromMe {
		fromMeInt = 1
	}
	if err := ctxSvc.Archive(ctx, &domain.WhatsAppConversationMessage{
		ID:               "msg-" + senderName + "-" + texto[:5],
		UserID:           userID,
		InstanceName:     "inst-teste",
		ChatJID:          chatJID,
		ChatKind:         domain.WhatsAppChatKindGroup,
		ChatLabel:        "Grupo",
		SenderJID:        "jid-" + senderName,
		SenderName:       senderName,
		FromMe:           fromMeInt != 0,
		Kind:             "text",
		Text:             texto,
		MessageTimestamp: time.Now().UTC(),
		CreatedAt:        time.Now().UTC(),
	}); err != nil {
		panic(err)
	}
}

var enviarChamadaCounter int

func enviarChamada(svc *service.WhatsAppService, ctx context.Context, chatJID, senderName string, fromMe bool, texto string) {
	enviarChamadaCounter++
	payload := map[string]interface{}{
		"event":    "messages.upsert",
		"instance": "vito_conv_user",
		"data": map[string]interface{}{
			"key": map[string]interface{}{
				"remoteJid": chatJID,
				"fromMe":    fromMe,
				// ID único por chamada para evitar colisão de ON CONFLICT
				// no shadow inbox (arquivaChamada usa texto[:5] que pode colidir).
				"id": fmt.Sprintf("msg-%s-%s-%d", senderName, texto[:8], enviarChamadaCounter),
			},
			"messageType": "conversation",
			"message":     map[string]interface{}{"conversation": texto},
			"pushName":      senderName,
		},
	}
	bytesPayload, _ := json.Marshal(payload)
	if err := svc.HandleWebhook(ctx, "messages.upsert", bytesPayload); err != nil {
		panic("HandleWebhook: " + err.Error())
	}
}
