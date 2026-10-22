package service

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"
)

// WhatsAppContactNames guarda os DOIS nomes de um contato:
//
//   - Saved:   o nome que o DONO salvou na agenda do WhatsApp ("isa")
//   - Profile: o nome de perfil que a pessoa escolheu no WhatsApp ("bella")
//
// Os dois importam: o usuário chama a pessoa pelo nome que salvou, mas o
// WhatsApp mostra (e traz no webhook) o nome de perfil. Sem guardar os dois,
// o Vito reconhecia "bella" e ignorava "isa" — o nome que o dono usa.
type WhatsAppContactNames struct {
	Saved   string `json:"saved,omitempty"`
	Profile string `json:"profile,omitempty"`
}

// WhatsAppContactsCache guarda o nome de cada contato do WhatsApp (JID -> nome).
//
// Por que existe: os chats "@lid" (padrão novo do WhatsApp/Evolution v2) chegam
// sem `pushName`, e o rótulo caía no genérico "Contato". Sem o nome, o Vito não
// consegue dizer "a Ana te espera" nem resolver "as mensagens da Ana".
//
// O TTL de 1 h evita uma chamada HTTP por mensagem; a renovação é feita em
// background e o cache miss nunca bloqueia o caminho quente.
type WhatsAppContactsCache struct {
	client EvolutionAPIClient
	ttl    time.Duration

	mu         sync.RWMutex
	byJID      map[string]WhatsAppContactNames
	fetchedAt  time.Time
	refreshing bool
	// lastFetch guarda o resultado da última busca na Evolution (quantos
	// contatos vieram e com que nomes) — é o diagnóstico de por que o nome
	// SALVO do contato não chega ao Vito.
	lastFetch    int
	lastFetchErr string
	lastFetchRaw []WhatsAppContact
}

// NewWhatsAppContactsCache cria o cache de nomes de contato.
func NewWhatsAppContactsCache(client EvolutionAPIClient, ttl time.Duration) *WhatsAppContactsCache {
	if ttl <= 0 {
		ttl = time.Hour
	}
	return &WhatsAppContactsCache{
		client: client,
		ttl:    ttl,
		byJID:  make(map[string]WhatsAppContactNames),
	}
}

// Name devolve o nome principal do contato: o salvo pelo dono, com o nome de
// perfil como fallback.
//
// O nome salvo tem prioridade porque é o nome pelo qual o usuário fala da
// pessoa ("isa"). O fallback numérico evita rótulos feios como "559884097322"
// (contatos salvos só pelo telefone).
func (c *WhatsAppContactsCache) Name(jid string) string {
	if c == nil || jid == "" {
		return ""
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	names := c.byJID[jid]
	if saved := strings.TrimSpace(names.Saved); saved != "" && !looksLikePhone(saved) {
		return saved
	}
	if profile := strings.TrimSpace(names.Profile); profile != "" {
		return profile
	}
	if saved := strings.TrimSpace(names.Saved); saved != "" {
		return saved
	}
	return ""
}

// ProfileName devolve o nome de perfil escolhido pela pessoa no WhatsApp.
func (c *WhatsAppContactsCache) ProfileName(jid string) string {
	if c == nil || jid == "" {
		return ""
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	return strings.TrimSpace(c.byJID[jid].Profile)
}

// Alias devolve o OUTRO nome do contato (o que não é o principal), para o Vito
// entender "isa" e "bella" como a mesma pessoa.
func (c *WhatsAppContactsCache) Alias(jid, principal string) string {
	if c == nil || jid == "" {
		return ""
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	names := c.byJID[jid]
	saved := strings.TrimSpace(names.Saved)
	profile := strings.TrimSpace(names.Profile)
	if !strings.EqualFold(principal, saved) && saved != "" && !looksLikePhone(saved) {
		return saved
	}
	if !strings.EqualFold(principal, profile) && profile != "" {
		return profile
	}
	return ""
}

// fetchByID tenta a outra variante do contrato (`where.id`) para cada JID
// conhecido. É a via capaz de trazer o nome salvo do contato.
//
// O diagnóstico de cada tentativa é essential: sem ele não se sabe se a
// Evolution tem a agenda ou não.
func (c *WhatsAppContactsCache) fetchByID(ctx context.Context, instanceName string, jids []string) []WhatsAppContact {
	byJID, ok := c.client.(interface {
		FindContactsByID(ctx context.Context, instanceName, id string) ([]WhatsAppContact, error)
	})
	if !ok || len(jids) == 0 {
		return nil
	}
	var all []WhatsAppContact
	for i, jid := range jids {
		if i >= 8 {
			break // teto: são chamadas HTTP à Evolution
		}
		if strings.TrimSpace(jid) == "" {
			continue
		}
		contacts, err := byJID.FindContactsByID(ctx, instanceName, jid)
		if err != nil {
			log.Printf("[WhatsAppContactsCache] busca por id %s falhou: %v", jid, err)
			continue
		}
		log.Printf("[WhatsAppContactsCache] busca por id %s devolveu %d contato(s)", jid, len(contacts))
		all = append(all, contacts...)
	}
	return all
}

// SavedContactName é um nome SALVO pelo dono, com o telefone do contato.
type SavedContactName struct {
	Phone string `json:"phone"`
	Name  string `json:"name"`
}

// ImportSavedNames registra os nomes salvos que o app leu da agenda do celular.
//
// O nome salvo vive no CELULAR — a Evolution nem sempre expõe a agenda (no
// Pi ela devolve 0 contato). O app lê a agenda e envia aqui; o nome é
// indexado pelo número e, quando a Evolution devolve o contato pelo `where.id`,
// também pelo identificador @lid (que é opaco e não casa com o telefone).
//
// Devolve quantos nomes foram gravados.
func (c *WhatsAppContactsCache) ImportSavedNames(ctx context.Context, instanceName string, entries []SavedContactName) int {
	if c == nil || len(entries) == 0 {
		return 0
	}
	byID, hasByID := c.client.(interface {
		FindContactsByID(ctx context.Context, instanceName, id string) ([]WhatsAppContact, error)
	})

	imported := 0
	for _, entry := range entries {
		name := strings.TrimSpace(entry.Name)
		phone := strings.TrimSpace(entry.Phone)
		if name == "" || phone == "" {
			continue
		}
		c.SetSavedByNumber(phone, name)
		imported++

		// Ponte para o @lid: a Evolution sabe o id (lid) do contato.
		if !hasByID || instanceName == "" {
			continue
		}
		contacts, err := byID.FindContactsByID(ctx, instanceName, phone)
		if err != nil || len(contacts) == 0 {
			continue
		}
		for _, contact := range contacts {
			if contact.ID == "" {
				continue
			}
			c.Set(contact.ID, name, strings.TrimSpace(contact.PushName))
		}
	}
	log.Printf("[WhatsAppContactsCache] %d nome(s) salvo(s) importado(s) da agenda", imported)
	return imported
}

// SetSavedByNumber registra o nome SALVO de um contato a partir do seu número.
//
// O nome salvo pelo dono vive na agenda do CELULAR (a Evolution nem sempre
// expõe a agenda). O app lê a agenda e envia aqui; o nome é indexado pelo
// número e também pelo JID derivado dele — cobrindo os chats @s.whatsapp.net.
func (c *WhatsAppContactsCache) SetSavedByNumber(number, name string) {
	if c == nil {
		return
	}
	number = strings.TrimSpace(number)
	name = strings.TrimSpace(name)
	if number == "" || name == "" {
		return
	}
	digits := phoneDigits(number)
	if digits == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, jid := range []string{number, digits + "@s.whatsapp.net"} {
		names := c.byJID[jid]
		names.Saved = name
		c.byJID[jid] = names
	}
}

// NumbersKnown devolve os JIDs conhecidos cujo identificador parece um número
// (os chats @s.whatsapp.net — que são os que casam com a agenda do celular).
func (c *WhatsAppContactsCache) NumbersKnown() []string {
	if c == nil {
		return nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make([]string, 0, 8)
	for jid := range c.byJID {
		if strings.HasSuffix(jid, "@s.whatsapp.net") {
			out = append(out, jid)
		}
	}
	return out
}

// Set registra os nomes de um contato.
func (c *WhatsAppContactsCache) Set(jid, saved, profile string) {
	if c == nil || jid == "" {
		return
	}
	saved = strings.TrimSpace(saved)
	profile = strings.TrimSpace(profile)
	if saved == "" && profile == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	names := c.byJID[jid]
	names.Saved = saved
	names.Profile = profile
	c.byJID[jid] = names
}

// SetProfile registra o nome de PERFIL de um contato (o que a pessoa escolheu
// no WhatsApp), sem tocar no nome salvo.
//
// O pushName chega em toda mensagem recebida — é uma fonte mais confiável que
// o `findContacts` (que às vezes devolve o pushName vazio ou trocado). Por isso
// ele SOBRESCREVE o perfil vindo da Evolution.
func (c *WhatsAppContactsCache) SetProfile(jid, profile string) {
	if c == nil || jid == "" {
		return
	}
	profile = strings.TrimSpace(profile)
	if profile == "" {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	names := c.byJID[jid]
	names.Profile = profile
	c.byJID[jid] = names
}

// Snapshot devolve o estado do cache de nomes (diagnóstico).
//
// O Vito precisa reconhecer o contato pelo nome SALVO pelo dono ("isa") e
// também pelo nome de perfil do WhatsApp ("bella"). Este retrato mostra de
// onde cada nome veio — é o que revela se a Evolution entrega o nome salvo.
func (c *WhatsAppContactsCache) Snapshot() map[string]interface{} {
	if c == nil {
		return map[string]interface{}{"total": 0}
	}
	c.mu.RLock()
	defer c.mu.RUnlock()

	withSaved, withProfile, both := 0, 0, 0
	sample := make([]map[string]string, 0, 12)
	for jid, names := range c.byJID {
		saved := strings.TrimSpace(names.Saved)
		profile := strings.TrimSpace(names.Profile)
		if saved != "" {
			withSaved++
		}
		if profile != "" {
			withProfile++
		}
		if saved != "" && profile != "" {
			both++
		}
		if len(sample) < 12 {
			sample = append(sample, map[string]string{"jid": jid, "saved": saved, "profile": profile})
		}
	}
	return map[string]interface{}{
		"total":         len(c.byJID),
		"com_salvo":     withSaved,
		"com_perfil":    withProfile,
		"com_os_dois":   both,
		"amostra":       sample,
		"atualizado_em": c.fetchedAt.Format(time.RFC3339),
		"evolution": map[string]interface{}{
			"contatos": c.lastFetch,
			"erro":     c.lastFetchErr,
			"amostra":  c.lastFetchRaw,
		},
	}
}

// SetProfiles registra o nome de perfil (pushName) de vários contatos de uma vez.
func (c *WhatsAppContactsCache) SetProfiles(profiles map[string]string) {
	if c == nil || len(profiles) == 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	for jid, profile := range profiles {
		profile = strings.TrimSpace(profile)
		if jid == "" || profile == "" {
			continue
		}
		names := c.byJID[jid]
		names.Profile = profile
		c.byJID[jid] = names
	}
}

// Names devolve a cópia do mapa de nomes (usada para reetiquetar o histórico).
func (c *WhatsAppContactsCache) Names() map[string]string {
	if c == nil {
		return nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make(map[string]string, len(c.byJID))
	for jid, names := range c.byJID {
		saved := strings.TrimSpace(names.Saved)
		profile := strings.TrimSpace(names.Profile)
		switch {
		case saved != "" && !looksLikePhone(saved):
			out[jid] = saved
		case profile != "":
			out[jid] = profile
		case saved != "":
			out[jid] = saved
		}
	}
	return out
}

// looksLikePhone informa se o texto parece um telefone.
//
// Muitos contatos são salvos só pelo número ("559884097322"). Usar isso como
// nome no prompt é ilegível — nesses casos o nome de perfil é o melhor rótulo.
func looksLikePhone(name string) bool {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return false
	}
	digits, letters := 0, 0
	for _, r := range trimmed {
		switch {
		case r >= '0' && r <= '9':
			digits++
		case (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z'):
			letters++
		}
	}
	return digits >= 8 && letters <= 3
}

// Ensure agenda a atualização do cache em background (nunca bloqueia o webhook).
func (c *WhatsAppContactsCache) Ensure(ctx context.Context, instanceName string) {
	if c == nil || c.client == nil || instanceName == "" {
		return
	}
	c.mu.RLock()
	fresh := !c.fetchedAt.IsZero() && time.Since(c.fetchedAt) < c.ttl
	refreshing := c.refreshing
	c.mu.RUnlock()
	if fresh || refreshing {
		return
	}

	c.mu.Lock()
	if c.refreshing {
		c.mu.Unlock()
		return
	}
	c.refreshing = true
	c.mu.Unlock()

	go func() {
		defer func() {
			c.mu.Lock()
			c.refreshing = false
			c.mu.Unlock()
		}()

		base := context.WithoutCancel(ctx)
		timeout, cancel := context.WithTimeout(base, 20*time.Second)
		defer cancel()

		if _, err := c.Fetch(timeout, instanceName); err != nil {
			log.Printf("⚠️ [WhatsAppContactsCache] falha ao buscar contatos: %v", err)
		}
	}()
}

// Fetch busca os contatos da instância de forma síncrona e preenche o cache.
// Devolve quantos nomes foram resolvidos.
//
// A Evolution nem sempre devolve a agenda: quando a chamada sem filtro volta
// vazia, tenta o `where.id` (o outro formato do contrato) para os JIDs
// conhecidos — é a via que pode trazer o nome SALVO do contato.
func (c *WhatsAppContactsCache) Fetch(ctx context.Context, instanceName string, knownJIDs ...string) (int, error) {
	if c == nil || c.client == nil {
		return 0, nil
	}
	contacts, err := c.client.FindContacts(ctx, instanceName)
	if err != nil {
		c.mu.Lock()
		c.lastFetchErr = err.Error()
		c.mu.Unlock()
		return 0, err
	}

	c.mu.Lock()
	c.lastFetch = len(contacts)
	c.lastFetchErr = ""
	// Amostra do retorno cru: mostra exatamente o que a Evolution entrega.
	c.lastFetchRaw = append([]WhatsAppContact{}, contacts...)
	if len(c.lastFetchRaw) > 5 {
		c.lastFetchRaw = c.lastFetchRaw[:5]
	}
	c.mu.Unlock()

	if len(contacts) == 0 {
		contacts = c.fetchByID(ctx, instanceName, knownJIDs)
	}

	resolved := 0
	withSaved, withProfile, distinct := 0, 0, 0
	c.mu.Lock()
	for _, contact := range contacts {
		saved := strings.TrimSpace(contact.Name)
		profile := strings.TrimSpace(contact.PushName)
		if saved != "" {
			withSaved++
		}
		if profile != "" {
			withProfile++
		}
		if saved != "" && profile != "" && !strings.EqualFold(saved, profile) {
			distinct++
		}
		if saved == "" && profile == "" {
			saved = strings.TrimSpace(contact.Number)
		}
		if contact.ID == "" || (saved == "" && profile == "") {
			continue
		}
		c.byJID[contact.ID] = WhatsAppContactNames{Saved: saved, Profile: profile}
		resolved++
	}
	c.fetchedAt = time.Now()
	c.mu.Unlock()

	// Diagnóstico (sem PII): o `findContacts` da Evolution às vezes devolve o
	// pushName vazio — o que faz o nome SALVO pelo dono não chegar ao cache.
	log.Printf("[WhatsAppContactsCache] %d contato(s) da Evolution | com nome salvo: %d | com perfil: %d | nomes diferentes: %d",
		len(contacts), withSaved, withProfile, distinct)
	if len(contacts) == 0 {
		log.Printf("⚠️ [WhatsAppContactsCache] a Evolution devolveu 0 contato(s) — o nome salvo do contato não está disponível por esta via")
	}
	return resolved, nil
}
