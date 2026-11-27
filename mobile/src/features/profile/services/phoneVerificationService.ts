import { ApiClient } from '../../../services/api/client';
import { toE164Phone } from '../../../utils/formatting/phoneFormat';

export interface PhoneVerificationChallenge {
  token: string;
  code: string;
  user_id: string;
  phone: string;
  verify_url: string;
  whatsapp_url: string;
  expires_at: string;
  verified: boolean;
}

export interface LocalContactRecord {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
}

export class PhoneVerificationApi {
  constructor(private client: ApiClient) {}

  async requestPhoneVerification(phone: string): Promise<PhoneVerificationChallenge> {
    return this.client.request<PhoneVerificationChallenge>('/api/v1/users/phone/request-verification', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    });
  }

  async verifyPhoneCode(payload: { code?: string; token?: string }): Promise<{ status: string; verified: boolean; phone: string }> {
    return this.client.request<{ status: string; verified: boolean; phone: string }>('/api/v1/users/phone/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }
}

async function loadExpoContacts(): Promise<any> {
  try {
    const legacy = await import('expo-contacts/legacy');
    if (legacy && (typeof legacy.getContactsAsync === 'function' || typeof legacy.requestPermissionsAsync === 'function')) {
      return legacy;
    }
  } catch {
    // Continua para o módulo base
  }
  try {
    return await import('expo-contacts');
  } catch {
    return null;
  }
}

async function getDeviceContacts(): Promise<LocalContactRecord[]> {
  try {
    const Contacts = await loadExpoContacts();
    if (!Contacts) return [];

    let rawList: any[] = [];
    if (typeof Contacts.getContactsAsync === 'function') {
      try {
        const fields = [
          Contacts.Fields?.PhoneNumbers || 'phoneNumbers',
          Contacts.Fields?.Emails || 'emails',
          Contacts.Fields?.Name || 'name',
          Contacts.Fields?.FirstName || 'firstName',
          Contacts.Fields?.LastName || 'lastName',
        ];
        const response = await Contacts.getContactsAsync({ fields });
        if (response && Array.isArray(response.data)) {
          rawList = response.data;
        }
      } catch {
        // Fallback moderno abaixo
      }
    }

    if (rawList.length === 0 && Contacts.Contact) {
      try {
        if (typeof Contacts.Contact.getAllDetails === 'function') {
          rawList = await Contacts.Contact.getAllDetails(['name', 'phones', 'emails']);
        } else if (typeof Contacts.Contact.getAll === 'function') {
          rawList = await Contacts.Contact.getAll();
        }
      } catch {
        // Sem acesso moderno
      }
    }

    if (!Array.isArray(rawList)) return [];

    return rawList.map((c: any) => {
      const rawName =
        c.name ||
        [c.firstName || c.givenName, c.lastName || c.familyName].filter(Boolean).join(' ') ||
        c.nickname ||
        c.company ||
        '';

      const phoneEntries = c.phoneNumbers || c.phones || [];
      const phoneNumbers: string[] = (Array.isArray(phoneEntries) ? phoneEntries : [])
        .map((p: any) => (typeof p === 'string' ? p : p?.number || p?.digits || p?.formattedNumber || ''))
        .filter((n: string): n is string => Boolean(n && n.trim()));

      const emailEntries = c.emails || [];
      const emails: string[] = (Array.isArray(emailEntries) ? emailEntries : [])
        .map((e: any) => (typeof e === 'string' ? e : e?.email || e?.address || ''))
        .filter((e: string): e is string => Boolean(e && e.trim()));

      return {
        id: c.id || String(Math.random()),
        name: rawName.trim() || 'Sem Nome',
        phoneNumbers,
        emails,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Procura nos contatos locais um registro correspondente ao próprio usuário (por e-mail, nome exato ou "Eu"/"Me")
 * e retorna o número normalizado em E.164.
 */
export function findSelfPhoneInContacts(
  contacts: LocalContactRecord[],
  userEmail?: string,
  userName?: string
): string {
  if (!Array.isArray(contacts) || contacts.length === 0) return '';
  const targetEmail = (userEmail || '').trim().toLowerCase();
  const targetName = (userName || '').trim().toLowerCase();

  if (targetEmail) {
    for (const c of contacts) {
      const hasEmail = (c.emails || []).some((e) => e.trim().toLowerCase() === targetEmail);
      if (hasEmail) {
        for (const p of c.phoneNumbers || []) {
          const e164 = toE164Phone(p);
          if (e164) return e164;
        }
      }
    }
  }

  const selfAliases = new Set(['eu', 'me', 'meu numero', 'meu número']);
  if (targetName) selfAliases.add(targetName);

  for (const c of contacts) {
    const cName = (c.name || '').trim().toLowerCase();
    if (cName && selfAliases.has(cName)) {
      for (const p of c.phoneNumbers || []) {
        const e164 = toE164Phone(p);
        if (e164) return e164;
      }
    }
  }

  return '';
}

/** Tenta detectar silenciosamente o telefone do próprio usuário na agenda se a permissão já tiver sido concedida. */
export async function detectUserPhoneFromDevice(
  userEmail?: string,
  userName?: string
): Promise<string> {
  try {
    const Contacts = await loadExpoContacts();
    if (!Contacts?.getPermissionsAsync) return '';
    const perm = await Contacts.getPermissionsAsync();
    if (perm?.status !== 'granted') return '';
    const contacts = await getDeviceContacts();
    return findSelfPhoneInContacts(contacts, userEmail, userName);
  } catch {
    return '';
  }
}
