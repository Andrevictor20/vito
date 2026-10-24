package ai

import (
	"strings"
	"testing"
	"time"

	"github.com/andrevmp/vito/backend/internal/domain"
)

func TestParseTriggerEvalResult_ArrayCurrentData(t *testing.T) {
	// Payload idêntico ao reportado no print do usuário (onde current_data é array de strings)
	raw := `{
  "condition_met": false,
  "summary": "Nenhuma novidade relevante sobre tendências em desenvolvimento web e IA para sites",
  "paragraphs": [
    "Não foram identificados novos fatos relevantes sobre desenvolvimento web.",
    "Os únicos dados disponíveis referem-se a três matérias publicadas em outubro.",
    "Dado que não há atualização imediata, recomenda-se manter o monitoramento."
  ],
  "current_data": [
    "14/10 – Escola 5.0 aposta em tecnologia e IA para preparar jovens.",
    "13/10 – Epic Games adota AI first e Sweeney quer sobreviver.",
    "13/10 – IA reduz custos de golpes digitais e acelera expansão."
  ],
  "simulated_notification": "Sem atualizações críticas hoje",
  "confidence": 85,
  "why_relevant": "A vigília foca em tendências de IA em desenvolvimento web.",
  "urgency": "low"
}`

	trig := &domain.Trigger{
		ID:       "trig-123",
		Title:    "Novas tendências em desenvolvimento web",
		Query:    "desenvolvimento web e IA",
		Category: domain.CategoryTech,
	}

	res, err := ParseTriggerEvalResult(raw, trig)
	if err != nil {
		t.Fatalf("erro inesperado ao fazer parse: %v", err)
	}

	if res.Confidence != 85 {
		t.Errorf("esperava confidence 85, obteve %d", res.Confidence)
	}
	if res.ConditionMet {
		t.Errorf("esperava condition_met false, obteve true")
	}
	if len(res.Paragraphs) != 3 {
		t.Errorf("esperava 3 parágrafos, obteve %d", len(res.Paragraphs))
	}
	for i, p := range res.Paragraphs {
		if strings.Contains(p, `{"condition_met"`) || strings.Contains(p, `"current_data"`) {
			t.Errorf("parágrafo %d vazou JSON bruto: %s", i, p)
		}
	}
	if !strings.Contains(res.CurrentData, "Escola 5.0") || !strings.Contains(res.CurrentData, "Epic Games") {
		t.Errorf("current_data não concatenou os itens do array corretamente: %s", res.CurrentData)
	}
}

func TestParseTriggerEvalResult_StringConfidenceAndMarkdownWrap(t *testing.T) {
	// LLMs comumente envolvem em ```json ... ``` e podem enviar confidence como string "90"
	raw := "```json\n" + `{
  "condition_met": true,
  "summary": "Cotação do Dólar atingiu R$ 5,45",
  "paragraphs": "O dólar comercial abriu em queda nesta manhã.\nA moeda americana recua frente ao real.",
  "current_data": "USD/BRL = 5.45",
  "simulated_notification": "Dólar em queda",
  "confidence": "90",
  "why_relevant": "Alerta de câmbio",
  "urgency": "high"
}` + "\n```"

	trig := &domain.Trigger{
		ID:       "trig-cambio",
		Title:    "Dólar",
		Query:    "dólar hoje",
		Category: domain.CategoryFinance,
	}

	res, err := ParseTriggerEvalResult(raw, trig)
	if err != nil {
		t.Fatalf("erro inesperado: %v", err)
	}

	if res.Confidence != 90 {
		t.Errorf("esperava confidence 90, obteve %d", res.Confidence)
	}
	if !res.ConditionMet {
		t.Errorf("esperava condition_met true, obteve false")
	}
	if len(res.Paragraphs) != 2 {
		t.Errorf("esperava 2 parágrafos desmembrados de string, obteve %d", len(res.Paragraphs))
	}
	if res.Urgency != "high" {
		t.Errorf("esperava urgency high, obteve %s", res.Urgency)
	}
}

func TestParseTriggerEvalResult_MalformedJSONNeverDumpsJSONToParagraphs(t *testing.T) {
	// JSON corrompido ou truncado pela metade
	raw := `{"summary": "Notícia importante sobre tecnologia", "paragraphs": ["Parágrafo 1"], "confidence": 75, "incom`

	trig := &domain.Trigger{
		ID:       "trig-fail",
		Title:    "Tech News",
		Query:    "tech",
		Category: domain.CategoryTech,
	}

	res, err := ParseTriggerEvalResult(raw, trig)
	if err != nil {
		t.Fatalf("não deve quebrar em panic mesmo com json quebrado: %v", err)
	}

	// Não deve vazar o JSON bruto no parágrafo
	for i, p := range res.Paragraphs {
		if strings.HasPrefix(p, `{"`) {
			t.Errorf("parágrafo %d nunca deve começar com json bruto: %s", i, p)
		}
	}
	// Deve ter conseguido extrair o summary via regex
	if !strings.Contains(res.Summary, "Notícia importante") {
		t.Errorf("esperava extrair o summary por fallback regex, obteve: %s", res.Summary)
	}
	if res.Confidence != 75 {
		t.Errorf("esperava extrair confidence 75 por fallback regex, obteve %d", res.Confidence)
	}
	_ = time.Now()
}

func TestParseTriggerEvalResult_BulletsSourcesAndMetrics(t *testing.T) {
	raw := `{
  "condition_met": true,
  "summary": "Flamengo vence o Racing por 2 a 1 no Maracanã",
  "metric_label": "Último Jogo",
  "metric_value": "Flamengo 2 x 1 Racing",
  "bullets": [
    "Pedro marcou aos 34' e Arrascaeta ampliou aos 68'.",
    "Com o triunfo, o time garante vaga antecipada na semifinal.",
    "Próximo jogo: domingo, 16h, contra o Palmeiras pelo Brasileirão."
  ],
  "sources": [
    { "title": "Flamengo bate Racing no Maracanã", "name": "ge.globo", "url": "https://ge.globo.com/futebol/123" },
    { "title": "Com gols de Pedro e Arrascaeta, Fla vence", "name": "UOL Esporte", "url": "https://uol.com.br/esporte/456" }
  ],
  "confidence": 95,
  "why_relevant": "Resultado do último jogo do Flamengo com placar e próximo confronto.",
  "urgency": "breaking"
}`

	trig := &domain.Trigger{
		ID:       "trig-fla",
		Title:    "Jogos do Flamengo",
		Query:    "jogos do flamengo",
		Category: domain.CategoryEventsSports,
	}

	res, err := ParseTriggerEvalResult(raw, trig)
	if err != nil {
		t.Fatalf("erro inesperado ao parsear: %v", err)
	}

	if res.MetricLabel != "Último Jogo" {
		t.Errorf("esperava MetricLabel 'Último Jogo', obteve %q", res.MetricLabel)
	}
	if res.MetricValue != "Flamengo 2 x 1 Racing" {
		t.Errorf("esperava MetricValue 'Flamengo 2 x 1 Racing', obteve %q", res.MetricValue)
	}
	if len(res.Bullets) != 3 {
		t.Fatalf("esperava 3 bullets, obteve %d", len(res.Bullets))
	}
	if !strings.Contains(res.Bullets[0], "Pedro") {
		t.Errorf("esperava menção a Pedro no primeiro bullet: %q", res.Bullets[0])
	}
	if len(res.Sources) != 2 {
		t.Fatalf("esperava 2 fontes, obteve %d", len(res.Sources))
	}
	if res.Sources[0].Name != "ge.globo" {
		t.Errorf("esperava fonte 'ge.globo', obteve %q", res.Sources[0].Name)
	}
	if res.Urgency != "breaking" {
		t.Errorf("esperava urgency 'breaking', obteve %q", res.Urgency)
	}
}
