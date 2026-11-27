/**
 * Cliente direto da API Pluggy (BYOK, Plano 26). Roda no celular (4G/Wi-Fi):
 * o backend do Vito nunca fala com a Pluggy (Zero IP Leak).
 */

const BASE = 'https://api.pluggy.ai';

export type PluggyErrorKind = 'invalid_keys' | 'list_items_disabled' | 'network' | 'http';

export class PluggyError extends Error {
  kind: PluggyErrorKind;
  status?: number;

  constructor(kind: PluggyErrorKind, message: string, status?: number) {
    super(message);
    this.name = 'PluggyError';
    this.kind = kind;
    this.status = status;
  }
}

async function call(fetchImpl: typeof fetch, path: string, init: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await fetchImpl(`${BASE}${path}`, init);
  } catch {
    throw new PluggyError('network', 'Sem conexão com a Pluggy. Verifique a internet e tente novamente.');
  }
  if (res.status === 401 || res.status === 403) {
    if (path.startsWith('/items')) {
      throw new PluggyError(
        'list_items_disabled',
        'Listagem em lote (/items) desabilitada nesta conta Pluggy; o itemId virá direto do Pluggy Connect.',
        res.status,
      );
    }
    throw new PluggyError('invalid_keys', 'Chaves inválidas. Confira o Client ID e o Client Secret.', res.status);
  }
  if (!res.ok) {
    throw new PluggyError('http', `A Pluggy respondeu com erro (HTTP ${res.status}).`, res.status);
  }
  return res;
}

const authHeaders = (apiKey: string): Record<string, string> => ({
  'X-API-KEY': apiKey,
  'Content-Type': 'application/json',
});

/** Valida as chaves e devolve a apiKey efêmera (~2 h). */
export async function authenticate(
  clientId: string,
  clientSecret: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await call(fetchImpl, '/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId, clientSecret }),
  });
  const json = (await res.json()) as { apiKey?: string };
  if (!json?.apiKey) throw new PluggyError('http', 'Resposta da Pluggy sem apiKey.', res.status);
  return json.apiKey;
}

/** Gera o connectToken (~30 min) usado pelo widget Pluggy Connect; aceita itemId para reconexão 1-toque. */
export async function createConnectToken(
  apiKey: string,
  clientUserId: string,
  fetchImpl: typeof fetch = fetch,
  itemId?: string,
): Promise<string> {
  const res = await call(fetchImpl, '/connect_token', {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      options: {
        clientUserId,
        oauthRedirectUri: 'vito://pluggy-success',
        ...(itemId ? { itemId } : {}),
      },
    }),
  });
  const json = (await res.json()) as { accessToken?: string };
  if (!json?.accessToken) throw new PluggyError('http', 'Resposta da Pluggy sem accessToken.', res.status);
  return json.accessToken;
}

export interface PluggyItem {
  id: string;
  connector?: { id?: number; name?: string };
  status?: string;
  executionStatus?: string;
  error?: Record<string, unknown>;
}

/** Consulta os detalhes e status de um Item específico na Pluggy. */
export async function getItem(
  apiKey: string,
  itemId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<PluggyItem | null> {
  if (!itemId) return null;
  try {
    const res = await call(fetchImpl, `/items/${encodeURIComponent(itemId)}`, {
      method: 'GET',
      headers: authHeaders(apiKey),
    });
    return (await res.json()) as PluggyItem;
  } catch {
    return null;
  }
}

/** Lista os itens (bancos conectados) da aplicação do usuário. */
export async function listItems(
  apiKey: string,
  clientUserIdOrFetch?: string | typeof fetch,
  fetchImpl: typeof fetch = fetch,
): Promise<PluggyItem[]> {
  const clientUserId = typeof clientUserIdOrFetch === 'string' ? clientUserIdOrFetch : undefined;
  const actualFetch = typeof clientUserIdOrFetch === 'function' ? clientUserIdOrFetch : fetchImpl;
  const path = clientUserId ? `/items?clientUserId=${encodeURIComponent(clientUserId)}` : '/items';
  const res = await call(actualFetch, path, { method: 'GET', headers: authHeaders(apiKey) });
  const json = (await res.json()) as { results?: PluggyItem[] };
  return Array.isArray(json?.results) ? json.results : [];
}

/** Lista nomes de conectores para a Etapa 2, tratando GET /items restrito (400/401/403) como pronto para Connect. */
export async function listConnectorNamesOrDefault(
  apiKey: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string[]> {
  try {
    const items = await listItems(apiKey, fetchImpl);
    const names = Array.from(
      new Set(items.map((item) => item.connector?.name?.trim()).filter((n): n is string => !!n)),
    );
    return names.length > 0 ? names : ['Pluggy Connect pronto para conectar'];
  } catch (err) {
    if (err instanceof PluggyError && (err.kind === 'list_items_disabled' || err.kind === 'http')) {
      return ['Pluggy Connect pronto para conectar'];
    }
    throw err;
  }
}

const DEFAULT_GET_TIMEOUT_MS = 15_000;
const DEFAULT_PATCH_TIMEOUT_MS = 25_000;
const API_KEY_TTL_MS = 110 * 60 * 1000;
const RETRY_DELAYS_MS = [1000, 3000, 7000];

export interface PluggyHttpOptions {
  timeoutMs?: number;
  maxRetries?: number;
  fetchImpl?: typeof fetch;
  sleepImpl?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

interface CachedKeyEntry {
  apiKey: string;
  expiresAt: number;
  fingerprint: string;
}

let cachedKey: CachedKeyEntry | null = null;

export function clearPluggyApiKeyCache(): void {
  cachedKey = null;
}

export async function getOrRefreshPluggyApiKey(
  clientId: string,
  clientSecret: string,
  forceRefresh = false,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const fingerprint = `${clientId}:${clientSecret.slice(0, 6)}`;
  const now = Date.now();
  if (!forceRefresh && cachedKey && cachedKey.fingerprint === fingerprint && cachedKey.expiresAt > now) {
    return cachedKey.apiKey;
  }
  const apiKey = await authenticate(clientId, clientSecret, fetchImpl);
  cachedKey = { apiKey, expiresAt: now + API_KEY_TTL_MS, fingerprint };
  return apiKey;
}

function parseRetryAfterMs(headerVal: string | null): number | null {
  if (!headerVal) return null;
  const seconds = Number(headerVal);
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, 30_000);
  }
  return null;
}

export async function pluggyFetchWithRetry(
  url: string,
  init: RequestInit = {},
  options: PluggyHttpOptions = {},
): Promise<Response> {
  const method = (init.method || 'GET').toUpperCase();
  const timeoutMs = options.timeoutMs ?? (method === 'PATCH' ? DEFAULT_PATCH_TIMEOUT_MS : DEFAULT_GET_TIMEOUT_MS);
  const maxRetries = options.maxRetries ?? RETRY_DELAYS_MS.length;
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleepImpl = options.sleepImpl ?? defaultSleep;

  let lastErr: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      clearTimeout(timer);

      if (res.status === 429 || res.status >= 500) {
        if (attempt < maxRetries) {
          const retryAfter = res.status === 429 ? parseRetryAfterMs(res.headers?.get?.('Retry-After') ?? null) : null;
          const base = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
          const jitter = Math.floor(Math.random() * 250);
          await sleepImpl((retryAfter ?? base) + jitter);
          continue;
        }
      }
      return res;
    } catch (err) {
      clearTimeout(timer);
      lastErr = err;
      if (attempt < maxRetries) {
        const base = RETRY_DELAYS_MS[Math.min(attempt, RETRY_DELAYS_MS.length - 1)];
        const jitter = Math.floor(Math.random() * 250);
        await sleepImpl(base + jitter);
        continue;
      }
    }
  }

  throw new PluggyError(
    'network',
    lastErr instanceof Error ? lastErr.message : 'Falha de rede ao comunicar com a Pluggy.',
  );
}
