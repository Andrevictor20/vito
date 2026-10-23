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
//
// Atenção ao 9º dígito: o celular entrega o número com o 9º dígito
// ("5511888196462") e o WhatsApp endereça o chat sem ele ("559888196462") —
// as DUAS variantes precisam ser indexadas, senão o nome salvo nunca casa.
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
	canonical := canonicalBRPhone(digits)
	c.mu.Lock()
	defer c.mu.Unlock()
	for _, jid := range []string{
		number,
		digits,
		digits + "@s.whatsapp.net",
		canonical,
		canonical + "@s.whatsapp.net",
	} {
		if jid == "" {
			continue
		}
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

// SavedContactsByNumber devolve os números de telefone (dígitos, sem sufixo
// @s.whatsapp.net) dos contatos cuja agenda foi importada pelo app e seu nome
// salvo pelo dono. É a fonte confiável de quem o usuário tem no WhatsApp — a
// Evolution não expõe a agenda (findContacts devolve 0 contato), então o
// matching "quem usa Vito" deve cruzar esta lista com a base de usuários.
func (c *WhatsAppContactsCache) SavedContactsByNumber() map[string]string {
	if c == nil {
		return nil
	}
	c.mu.RLock()
	defer c.mu.RUnlock()
	out := make(map[string]string, len(c.byJID))
	for jid, names := range c.byJID {
		saved := strings.TrimSpace(names.Saved)
		if saved == "" {
			continue
		}
		digits := phoneDigits(jid)
		if digits == "" {
			continue
		}
		out[digits] = saved
	}
	return out
}

// SetSavedFromLabels registra como nome SALVO os rótulos já persistidos que
// diferem do nome de perfil.
//
// O rótulo do shadow inbox guarda o nome salvo quando o app o importou (o
// `Relabel` do backfill mantém). Quando ele difere do pushName, é o nome que o
// dono usa — e precisa voltar ao cache para o Vito reconhecê-lo.
func (c *WhatsAppContactsCache) SetSavedFromLabels(labels, profiles map[string]string) {
	if c == nil || len(labels) == 0 {
		return
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	for jid, label := range labels {
		label = strings.TrimSpace(label)
		if label == "" || label == "Contato" || label == "Grupo" || label == "Você" {
			continue
		}
		if profile := strings.TrimSpace(profiles[jid]); profile != "" && strings.EqualFold(label, profile) {
			continue // é só o nome de perfil
		}
		names := c.byJID[jid]
		if names.Saved == "" {
			names.Saved = label
		}
		c.byJID[jid] = names
	}
}
