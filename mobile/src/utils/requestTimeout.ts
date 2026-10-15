/** Timeouts e detecção de abort para chamadas de IA (run/test de radares). */
export const DEFAULT_TIMEOUT_MS = 15000;

/** Endpoints de IA (run/test) podem levar até ~2min na cascata fria. */
export const AI_ENDPOINT_TIMEOUT_MS = 120000;

const AI_TIMEOUT_PATTERNS = ['/run', '/test'];

export const resolveTimeoutMs = (endpoint: string, overrideMs?: number): number => {
  if (overrideMs && overrideMs > 0) return overrideMs;
  if (AI_TIMEOUT_PATTERNS.some((p) => endpoint.endsWith(p))) {
    return AI_ENDPOINT_TIMEOUT_MS;
  }
  return DEFAULT_TIMEOUT_MS;
};

/** Abort do fetch em qualquer runtime (AbortError ou mensagem de cancelamento). */
export const isAbortLike = (err: unknown): boolean => {
  if (!err) return false;
  if (err instanceof Error && err.name === 'AbortError') return true;
  const msg = err instanceof Error ? err.message : String(err);
  return /abort|cancelled|canceled/i.test(msg);
};
