package service

import (
	"context"
	"log"
	"strings"
)

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

		// Ponte para o @lid: a Evolution sabe o id (lid) do contato — mas só
		// responde quando o `where.id` é o identificador no formato dela.
		if !hasByID || instanceName == "" {
			continue
		}
		for _, variant := range contactIDVariants(phone) {
			contacts, err := byID.FindContactsByID(ctx, instanceName, variant)
			if err != nil || len(contacts) == 0 {
				continue
			}
			log.Printf("[WhatsAppContactsCache] contato '%s' encontrado pelo id '%s' (%d registro(s))", name, variant, len(contacts))
			for _, contact := range contacts {
				if contact.ID == "" {
					continue
				}
				c.Set(contact.ID, name, strings.TrimSpace(contact.PushName))
			}
			break
		}
	}
	log.Printf("[WhatsAppContactsCache] %d nome(s) salvo(s) importado(s) da agenda", imported)
	return imported
}

// contactIDVariants devolve as formas de identificar o contato que a Evolution
// aceita no `where.id` (o formato dela é o do identificador do WhatsApp).
func contactIDVariants(phone string) []string {
	digits := phoneDigits(phone)
	variants := []string{}
	if digits != "" {
		variants = append(variants, digits, digits+"@s.whatsapp.net")
	}
	trimmed := strings.TrimSpace(phone)
	if trimmed != "" && trimmed != digits {
		variants = append(variants, trimmed)
	}
	return variants
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
