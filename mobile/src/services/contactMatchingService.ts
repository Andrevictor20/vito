import { toE164Phone } from '../utils/phoneFormat';
import { P2PMeetingsApi } from './api/p2pMeetingsApi';

async function loadExpoContacts() {
  try {
    return await import('expo-contacts');
  } catch {
    return null;
  }
}

export interface LocalContactRecord {
  id: string;
  name: string;
  phoneNumbers: string[];
  emails: string[];
}

export interface MatchedContactItem {
  userId: string;
  serverName: string;
  localName?: string;
  phone: string;
  email: string;
}

/**
 * Calcula HMAC-SHA256 usando Web Crypto API (padrão Hermes / Node) ou crypto nativo.
 */
export async function computeHmacSha256(salt: string, message: string): Promise<string> {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const enc = new TextEncoder();
    const key = await globalThis.crypto.subtle.importKey(
      'raw',
      enc.encode(salt),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await globalThis.crypto.subtle.sign('HMAC', key, enc.encode(message));
    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodeCrypto = require('crypto');
    if (nodeCrypto?.createHmac) {
      return nodeCrypto.createHmac('sha256', salt).update(message).digest('hex');
    }
  } catch {
    // Ignora em runtime sem node:crypto
  }

  throw new Error('HMAC-SHA256 não disponível no ambiente');
}

/**
 * Solicita permissão ao sistema operacional para ler contatos.
 */
export async function requestContactsPermission(): Promise<boolean> {
  try {
    const Contacts = await loadExpoContacts();
    if (!Contacts?.requestPermissionsAsync) return false;
    const { status } = await Contacts.requestPermissionsAsync();
    return status === 'granted';
  } catch (err) {
    console.warn('Erro ao solicitar permissão de contatos:', err);
    return false;
  }
}

/**
 * Lê contatos da agenda do aparelho extraindo nomes, telefones e emails.
 */
export async function getDeviceContacts(): Promise<LocalContactRecord[]> {
  try {
    const Contacts = await loadExpoContacts();
    if (!Contacts?.getContactsAsync) return [];
    const response = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
    });

    if (!response || !Array.isArray(response.data)) {
      return [];
    }

    return response.data.map(c => ({
      id: c.id || String(Math.random()),
      name: c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Sem Nome',
      phoneNumbers: (c.phoneNumbers || []).map(p => p.number).filter((n): n is string => Boolean(n)),
      emails: (c.emails || []).map(e => e.email).filter((e): e is string => Boolean(e)),
    }));
  } catch (err) {
    console.warn('Erro ao ler contatos do aparelho:', err);
    return [];
  }
}

/**
 * Normaliza os identificadores dos contatos e calcula os hashes HMAC-SHA256 (Zero-Knowledge).
 */
export async function hashContactIdentifiers(
  salt: string,
  contacts: LocalContactRecord[]
): Promise<{
  hashes: string[];
  hashToContactMap: Map<string, { contact: LocalContactRecord; value: string; type: 'phone' | 'email' }>;
}> {
  const hashToContactMap = new Map<
    string,
    { contact: LocalContactRecord; value: string; type: 'phone' | 'email' }
  >();
  const uniqueHashes = new Set<string>();

  for (const contact of contacts) {
    // Processa telefones
    const seenPhones = new Set<string>();
    for (const rawPhone of contact.phoneNumbers) {
      const e164 = toE164Phone(rawPhone);
      if (e164 && !seenPhones.has(e164)) {
        seenPhones.add(e164);
        const hash = await computeHmacSha256(salt, e164);
        uniqueHashes.add(hash);
        hashToContactMap.set(hash, { contact, value: e164, type: 'phone' });
      }
    }

    // Processa emails
    const seenEmails = new Set<string>();
    for (const rawEmail of contact.emails) {
      const normalizedEmail = rawEmail.trim().toLowerCase();
      if (normalizedEmail && !seenEmails.has(normalizedEmail)) {
        seenEmails.add(normalizedEmail);
        const hash = await computeHmacSha256(salt, normalizedEmail);
        uniqueHashes.add(hash);
        hashToContactMap.set(hash, { contact, value: normalizedEmail, type: 'email' });
      }
    }
  }

  return {
    hashes: Array.from(uniqueHashes),
    hashToContactMap,
  };
}

/**
 * Executa o matching dos contatos locais com a base de usuários do Vito sem vazar dados (Zero-Knowledge).
 */
export async function matchContactsWithServer(
  api: Pick<P2PMeetingsApi, 'getChallenge' | 'matchContacts'>,
  contacts: LocalContactRecord[]
): Promise<MatchedContactItem[]> {
  if (contacts.length === 0) return [];

  // 1. Obtém salt rotativo do servidor
  const { salt } = await api.getChallenge();
  if (!salt) return [];

  // 2. Hasheia identificadores localmente
  const { hashes, hashToContactMap } = await hashContactIdentifiers(salt, contacts);
  if (hashes.length === 0) return [];

  // 3. Consulta servidor apenas com os hashes
  const matches = await api.matchContacts(salt, hashes);
  if (!matches || matches.length === 0) return [];

  // 4. Reconstrói a lista correlacionando os dados
  const matchedList: MatchedContactItem[] = [];
  const seenUserIds = new Set<string>();

  for (const match of matches) {
    if (seenUserIds.has(match.user_id)) continue;
    seenUserIds.add(match.user_id);

    // Tenta encontrar o nome local da agenda pelo telefone ou email
    let localName: string | undefined;
    for (const entry of hashToContactMap.values()) {
      if (
        (match.phone && entry.value === match.phone) ||
        (match.email && entry.value.toLowerCase() === match.email.toLowerCase())
      ) {
        localName = entry.contact.name;
        break;
      }
    }

    matchedList.push({
      userId: match.user_id,
      serverName: match.name,
      localName,
      phone: match.phone || '',
      email: match.email || '',
    });
  }

  return matchedList;
}

/**
 * Função de alto nível: lê do aparelho e faz o match completo.
 */
export async function syncAndMatchDeviceContacts(
  api: P2PMeetingsApi
): Promise<{ matched: MatchedContactItem[]; totalScanned: number; permissionGranted: boolean }> {
  const granted = await requestContactsPermission();
  if (!granted) {
    return { matched: [], totalScanned: 0, permissionGranted: false };
  }

  const deviceContacts = await getDeviceContacts();
  const matched = await matchContactsWithServer(api, deviceContacts);

  return {
    matched,
    totalScanned: deviceContacts.length,
    permissionGranted: true,
  };
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

  // 1. Prioridade máxima: contato que possui o mesmo e-mail da conta do usuário
  if (targetEmail) {
    for (const c of contacts) {
      const hasEmail = (c.emails || []).some(e => e.trim().toLowerCase() === targetEmail);
      if (hasEmail) {
        for (const p of c.phoneNumbers || []) {
          const e164 = toE164Phone(p);
          if (e164) return e164;
        }
      }
    }
  }

  // 2. Contato com nome exato do usuário ou cartão próprio ("eu", "me", "meu número")
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

/**
 * Tenta detectar silenciosamente o telefone do próprio usuário na agenda se a permissão já tiver sido concedida.
 */
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
