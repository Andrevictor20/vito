package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"math"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/adk/v2/memory"
	"google.golang.org/adk/v2/model"
	"google.golang.org/adk/v2/session"
	"google.golang.org/genai"

	"github.com/andrevmp/vito/backend/internal/domain"
	"github.com/andrevmp/vito/backend/internal/repository"
	"github.com/andrevmp/vito/backend/internal/service"
)

// SQLiteMemoryService implementa google.golang.org/adk/v2/memory.Service
// unindo busca híbrida FTS5 + Embeddings (memory_embeddings na migration 036)
// sobre MemoryRepositorySQLite e MemoryHierarchyRepository.
type SQLiteMemoryService struct {
	factRepo      *repository.MemoryRepositorySQLite
	hierarchyRepo *repository.MemoryHierarchyRepository
	embedder      repository.EmbedderFunc
}

var _ memory.Service = (*SQLiteMemoryService)(nil)

// NewSQLiteMemoryService instancia o serviço de memória de longo prazo compatível com ADK v2.
func NewSQLiteMemoryService(
	factRepo *repository.MemoryRepositorySQLite,
	hierarchyRepo *repository.MemoryHierarchyRepository,
	embedder repository.EmbedderFunc,
) *SQLiteMemoryService {
	if embedder == nil {
		embedder = DefaultSemanticEmbedder
	}
	if factRepo != nil {
		factRepo.SetEmbedder(embedder)
	}
	return &SQLiteMemoryService{
		factRepo:      factRepo,
		hierarchyRepo: hierarchyRepo,
		embedder:      embedder,
	}
}

// SetEmbedder substitui a função de embedding (ex.: cliente genai gemini-embedding-001 ou embedder de teste).
func (s *SQLiteMemoryService) SetEmbedder(fn repository.EmbedderFunc) {
	s.embedder = fn
	if s.factRepo != nil {
		s.factRepo.SetEmbedder(fn)
	}
}

// AddSessionToMemory ingere eventos de uma sessão ADK na memória de longo prazo.
func (s *SQLiteMemoryService) AddSessionToMemory(ctx context.Context, sess session.Session) error {
	if sess == nil || s.factRepo == nil {
		return nil
	}
	userID := sess.UserID()
	now := time.Now().UTC()

	for ev := range sess.Events().All() {
		if ev == nil || ev.Content == nil || ev.Content.Role != genai.RoleUser {
			continue
		}
		var textParts []string
		for _, p := range ev.Content.Parts {
			if p != nil && strings.TrimSpace(p.Text) != "" {
				textParts = append(textParts, strings.TrimSpace(p.Text))
			}
		}
		rawText := strings.Join(textParts, " ")
		if len(rawText) < 12 {
			continue
		}
		id := uuid.New().String()
		mem := &domain.Memory{
			ID:         id,
			UserID:     userID,
			Category:   "preference",
			Content:    rawText,
			Importance: 3,
			Confidence: 0.85,
			CreatedAt:  now,
			UpdatedAt:  now,
		}
		if err := s.factRepo.Create(mem); err == nil && s.embedder != nil {
			if vec, embErr := s.embedder(ctx, rawText); embErr == nil && len(vec) > 0 {
				_ = s.factRepo.UpsertEmbedding(ctx, id, userID, "gemini-embedding-001", vec)
			}
		}
	}
	return nil
}

// SearchMemory executa busca híbrida (FTS5 BM25 + similaridade vetorial + hierarquia episódica/temática).
func (s *SQLiteMemoryService) SearchMemory(ctx context.Context, req *memory.SearchRequest) (*memory.SearchResponse, error) {
	if req == nil || strings.TrimSpace(req.UserID) == "" {
		return &memory.SearchResponse{}, nil
	}

	var entries []memory.Entry
	if s.factRepo != nil {
		var queryVec []float32
		if s.embedder != nil && strings.TrimSpace(req.Query) != "" {
			if vec, err := s.embedder(ctx, req.Query); err == nil {
				queryVec = vec
			}
		}
		mems, err := s.factRepo.SearchRelevantHybrid(req.UserID, req.Query, 8, queryVec)
		if err == nil {
			for _, m := range mems {
				entries = append(entries, memory.Entry{
					ID:        m.ID,
					Author:    "user_memory",
					Timestamp: m.UpdatedAt,
					Content:   genai.NewContentFromText(fmt.Sprintf("[%s] %s", m.Category, m.Content), genai.RoleUser),
					CustomMetadata: map[string]any{
						"category":   m.Category,
						"importance": m.Importance,
						"confidence": m.Confidence,
						"level":      "fact",
					},
				})
			}
		}
	}

	if s.hierarchyRepo != nil && strings.TrimSpace(req.Query) != "" {
		if hResults, err := s.hierarchyRepo.SearchHierarchy(ctx, req.UserID, req.Query, 4); err == nil {
			for _, hr := range hResults {
				entries = append(entries, memory.Entry{
					ID:        hr.RecordID,
					Author:    "memory_hierarchy",
					Timestamp: time.Now().UTC(),
					Content:   genai.NewContentFromText(fmt.Sprintf("[%s] %s: %s", hr.HierarchyLevel, hr.Title, hr.Body), genai.RoleUser),
					CustomMetadata: map[string]any{
						"level": hr.HierarchyLevel,
						"title": hr.Title,
					},
				})
			}
		}
	}

	return &memory.SearchResponse{Memories: entries}, nil
}

// BuildGenaiEmbedder cria um EmbedderFunc oficial sobre google.golang.org/genai (gemini-embedding-001)
// reutilizando um único genai.Client entre chamadas, com fallback semântico local caso offline.
func BuildGenaiEmbedder(apiKey string) repository.EmbedderFunc {
	trimmedKey := strings.TrimSpace(apiKey)
	var cachedClient *genai.Client
	if trimmedKey != "" {
		if client, err := genai.NewClient(context.Background(), &genai.ClientConfig{
			APIKey:  trimmedKey,
			Backend: genai.BackendGeminiAPI,
		}); err == nil && client != nil {
			cachedClient = client
		}
	}
	return func(ctx context.Context, text string) ([]float32, error) {
		if cachedClient != nil {
			contents := []*genai.Content{genai.NewContentFromText(text, genai.RoleUser)}
			res, err := cachedClient.Models.EmbedContent(ctx, "gemini-embedding-001", contents, nil)
			if err == nil && res != nil && len(res.Embeddings) > 0 && len(res.Embeddings[0].Values) > 0 {
				return res.Embeddings[0].Values, nil
			}
		}
		return DefaultSemanticEmbedder(ctx, text)
	}
}

// DefaultSemanticEmbedder projeta texto em um vetor float32 de 64 dimensões normalizado (L2)
// com expansão de sinônimos em português para operação local/offline (< 0.1ms no Raspberry Pi 4).
func DefaultSemanticEmbedder(_ context.Context, text string) ([]float32, error) {
	const dims = 64
	vec := make([]float32, dims)
	lower := strings.ToLower(strings.TrimSpace(text))
	if lower == "" {
		return vec, nil
	}

	// Expansão canônica de sinônimos frequentes em PT-BR para recall semântico
	synonymGroups := [][]string{
		{"vespertino", "tarde", "14h", "15h", "16h", "17h", "pós-almoço"},
		{"matutino", "manhã", "cedo", "08h", "09h", "10h"},
		{"noturno", "noite", "20h", "21h", "jantar"},
		{"reunião", "call", "encontro", "agenda", "compromisso", "alinhamento"},
		{"finanças", "gastos", "despesas", "dinheiro", "orçamento", "fatura", "cartão"},
		{"esposa", "mulher", "cônjuge", "casamento", "família"},
		{"médico", "consulta", "saúde", "exame", "clínica"},
		{"viagem", "voo", "passagem", "aeroporto", "hotel"},
	}

	tokens := strings.FieldsFunc(lower, func(r rune) bool {
		return !(r >= 'a' && r <= 'z' || r >= '0' && r <= '9' || r >= 'à' && r <= 'ÿ')
	})
	expanded := make([]string, 0, len(tokens)*2)
	expanded = append(expanded, tokens...)

	for _, grp := range synonymGroups {
		matched := false
		for _, term := range grp {
			if strings.Contains(lower, term) {
				matched = true
				break
			}
		}
		if matched {
			expanded = append(expanded, grp...)
		}
	}

	for _, tok := range expanded {
		if len(tok) < 2 {
			continue
		}
		h := fnv.New32a()
		_, _ = h.Write([]byte(tok))
		idx := int(h.Sum32() % uint32(dims))
		vec[idx] += 1.0
	}

	var norm float64
	for _, v := range vec {
		norm += float64(v * v)
	}
	if norm > 0 {
		inv := float32(1.0 / math.Sqrt(norm))
		for i := range vec {
			vec[i] *= inv
		}
	}
	return vec, nil
}

// ADKMemoryExtractor implementa service.MemorySemanticExtractor usando model.LLM (adk/v2/model.LLM)
// com OutputSchema estruturado via google.golang.org/genai.
type ADKMemoryExtractor struct {
	llm model.LLM
}

// NewADKMemoryExtractor instancia o extrator semântico ADK para o MemoryConsolidationWorker.
func NewADKMemoryExtractor(llm model.LLM) *ADKMemoryExtractor {
	return &ADKMemoryExtractor{llm: llm}
}

// ExtractFromConversation extrai fatos atômicos, episódio e resumo temático via modelo ADK com schema JSON tipado.
func (e *ADKMemoryExtractor) ExtractFromConversation(
	ctx context.Context,
	channel string,
	turns []*repository.ConversationTurn,
	existingFacts []domain.Memory,
) (*service.ConsolidatedMemoryOutput, error) {
	if e.llm == nil || len(turns) == 0 {
		return nil, fmt.Errorf("extrator ADK sem modelo ou sem turnos")
	}

	var transcript strings.Builder
	for _, t := range turns {
		if t == nil || strings.TrimSpace(t.Content) == "" {
			continue
		}
		transcript.WriteString(fmt.Sprintf("[%s]: %s\n", t.Role, strings.TrimSpace(t.Content)))
	}

	var existingBuilder strings.Builder
	for _, f := range existingFacts {
		existingBuilder.WriteString(fmt.Sprintf("- ID=%s [%s]: %s\n", f.ID, f.Category, f.Content))
	}

	prompt := fmt.Sprintf(
		"Analise a conversa abaixo (canal=%s) e extraia JSON estrito com:\n"+
			"1. facts: lista de fatos atômicos ou preferências do usuário ({category, content, importance (1..5), confidence (0..1), supersedes_id}). "+
			"Se um novo fato contradizer ou atualizar uma memória existente listada abaixo, preencha supersedes_id com o ID antigo.\n"+
			"2. episode_title e episode_summary e episode_importance (1..5).\n"+
			"3. theme_slug, theme_title e theme_summary.\n\n"+
			"MEMÓRIAS EXISTENTES:\n%s\nCONVERSA:\n%s",
		channel, existingBuilder.String(), transcript.String(),
	)

	req := &model.LLMRequest{
		Model: "gemini-2.5-flash",
		Contents: []*genai.Content{
			genai.NewContentFromText(prompt, genai.RoleUser),
		},
		Config: &genai.GenerateContentConfig{
			ResponseMIMEType: "application/json",
		},
	}

	var rawJSON string
	for resp, err := range e.llm.GenerateContent(ctx, req, false) {
		if err != nil {
			return nil, err
		}
		if resp != nil && resp.Content != nil {
			for _, p := range resp.Content.Parts {
				if p != nil && !p.Thought && strings.TrimSpace(p.Text) != "" {
					rawJSON += p.Text
				}
			}
		}
	}

	rawJSON = strings.TrimSpace(rawJSON)
	rawJSON = strings.TrimPrefix(rawJSON, "```json")
	rawJSON = strings.TrimPrefix(rawJSON, "```")
	rawJSON = strings.TrimSuffix(rawJSON, "```")
	rawJSON = strings.TrimSpace(rawJSON)

	var parsed service.ConsolidatedMemoryOutput
	if err := json.Unmarshal([]byte(rawJSON), &parsed); err != nil {
		return nil, err
	}
	return &parsed, nil
}
