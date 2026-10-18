package service_test

import (
	"testing"

	"github.com/andrevmp/vito/backend/internal/service"
)

func TestWhatsAppConversationMemory_MultiTurnAndTTL(t *testing.T) {
	mem := service.NewWhatsAppConversationMemory()

	convKey := "vito_inst:559884417165@s.whatsapp.net"

	// 1. Inicialmente vazio
	hist := mem.GetHistory(convKey)
	if len(hist) != 0 {
		t.Fatalf("esperava histórico vazio, obteve %d itens", len(hist))
	}

	// 2. Adiciona turnos de diálogo
	mem.AddMessage(convKey, "user", "quais são os meus e-mails de hoje?")
	mem.AddMessage(convKey, "vito", "Você tem 3 novos e-mails importantes. Deseja que eu resuma?")
	mem.AddMessage(convKey, "user", "sim, por favor")

	hist = mem.GetHistory(convKey)
	if len(hist) != 3 {
		t.Fatalf("esperava 3 itens no histórico, obteve %d", len(hist))
	}
	if hist[0].Sender != "user" || hist[0].Text != "quais são os meus e-mails de hoje?" {
		t.Errorf("turno 0 incorreto: %+v", hist[0])
	}
	if hist[1].Sender != "vito" || hist[1].Text != "Você tem 3 novos e-mails importantes. Deseja que eu resuma?" {
		t.Errorf("turno 1 incorreto: %+v", hist[1])
	}
	if hist[2].Sender != "user" || hist[2].Text != "sim, por favor" {
		t.Errorf("turno 2 incorreto: %+v", hist[2])
	}

	// 3. Limite de turnos: insere mais 10 mensagens e garante que preserva no máximo defaultMaxHistoryTurns (8)
	for i := 1; i <= 10; i++ {
		mem.AddMessage(convKey, "user", "mensagem extra")
	}
	hist = mem.GetHistory(convKey)
	if len(hist) > 8 {
		t.Fatalf("histórico não deveria exceder 8 itens, obteve %d", len(hist))
	}

	// 4. Limpeza explícita
	mem.Clear(convKey)
	hist = mem.GetHistory(convKey)
	if len(hist) != 0 {
		t.Fatalf("esperava histórico limpo após Clear(), obteve %d itens", len(hist))
	}
}
