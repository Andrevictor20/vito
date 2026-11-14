/**
 * Cliente direto da API Pluggy (BYOK, Plano 26). Roda no celular (4G/Wi-Fi):
 * o backend do Vito nunca fala com a Pluggy (Zero IP Leak).
 */

const BASE = 'https://api.pluggy.ai';

export type PluggyErrorKind = 'invalid_keys' | 'network' | 'http';

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

/** Gera o connectToken (~30 min) usado pelo widget Pluggy Connect. */
export async function createConnectToken(
  apiKey: string,
  clientUserId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await call(fetchImpl, '/connect_token', {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({ clientUserId }),
  });
  const json = (await res.json()) as { accessToken?: string };
  if (!json?.accessToken) throw new PluggyError('http', 'Resposta da Pluggy sem accessToken.', res.status);
  return json.accessToken;
}

export interface PluggyItem {
  id: string;
  connector?: { id?: number; name?: string };
  status?: string;
}

/** Lista os itens (bancos conectados) da aplicação do usuário. */
export async function listItems(apiKey: string, fetchImpl: typeof fetch = fetch): Promise<PluggyItem[]> {
  const res = await call(fetchImpl, '/items', { method: 'GET', headers: authHeaders(apiKey) });
  const json = (await res.json()) as { results?: PluggyItem[] };
  return Array.isArray(json?.results) ? json.results : [];
}
