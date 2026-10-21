package service

import (
	"context"
	"log"
	"sync"
	"time"
)

// WhatsAppGroupMeta mantém em cache os metadados de grupo do WhatsApp.
//
// Dois caches com TTLs distintos (SPEC §10.2 / P9):
//   - participantes (TTL 1 h): barato, uma chamada por grupo. Determina se o grupo
//     tem apenas o usuário (`self_group`) — decisão de segurança, então precisa ser
//     recente; em cache miss o fallback é o tipo MAIS RESTRITIVO.
//   - subjects (TTL 24 h): `fetchAllGroups` faz uma chamada de avatar por grupo,
//     então só roda em job de background diário.
type WhatsAppGroupMeta struct {
	client          EvolutionAPIClient
	participantsTTL time.Duration
	labelsTTL       time.Duration

	mu               sync.RWMutex
	participants     map[string]groupParticipantInfo
	refreshing       map[string]bool
	labels           map[string]string
	labelsAt         time.Time
	labelsRefreshing bool
}

type groupParticipantInfo struct {
	count     int
	fetchedAt time.Time
}

// NewWhatsAppGroupMeta cria o cache de metadados de grupo.
func NewWhatsAppGroupMeta(client EvolutionAPIClient, participantsTTL, labelsTTL time.Duration) *WhatsAppGroupMeta {
	if participantsTTL <= 0 {
		participantsTTL = time.Hour
	}
	if labelsTTL <= 0 {
		labelsTTL = 24 * time.Hour
	}
	return &WhatsAppGroupMeta{
		client:          client,
		participantsTTL: participantsTTL,
		labelsTTL:       labelsTTL,
		participants:    make(map[string]groupParticipantInfo),
		refreshing:      make(map[string]bool),
		labels:          make(map[string]string),
	}
}

// ParticipantsCount devolve a contagem de participantes do grupo e se o dado é fresco.
// Dado ausente ou velho => (0, false) => o chamador aplica o fallback restritivo.
func (g *WhatsAppGroupMeta) ParticipantsCount(groupJID string) (int, bool) {
	if g == nil || groupJID == "" {
		return 0, false
	}
	g.mu.RLock()
	info, ok := g.participants[groupJID]
	g.mu.RUnlock()
	if !ok {
		return 0, false
	}
	if time.Since(info.fetchedAt) > g.participantsTTL {
		return 0, false
	}
	return info.count, true
}

// EnsureLabels agenda a atualização do cache de subjects dos grupos em background.
// `fetchAllGroups` faz uma chamada de avatar por grupo, então roda no máximo uma vez por TTL.
func (g *WhatsAppGroupMeta) EnsureLabels(ctx context.Context, instanceName string) {
	if g == nil || g.client == nil || instanceName == "" {
		return
	}
	g.mu.Lock()
	if !g.labelsAt.IsZero() && time.Since(g.labelsAt) < g.labelsTTL {
		g.mu.Unlock()
		return
	}
	if g.labelsRefreshing {
		g.mu.Unlock()
		return
	}
	g.labelsRefreshing = true
	g.mu.Unlock()

	go func() {
		defer func() {
			g.mu.Lock()
			g.labelsRefreshing = false
			g.mu.Unlock()
		}()

		base := context.WithoutCancel(ctx)
		timeout, cancel := context.WithTimeout(base, 60*time.Second)
		defer cancel()

		if err := g.RefreshLabels(timeout, instanceName); err != nil {
			log.Printf("⚠️ [WhatsAppGroupMeta] falha ao atualizar nomes de grupo: %v", err)
		}
	}()
}

// SetParticipants semeia o cache de participantes de um grupo.
// Usado pelo backfill (que já conhece a composição dos grupos) e pelos testes.
func (g *WhatsAppGroupMeta) SetParticipants(groupJID string, count int) {
	if g == nil || groupJID == "" {
		return
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	g.participants[groupJID] = groupParticipantInfo{count: count, fetchedAt: time.Now()}
}

// Subject devolve o nome (subject) do grupo, se conhecido.
func (g *WhatsAppGroupMeta) Subject(groupJID string) string {
	if g == nil || groupJID == "" {
		return ""
	}
	g.mu.RLock()
	defer g.mu.RUnlock()
	return g.labels[groupJID]
}

// EnsureParticipants agenda a atualização do cache de participantes em background.
// Nunca bloqueia o caminho quente: em cache miss o Vito usa o fallback restritivo.
func (g *WhatsAppGroupMeta) EnsureParticipants(ctx context.Context, instanceName, groupJID string) {
	if g == nil || g.client == nil || instanceName == "" || groupJID == "" {
		return
	}
	if _, fresh := g.ParticipantsCount(groupJID); fresh {
		return
	}

	g.mu.Lock()
	if g.refreshing[groupJID] {
		g.mu.Unlock()
		return
	}
	g.refreshing[groupJID] = true
	g.mu.Unlock()

	go func() {
		defer func() {
			g.mu.Lock()
			delete(g.refreshing, groupJID)
			g.mu.Unlock()
		}()

		// O contexto da requisição é cancelado quando o webhook termina;
		// a renovação do cache precisa sobreviver a ele.
		base := context.WithoutCancel(ctx)
		timeout, cancel := context.WithTimeout(base, 10*time.Second)
		defer cancel()

		participants, err := g.client.FindParticipants(timeout, instanceName, groupJID)
		if err != nil {
			log.Printf("⚠️ [WhatsAppGroupMeta] falha ao buscar participantes de %s: %v", groupJID, err)
			return
		}
		g.mu.Lock()
		g.participants[groupJID] = groupParticipantInfo{count: len(participants), fetchedAt: time.Now()}
		g.mu.Unlock()
	}()
}

// RefreshLabels busca os grupos da instância e atualiza o cache de subjects.
// Deve rodar em background (job diário): `fetchAllGroups` faz uma chamada de avatar por grupo.
func (g *WhatsAppGroupMeta) RefreshLabels(ctx context.Context, instanceName string) error {
	if g == nil || g.client == nil || instanceName == "" {
		return nil
	}
	groups, err := g.client.FindGroups(ctx, instanceName)
	if err != nil {
		return err
	}
	g.mu.Lock()
	g.labels = make(map[string]string, len(groups))
	for _, grp := range groups {
		subject := grp.Subject
		if subject == "" {
			subject = "Grupo"
		}
		g.labels[grp.ID] = subject
	}
	g.labelsAt = time.Now()
	g.mu.Unlock()
	return nil
}
