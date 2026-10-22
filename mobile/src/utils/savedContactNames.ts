import { toE164Phone } from './phoneFormat';

export interface SavedContactName {
  phone: string;
  name: string;
}

/**
 * Monta a lista de nomes salvos a partir da agenda do celular.
 *
 * Extraída para `utils/` (sem dependência de React Native) para ser testável
 * no runner node: ignora contato sem nome (ou com o nome padrão "Sem Nome"),
 * normaliza o telefone para E.164 e remove duplicatas.
 */
export function buildSavedNames(
  contacts: { name: string; phoneNumbers: string[] }[],
): SavedContactName[] {
  const names: SavedContactName[] = [];
  const seen = new Set<string>();

  for (const contact of contacts || []) {
    const name = (contact.name || '').trim();
    if (!name || name === 'Sem Nome') continue;
    for (const raw of contact.phoneNumbers || []) {
      const phone = toE164Phone(raw);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      names.push({ phone, name });
    }
  }
  return names;
}
