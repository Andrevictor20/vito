package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"

	"github.com/andrevmp/vito/backend/internal/ai"
	"github.com/andrevmp/vito/backend/internal/domain"
)

// HeuristicClassifyCategory analisa o texto em linguagem natural e sugere uma das 12 categorias canônicas.
func HeuristicClassifyCategory(text string) domain.TriggerCategory {
	lower := strings.ToLower(text)

	// 1. Finanças & Investimentos
	if strings.Contains(lower, "ação") || strings.Contains(lower, "ações") ||
		strings.Contains(lower, "petr") || strings.Contains(lower, "vale") ||
		strings.Contains(lower, "itub") || strings.Contains(lower, "dólar") ||
		strings.Contains(lower, "dolar") || strings.Contains(lower, "euro") ||
		strings.Contains(lower, "selic") || strings.Contains(lower, "cdi") ||
		strings.Contains(lower, "fii") || strings.Contains(lower, "dividendo") ||
		strings.Contains(lower, "bitcoin") || strings.Contains(lower, "cripto") {
		return domain.CategoryFinance
	}

	// 2. Fiscal, Tributos & Documentos
	if strings.Contains(lower, "irpf") || strings.Contains(lower, "imposto de renda") ||
		strings.Contains(lower, "receita federal") || strings.Contains(lower, "restituição") ||
		strings.Contains(lower, "ipva") || strings.Contains(lower, "iptu") ||
		strings.Contains(lower, "licenciamento") || strings.Contains(lower, "cnh") ||
		strings.Contains(lower, "passaporte") {
		return domain.CategoryTaxesDocs
	}

	// 3. Imóveis & Leilões
	if strings.Contains(lower, "imóvel") || strings.Contains(lower, "imovel") ||
		strings.Contains(lower, "apartamento") || strings.Contains(lower, "aluguel") ||
		strings.Contains(lower, "quintoandar") || strings.Contains(lower, "zap imóveis") ||
		strings.Contains(lower, "leilão") || strings.Contains(lower, "leilao") {
		return domain.CategoryRealEstate
	}

	// 4. Automotivo & Veículos
	if strings.Contains(lower, "fipe") || strings.Contains(lower, "carro") ||
		strings.Contains(lower, "moto") || strings.Contains(lower, "veículo") ||
		strings.Contains(lower, "veiculo") || strings.Contains(lower, "combustível") ||
		strings.Contains(lower, "gasolina") || strings.Contains(lower, "recall") {
		return domain.CategoryAutomotive
	}

	// 5. Carreira, Vagas & Concursos
	if strings.Contains(lower, "vaga") || strings.Contains(lower, "concurso") ||
		strings.Contains(lower, "edital") || strings.Contains(lower, "inscrição") ||
		strings.Contains(lower, "inscricao") || strings.Contains(lower, "linkedin") ||
		strings.Contains(lower, "processo seletivo") || strings.Contains(lower, "emprego") {
		return domain.CategoryCareer
	}

	// 6. Notícias, Tendências & Setor
	if strings.Contains(lower, "notícia") || strings.Contains(lower, "noticia") ||
		strings.Contains(lower, "manchete") || strings.Contains(lower, "resumo diário") ||
		strings.Contains(lower, "geopolítica") || strings.Contains(lower, "eleição") {
		return domain.CategoryNews
	}

	// 7. Tecnologia & Lançamentos
	if strings.Contains(lower, "iphone") || strings.Contains(lower, "macbook") ||
		strings.Contains(lower, "android") || strings.Contains(lower, "apple") ||
		strings.Contains(lower, "openai") || strings.Contains(lower, "gpt") ||
		strings.Contains(lower, "gemini") || strings.Contains(lower, "api") ||
		strings.Contains(lower, "software") || strings.Contains(lower, "sdk") {
		return domain.CategoryTech
	}

	// 8. Viagens & Hospitalidade
	if strings.Contains(lower, "voo") || strings.Contains(lower, "voos") ||
		strings.Contains(lower, "passagem") || strings.Contains(lower, "passagens") ||
		strings.Contains(lower, "hotel") || strings.Contains(lower, "hospedagem") ||
		strings.Contains(lower, "viagem") || strings.Contains(lower, "viajar") ||
		strings.Contains(lower, "aeroporto") || strings.Contains(lower, "visto") {
		return domain.CategoryTravel
	}

	// 9. Compras & Queda de Preço
	if strings.Contains(lower, "comprar") || strings.Contains(lower, "preço") ||
		strings.Contains(lower, "preco") || strings.Contains(lower, "desconto") ||
		strings.Contains(lower, "promoção") || strings.Contains(lower, "promocao") ||
		strings.Contains(lower, "estoque") || strings.Contains(lower, "amazon") ||
		strings.Contains(lower, "mercado livre") {
		return domain.CategoryShopping
	}

	// 10. Eventos, Shows & Esportes
	if strings.Contains(lower, "jogo") || strings.Contains(lower, "partida") ||
		strings.Contains(lower, "futebol") || strings.Contains(lower, "flamengo") ||
		strings.Contains(lower, "corinthians") || strings.Contains(lower, "palmeiras") ||
		strings.Contains(lower, "fórmula 1") || strings.Contains(lower, "f1") ||
		strings.Contains(lower, "show") || strings.Contains(lower, "ingresso") ||
		strings.Contains(lower, "festival") || strings.Contains(lower, "lote") {
		return domain.CategoryEventsSports
	}

	// 11. Entretenimento & Mídia
	if strings.Contains(lower, "filme") || strings.Contains(lower, "série") ||
		strings.Contains(lower, "serie") || strings.Contains(lower, "netflix") ||
		strings.Contains(lower, "cinema") || strings.Contains(lower, "temporada") ||
		strings.Contains(lower, "trailer") || strings.Contains(lower, "hbo") {
		return domain.CategoryEntertainment
	}

	// 12. Clima, Meio Ambiente & Alertas
	if strings.Contains(lower, "clima") || strings.Contains(lower, "chuva") ||
		strings.Contains(lower, "temperatura") || strings.Contains(lower, "previsão") ||
		strings.Contains(lower, "previsao") || strings.Contains(lower, "temporal") ||
		strings.Contains(lower, "tempo") || strings.Contains(lower, "frio") ||
		strings.Contains(lower, "calor") {
		return domain.CategoryWeather
	}

	return domain.CategoryCustom
}

// ptStopwords remove ruído em português para expansão de busca sem IA (Lote C §9).
var ptStopwords = map[string]bool{
	"de": true, "da": true, "do": true, "das": true, "dos": true,
	"e": true, "o": true, "a": true, "os": true, "as": true,
	"em": true, "no": true, "na": true, "nos": true, "nas": true,
	"para": true, "pra": true, "com": true, "sem": true, "por": true,
	"pelo": true, "pela": true, "pelos": true, "pelas": true,
	"que": true, "se": true, "me": true, "mim": true, "lhe": true,
	"meu": true, "minha": true, "meus": true, "minhas": true,
	"seu": true, "sua": true, "seus": true, "suas": true,
	"um": true, "uma": true, "uns": true, "umas": true,
	"sobre": true, "como": true, "quando": true, "onde": true,
	"qual": true, "quais": true, "este": true, "esta": true,
	"estes": true, "estas": true, "esse": true, "essa": true,
	"esses": true, "essas": true, "aquele": true, "aquela": true,
	"isso": true, "isto": true, "aquilo": true, "muito": true,
	"mais": true, "menos": true, "ja": true, "já": true,
	"ainda": true, "tambem": true, "também": true, "ate": true, "até": true,
	"entre": true, "apos": true, "após": true, "antes": true, "depois": true,
	"durante": true, "contra": true, "sob": true, "ser": true, "estar": true,
	"ter": true, "foi": true, "sao": true, "são": true, "eh": true, "é": true,
	"avise": true, "avisar": true, "avisa": true, "monitore": true, "monitorar": true,
	"quero": true, "saber": true, "ver": true, "olhar": true, "fica": true, "ficar": true,
}

// ExpandQuery deriva a consulta de busca e 2-3 keywords curtas sem IA (Lote C §9).
// Remove stopwords pt, preserva ordem e deduplica; expanded mantém a query
// original (ou o título como fallback) para não perder a intenção do usuário.
func ExpandQuery(title, query string) (string, []string) {
	expanded := strings.TrimSpace(query)
	if expanded == "" {
		expanded = strings.TrimSpace(title)
	}
	combined := strings.TrimSpace(title + " " + query)
	// Tokeniza por letras/números (unicode-aware).
	tokens := strings.FieldsFunc(strings.ToLower(combined), func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r >= 'A' && r <= 'Z' || r > 127)
	})
	seen := map[string]bool{}
	var keywords []string
	for _, tok := range tokens {
		tok = strings.TrimSpace(tok)
		if len([]rune(tok)) <= 2 {
			continue
		}
		if ptStopwords[tok] {
			continue
		}
		if seen[tok] {
			continue
		}
		seen[tok] = true
		keywords = append(keywords, tok)
		if len(keywords) == 3 {
			break
		}
	}
	return expanded, keywords
}

// TriggerService orquestra o ciclo de vida dos disparadores de monitoramento.
type TriggerService struct {
	repo domain.TriggerRepository
}

// NewTriggerService instancia o serviço de disparadores.
func NewTriggerService(repo domain.TriggerRepository) *TriggerService {
	return &TriggerService{repo: repo}
}

// CreateTrigger cria um novo monitoramento validando e inferindo metadados se necessário.
func (s *TriggerService) CreateTrigger(userID string, input domain.CreateTriggerInput) (*domain.Trigger, error) {
	if strings.TrimSpace(input.Title) == "" {
		return nil, errors.New("o título do disparador é obrigatório")
	}
	if strings.TrimSpace(input.Query) == "" {
		return nil, errors.New("o comando/consulta de monitoramento é obrigatório")
	}

	category := input.Category
	if category == "" {
		category = HeuristicClassifyCategory(input.Title + " " + input.Query)
	}

	// Lote C §9: expande a consulta sem IA e deriva intenção/keywords.
	expandedQuery, keywords := ExpandQuery(input.Title, input.Query)
	userIntent := strings.TrimSpace(input.UserIntent)
	if userIntent == "" {
		userIntent = strings.TrimSpace(input.Title + " — " + input.Query)
	}
	searchKeywords := strings.TrimSpace(input.SearchKeywords)
	if searchKeywords == "" && len(keywords) > 0 {
		searchKeywords = strings.Join(keywords, ", ")
	}

	conditionType := input.ConditionType
	if conditionType == "" {
		conditionType = domain.ConditionDailyBrief
	}

	frequency := input.Frequency
	if frequency == "" {
		frequency = domain.FrequencyDailyMorning
	}

	daysOfWeek := strings.TrimSpace(input.DaysOfWeek)
	if daysOfWeek == "" {
		daysOfWeek = "DAILY"
	}

	scheduledTime := strings.TrimSpace(input.ScheduledTime)
	now := time.Now().UTC()
	loc := time.FixedZone("BRT", -3*3600)
	nextCheck := CalculateNextCheck(scheduledTime, frequency, now, loc)

	plan := ai.BuildTriggerSearchPlan(input.Title, input.Query, category)
	planBytes, _ := json.Marshal(plan)
	searchConfigJSON := string(planBytes)

	targetVal := input.TargetValue
	if targetVal == "" && plan.TargetValue != nil {
		targetVal = fmt.Sprintf("%.2f", *plan.TargetValue)
	}

	trigger := &domain.Trigger{
		ID:                   uuid.New().String(),
		UserID:               userID,
		Title:                input.Title,
		Category:             category,
		Query:                expandedQuery,
		UserIntent:           userIntent,
		SearchKeywords:       searchKeywords,
		SearchConfigJSON:     searchConfigJSON,
		SeenFingerprintsJSON: "[]",
		LastMetricValue:      plan.TargetValue,
		ConditionType:        conditionType,
		TargetValue:          targetVal,
		CurrentValue:         "",
		Status:               domain.TriggerStatusActive,
		Frequency:            frequency,
		ScheduledTime:        scheduledTime,
		DaysOfWeek:           daysOfWeek,
		LastRunStatus:        "",
		NextCheckAt:          &nextCheck,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	if err := s.repo.Create(trigger); err != nil {
		return nil, err
	}

	return trigger, nil
}

// CalculateNextCheck calcula a próxima ocorrência para execução do disparador.
func CalculateNextCheck(scheduledTime string, frequency domain.TriggerFrequency, now time.Time, loc *time.Location) time.Time {
	if loc == nil {
		loc = time.UTC
	}
	localNow := now.In(loc)

	// Se houver horário exato especificado (ex: "08:30" ou "16:00")
	if scheduledTime != "" && strings.Contains(scheduledTime, ":") {
		parts := strings.Split(scheduledTime, ":")
		if len(parts) == 2 {
			var hour, minute int
			_, _ = fmt.Sscanf(parts[0], "%d", &hour)
			_, _ = fmt.Sscanf(parts[1], "%d", &minute)

			candidate := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), hour, minute, 0, 0, loc)
			if !candidate.After(localNow) {
				candidate = candidate.AddDate(0, 0, 1)
			}
			return candidate.UTC()
		}
	}

	// Caso contrário, deriva da frequência padrão
	switch frequency {
	case domain.FrequencyHourly:
		return now.Add(1 * time.Hour).UTC()
	case domain.FrequencyDailyEvening:
		candidate := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 18, 0, 0, 0, loc)
		if !candidate.After(localNow) {
			candidate = candidate.AddDate(0, 0, 1)
		}
		return candidate.UTC()
	case domain.FrequencyImmediate:
		return now.Add(2 * time.Minute).UTC()
	case domain.FrequencyDailyMorning:
		fallthrough
	default:
		candidate := time.Date(localNow.Year(), localNow.Month(), localNow.Day(), 8, 30, 0, 0, loc)
		if !candidate.After(localNow) {
			candidate = candidate.AddDate(0, 0, 1)
		}
		return candidate.UTC()
	}
}

// GetTrigger retorna um disparador específico do usuário.
func (s *TriggerService) GetTrigger(id, userID string) (*domain.Trigger, error) {
	return s.repo.GetByID(id, userID)
}

// ListTriggers lista os disparadores do usuário com filtros opcionais.
func (s *TriggerService) ListTriggers(userID string, category domain.TriggerCategory, status domain.TriggerStatus) ([]domain.Trigger, error) {
	return s.repo.ListByUser(userID, category, status)
}

// ToggleStatus alterna o disparador entre ativo e pausado.
func (s *TriggerService) ToggleStatus(id, userID string) (*domain.Trigger, error) {
	t, err := s.repo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}

	newStatus := domain.TriggerStatusActive
	if t.Status == domain.TriggerStatusActive {
		newStatus = domain.TriggerStatusPaused
	}

	if err := s.repo.UpdateStatus(id, userID, newStatus); err != nil {
		return nil, err
	}

	t.Status = newStatus
	t.UpdatedAt = time.Now().UTC()
	return t, nil
}

// UpdateTrigger permite editar propriedades de um disparador existente.
func (s *TriggerService) UpdateTrigger(id, userID string, input domain.UpdateTriggerInput) (*domain.Trigger, error) {
	t, err := s.repo.GetByID(id, userID)
	if err != nil {
		return nil, err
	}

	if input.Title != nil && strings.TrimSpace(*input.Title) != "" {
		t.Title = *input.Title
	}
	if input.Category != nil && *input.Category != "" {
		t.Category = *input.Category
	}
	if input.Query != nil && strings.TrimSpace(*input.Query) != "" {
		t.Query = strings.TrimSpace(*input.Query)
	}
	if input.UserIntent != nil {
		t.UserIntent = strings.TrimSpace(*input.UserIntent)
	}
	if input.SearchKeywords != nil {
		t.SearchKeywords = strings.TrimSpace(*input.SearchKeywords)
	}
	// Lote C §9: se título/query mudaram e intent/keywords não foram
	// informados explicitamente, re-deriva via heurística sem IA.
	if (input.Title != nil || input.Query != nil) && (input.SearchKeywords == nil || strings.TrimSpace(*input.SearchKeywords) == "") {
		expanded, keywords := ExpandQuery(t.Title, t.Query)
		t.Query = expanded
		if len(keywords) > 0 {
			t.SearchKeywords = strings.Join(keywords, ", ")
		}
		if input.UserIntent == nil || strings.TrimSpace(*input.UserIntent) == "" {
			if strings.TrimSpace(t.UserIntent) == "" {
				t.UserIntent = strings.TrimSpace(t.Title + " — " + t.Query)
			}
		}
	}
	if input.ConditionType != nil {
		t.ConditionType = *input.ConditionType
	}
	if input.TargetValue != nil {
		t.TargetValue = *input.TargetValue
	}
	if input.Frequency != nil {
		t.Frequency = *input.Frequency
	}
	if input.ScheduledTime != nil {
		t.ScheduledTime = strings.TrimSpace(*input.ScheduledTime)
		loc := time.FixedZone("BRT", -3*3600)
		next := CalculateNextCheck(t.ScheduledTime, t.Frequency, time.Now().UTC(), loc)
		t.NextCheckAt = &next
	}
	if input.DaysOfWeek != nil {
		t.DaysOfWeek = strings.TrimSpace(*input.DaysOfWeek)
	}
	if input.Status != nil {
		t.Status = *input.Status
	}

	t.UpdatedAt = time.Now().UTC()
	if err := s.repo.Update(t); err != nil {
		return nil, err
	}

	return t, nil
}

// DeleteTrigger remove o disparador do usuário.
func (s *TriggerService) DeleteTrigger(id, userID string) error {
	return s.repo.Delete(id, userID)
}

// RecordTriggerEvaluation grava a checagem, atualiza o valor/status e cria o log de histórico.
func (s *TriggerService) RecordTriggerEvaluation(id string, currentValue string, status domain.TriggerStatus, logMessage string) error {
	now := time.Now().UTC()
	if err := s.repo.UpdateEvaluation(id, currentValue, status, now, nil); err != nil {
		return err
	}

	if logMessage != "" {
		log := &domain.TriggerLog{
			ID:          uuid.New().String(),
			TriggerID:   id,
			TriggeredAt: now,
			Message:     logMessage,
			IsRead:      false,
		}
		_ = s.repo.CreateLog(log)
	}

	return nil
}

// ListTriggerLogs retorna o histórico de disparos de um monitoramento.
func (s *TriggerService) ListTriggerLogs(triggerID, userID string) ([]domain.TriggerLog, error) {
	if _, err := s.repo.GetByID(triggerID, userID); err != nil {
		return nil, err
	}
	return s.repo.ListLogsByTrigger(triggerID)
}

// DeleteTriggerLog remove um registro específico de log garantindo posse do usuário.
func (s *TriggerService) DeleteTriggerLog(logID, userID string) error {
	return s.repo.DeleteLog(logID, userID)
}

// ClearTriggerLogs remove todo o histórico de logs de um disparador pertencente ao usuário.
func (s *TriggerService) ClearTriggerLogs(triggerID, userID string) error {
	if _, err := s.repo.GetByID(triggerID, userID); err != nil {
		return err
	}
	return s.repo.ClearLogs(triggerID, userID)
}

type batchUnreadLogReader interface {
	ListUnreadLogsByTriggerIDs(triggerIDs []string) (map[string][]domain.TriggerLog, error)
}

// ListUnreadLogsByTriggerIDs busca logs não lidos de múltiplos radares do usuário em batch (1 query quando suportado).
func (s *TriggerService) ListUnreadLogsByTriggerIDs(userID string, triggerIDs []string) (map[string][]domain.TriggerLog, error) {
	if len(triggerIDs) == 0 {
		return map[string][]domain.TriggerLog{}, nil
	}
	if batchRepo, ok := s.repo.(batchUnreadLogReader); ok {
		return batchRepo.ListUnreadLogsByTriggerIDs(triggerIDs)
	}
	out := make(map[string][]domain.TriggerLog, len(triggerIDs))
	for _, id := range triggerIDs {
		if logs, err := s.ListTriggerLogs(id, userID); err == nil && len(logs) > 0 {
			out[id] = logs
		}
	}
	return out, nil
}
