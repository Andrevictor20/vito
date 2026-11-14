/** Utilitários puros para validar, extrair e mascarar chaves BYOK da Pluggy (Plano 26). */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_GLOBAL_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const JWT_RE = /^eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/;
const SECRET_TOKEN_RE = /^[A-Za-z0-9_.\-=+/]{20,128}$/;

export type CapturedKeysSource = 'clipboard' | 'scan' | 'copy' | 'auto_scan' | 'network';

export interface ParsedCapturedKeys {
  clientId: string;
  clientSecret: string;
  partial: boolean;
  maskedSecretDetected: boolean;
  source: CapturedKeysSource;
}

export function normalizeKey(value: string): string {
  return value.trim();
}

export function isPluggyUuid(value: string): boolean {
  return UUID_RE.test(normalizeKey(value));
}

/**
 * Valida candidato a Client Secret (UUID ou token alfanumérico/hex/base64 >= 20 chars),
 * rejeitando JWTs (API Key `eyJ...`), URLs, valores truncados com reticências e máscaras.
 */
export function isPlausiblePluggySecret(value: string): boolean {
  const s = normalizeKey(value);
  if (!s || s.length < 20 || s.length > 128) return false;
  if (JWT_RE.test(s) || /^https?:/i.test(s)) return false;
  if (/[•*\s]/.test(s) || /\.\.\.$|…$/.test(s)) return false;
  if (UUID_RE.test(s)) return true;
  return SECRET_TOKEN_RE.test(s) && /\d/.test(s) && !/^[a-z-]+$/.test(s);
}

/** Mostra apenas os 4 últimos caracteres; o restante vira `•`. */
export function maskSecret(value: string): string {
  if (!value) return '';
  const visible = value.length > 4 ? value.slice(-4) : '';
  return '•'.repeat(value.length - visible.length) + visible;
}

/** Máscara compacta para Client ID no atalho e chips (`xxxx••••xx`). */
export function maskClientIdShort(value: string): string {
  const clean = normalizeKey(value);
  if (!clean) return '—';
  if (clean.length <= 6) return maskSecret(clean);
  return `${clean.slice(0, 4)}••••${clean.slice(-2)}`;
}

/** Extrai todos os UUIDs válidos presentes em um texto, preservando a ordem e sem duplicatas. */
export function extractUuids(text: string): string[] {
  if (!text) return [];
  const matches = text.match(UUID_GLOBAL_RE);
  if (!matches) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const m of matches) {
    const key = m.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(m);
    }
  }
  return result;
}

export function hasIdenticalKeys(clientId: string, clientSecret: string): boolean {
  const id = normalizeKey(clientId);
  const sec = normalizeKey(clientSecret);
  return id.length > 0 && sec.length > 0 && id.toLowerCase() === sec.toLowerCase();
}

/** O Client ID da Pluggy é UUID; o Client Secret precisa não estar vazio nem ser idêntico ao ID. */
export function canValidate(clientId: string, clientSecret: string): boolean {
  return isPluggyUuid(clientId) && normalizeKey(clientSecret).length > 0 && !hasIdenticalKeys(clientId, clientSecret);
}

/** Retorna par invertido se ambos forem UUIDs válidos e distintos (para tentativa automática em 401). */
export function detectSwappedKeysCandidate(
  clientId: string,
  clientSecret: string,
): { clientId: string; clientSecret: string } | null {
  const id = normalizeKey(clientId);
  const sec = normalizeKey(clientSecret);
  if (!isPluggyUuid(id) || !isPluggyUuid(sec)) return null;
  if (id.toLowerCase() === sec.toLowerCase()) return null;
  return { clientId: sec, clientSecret: id };
}

const VALID_SOURCES: readonly CapturedKeysSource[] = ['clipboard', 'scan', 'copy', 'auto_scan', 'network'];
const VALID_TYPES = new Set(['captured_keys', 'partial_keys', 'clipboard_copy']);

/** Faz parse seguro e validação estrita das mensagens enviadas pela WebView (`onMessage`). */
export function parseCapturedKeysMessage(raw: string): ParsedCapturedKeys | null {
  if (!raw || typeof raw !== 'string') return null;
  let parsed: Record<string, unknown>;
  try {
    const json: unknown = JSON.parse(raw);
    if (!json || typeof json !== 'object' || Array.isArray(json)) return null;
    parsed = json as Record<string, unknown>;
  } catch {
    return null;
  }

  if (typeof parsed.type !== 'string' || !VALID_TYPES.has(parsed.type)) return null;

  const source: CapturedKeysSource =
    typeof parsed.source === 'string' && (VALID_SOURCES as readonly string[]).includes(parsed.source)
      ? (parsed.source as CapturedKeysSource)
      : 'scan';
  const maskedSecretDetected = parsed.maskedSecretDetected === true;

  let clientId = typeof parsed.clientId === 'string' && isPluggyUuid(parsed.clientId) ? normalizeKey(parsed.clientId) : '';
  let clientSecret =
    typeof parsed.clientSecret === 'string' && isPlausiblePluggySecret(parsed.clientSecret)
      ? normalizeKey(parsed.clientSecret)
      : '';

  if (clientId && clientSecret && clientId.toLowerCase() === clientSecret.toLowerCase()) {
    clientSecret = '';
  }

  if (!clientId || !clientSecret) {
    const rawStr = typeof parsed.rawText === 'string' ? parsed.rawText : '';
    const poolText = [
      rawStr,
      Array.isArray(parsed.uuids) ? parsed.uuids.filter((u): u is string => typeof u === 'string').join(' ') : '',
    ].join(' ');
    const found = extractUuids(poolText);
    for (const u of found) {
      if (!clientId) {
        clientId = u;
      } else if (!clientSecret && u.toLowerCase() !== clientId.toLowerCase()) {
        clientSecret = u;
      }
    }
    if (!clientSecret && found.length === 0 && (source === 'clipboard' || source === 'copy') && isPlausiblePluggySecret(rawStr)) {
      const candidate = normalizeKey(rawStr);
      if (!clientId || candidate.toLowerCase() !== clientId.toLowerCase()) {
        clientSecret = candidate;
      }
    }
  }

  if (!clientId && !clientSecret && !maskedSecretDetected) return null;

  return {
    clientId,
    clientSecret,
    partial: !(clientId && clientSecret),
    maskedSecretDetected,
    source,
  };
}
