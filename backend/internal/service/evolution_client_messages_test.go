package service_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/service"
)

// AC-F6 — a resposta do findMessages da Evolution v2.3.7 é um envelope
// {"messages": {total, pages, currentPage, records: [...]}} (verificado no fonte).
func TestEvolutionClient_FindMessages_ParsesEnvelope(t *testing.T) {
	var receivedBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/chat/findMessages/test_inst" {
			_ = json.NewDecoder(r.Body).Decode(&receivedBody)
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{
				"messages": {
					"total": 2,
					"pages": 1,
					"currentPage": 1,
					"records": [
						{
							"id": "MSG-1",
							"key": {"id": "MSG-1", "remoteJid": "5511999998888@s.whatsapp.net", "fromMe": false},
							"pushName": "Ana",
							"messageType": "extendedTextMessage",
							"messageTimestamp": 1790000000,
							"message": {"extendedTextMessage": {"text": "pode ser quinta às 10h"}}
						},
						{
							"id": "MSG-2",
							"key": {"id": "MSG-2", "remoteJid": "5511999998888@s.whatsapp.net", "fromMe": true},
							"pushName": "Você",
							"messageType": "extendedTextMessage",
							"messageTimestamp": 1790000100,
							"message": {"extendedTextMessage": {"text": "isso aqui"}},
							"contextInfo": {
								"stanzaId": "MSG-ORIG",
								"participant": "5511999998888@s.whatsapp.net",
								"quotedMessage": {"conversation": "reunião com a Ana quinta às 10h"}
							}
						}
					]
				}
			}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := service.NewDefaultEvolutionClient(server.URL, "test_api_key", server.Client())
	messages, err := client.FindMessages(context.Background(), service.EvolutionFindMessagesInput{
		InstanceName: "test_inst",
		From:         time.Now().Add(-30 * 24 * time.Hour),
		To:           time.Now(),
		Page:         1,
		Offset:       50,
	})
	if err != nil {
		t.Fatalf("esperava sucesso, obteve erro: %v", err)
	}
	if len(messages) != 2 {
		t.Fatalf("esperava 2 mensagens, obteve %d", len(messages))
	}

	// O corpo enviado precisa ter o formato aceito pela Evolution (where + page + offset).
	where, ok := receivedBody["where"].(map[string]interface{})
	if !ok {
		t.Fatalf("esperava 'where' no body, obteve %v", receivedBody)
	}
	ts, ok := where["messageTimestamp"].(map[string]interface{})
	if !ok {
		t.Fatalf("esperava o filtro temporal em messageTimestamp, obteve %v", where)
	}
	if _, hasGTE := ts["gte"]; !hasGTE {
		t.Error("esperava 'gte' no filtro temporal")
	}
	if _, hasLTE := ts["lte"]; !hasLTE {
		t.Error("esperava 'lte' no filtro temporal (a Evolution só aplica o filtro com os dois)")
	}
	if receivedBody["offset"] != float64(50) {
		t.Errorf("esperava offset 50, obteve %v", receivedBody["offset"])
	}

	if messages[0].Text != "pode ser quinta às 10h" {
		t.Errorf("texto da mensagem incorreto: %q", messages[0].Text)
	}
	if messages[0].RemoteJID != "5511999998888@s.whatsapp.net" {
		t.Errorf("remoteJid incorreto: %q", messages[0].RemoteJID)
	}
	if messages[0].PushName != "Ana" {
		t.Errorf("pushName incorreto: %q", messages[0].PushName)
	}
	if !messages[0].FromMe == false {
		t.Errorf("fromMe incorreto: %v", messages[0].FromMe)
	}
	if messages[1].QuotedText != "reunião com a Ana quinta às 10h" {
		t.Errorf("texto citado não foi extraído: %q", messages[1].QuotedText)
	}
	if !messages[1].FromMe {
		t.Error("esperava fromMe=true na segunda mensagem")
	}
}

// AC-F15/AC-F16 — participantes de um grupo (1 participante = grupo só do usuário).
func TestEvolutionClient_FindParticipants_ParsesShape(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/group/participants/test_inst" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`{"participants":[{"id":"5511999998888@s.whatsapp.net","name":"André"}]}`))
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := service.NewDefaultEvolutionClient(server.URL, "test_api_key", server.Client())
	participants, err := client.FindParticipants(context.Background(), "test_inst", "12036300112233@g.us")
	if err != nil {
		t.Fatalf("esperava sucesso, obteve erro: %v", err)
	}
	if len(participants) != 1 {
		t.Fatalf("esperava 1 participante, obteve %d", len(participants))
	}
	if participants[0] != "5511999998888@s.whatsapp.net" {
		t.Errorf("participante incorreto: %q", participants[0])
	}
}

// AC-F15 — os nomes dos grupos vêm com subject e size.
// AC-F15 — os nomes dos grupos vêm com subject e size.
func TestEvolutionClient_FindGroups_ParsesShape(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/group/fetchAllGroups/test_inst" {
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write([]byte(`[{"id":"12036300112233@g.us","subject":"Familia","size":1}]`))
			return
		}
		http.NotFound(w, r)
	}))
	defer server.Close()

	client := service.NewDefaultEvolutionClient(server.URL, "test_api_key", server.Client())
	groups, err := client.FindGroups(context.Background(), "test_inst")
	if err != nil {
		t.Fatalf("esperava sucesso, obteve erro: %v", err)
	}
	if len(groups) != 1 {
		t.Fatalf("esperava 1 grupo, obteve %d", len(groups))
	}
	if groups[0].Subject != "Familia" {
		t.Errorf("subject incorreto: %q", groups[0].Subject)
	}
	if groups[0].Size != 1 {
		t.Errorf("size incorreto: %d", groups[0].Size)
	}
}

func TestEvolutionClient_FindMessages_FiltersByChat(t *testing.T) {
	var receivedBody map[string]interface{}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&receivedBody)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"messages":{"total":0,"pages":0,"currentPage":1,"records":[]}}`))
	}))
	defer server.Close()

	client := service.NewDefaultEvolutionClient(server.URL, "test_api_key", server.Client())
	_, err := client.FindMessages(context.Background(), service.EvolutionFindMessagesInput{
		InstanceName: "test_inst",
		RemoteJID:    "12036300112233@g.us",
		Page:         1,
		Offset:       50,
	})
	if err != nil {
		t.Fatalf("esperava sucesso, obteve erro: %v", err)
	}

	where := receivedBody["where"].(map[string]interface{})
	key, ok := where["key"].(map[string]interface{})
	if !ok {
		t.Fatalf("esperava 'where.key' no body, obteve %v", where)
	}
	if key["remoteJid"] != "12036300112233@g.us" {
		t.Errorf("esperava o filtro por remoteJid, obteve %v", key)
	}
}
