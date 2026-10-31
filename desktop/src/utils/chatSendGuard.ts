export type SendRefusalReason = 'empty' | 'loading' | 'debounced';

export interface SendGuardInput {
  hasContent: boolean;
  loading: boolean;
  now: number;
  lastSentAt: number;
}

export interface SendGuardResult {
  allowed: boolean;
  reason?: SendRefusalReason;
  /** Timestamp a persistir como lastSentAt quando allowed. */
  sentAt: number;
}

export const SEND_DEBOUNCE_MS = 400;

/** Decide se um toque no enviar dispara exatamente um envio. */
export function shouldTriggerSend(input: SendGuardInput): SendGuardResult {
  const { hasContent, loading, now, lastSentAt } = input;
  if (!hasContent) return { allowed: false, reason: 'empty', sentAt: lastSentAt };
  if (loading) return { allowed: false, reason: 'loading', sentAt: lastSentAt };
  if (now - lastSentAt < SEND_DEBOUNCE_MS) {
    return { allowed: false, reason: 'debounced', sentAt: lastSentAt };
  }
  return { allowed: true, sentAt: now };
}
