package service

import (
	"errors"
	"strings"
	"time"

	"github.com/google/uuid"

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

	conditionType := input.ConditionType
	if conditionType == "" {
		conditionType = domain.ConditionDailyBrief
	}

	frequency := input.Frequency
	if frequency == "" {
		frequency = domain.FrequencyDailyMorning
	}

	now := time.Now().UTC()
	trigger := &domain.Trigger{
		ID:            uuid.New().String(),
		UserID:        userID,
		Title:         input.Title,
		Category:      category,
		Query:         input.Query,
		ConditionType: conditionType,
		TargetValue:   input.TargetValue,
		CurrentValue:  "",
		Status:        domain.TriggerStatusActive,
		Frequency:     frequency,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if err := s.repo.Create(trigger); err != nil {
		return nil, err
	}

	return trigger, nil
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
		t.Query = *input.Query
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
	// Verifica primeiro se o trigger pertence ao usuário
	if _, err := s.repo.GetByID(triggerID, userID); err != nil {
		return nil, err
	}
	return s.repo.ListLogsByTrigger(triggerID)
}
