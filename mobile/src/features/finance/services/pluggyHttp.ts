/**
 * Cliente HTTP resiliente para a API Pluggy (Edge-Sync no smartphone, Zero IP Leak).
 * Fornece timeout via AbortController, retry/backoff com jitter (rede, 429, 5xx)
 * e cache de apiKey (110 min) com auto-renovação transparente em HTTP 401.
 */
import { authenticate, PluggyError } from './pluggyService';

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
