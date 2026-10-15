import type { PendingItem } from '../types';

/** Cache-first das pendências (espelho do padrão de todos em useHomeData). */
export const getPendingCacheKey = (userId?: string): string =>
  `@vito_cache_pending${userId ? `_${userId}` : ''}`;

export const parseCachedPendingItems = (raw: string | null): PendingItem[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as PendingItem[];
  } catch {
    return null;
  }
};

/** Falha de transporte (CORS/offline/timeout/DNS) vs erro HTTP com resposta. */
export const isNetworkError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return /Failed to fetch|Network request failed|Load failed|Tempo limite esgotado/i.test(msg);
};
