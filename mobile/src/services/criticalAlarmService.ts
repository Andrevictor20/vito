export const CRITICAL_ALARM_DISMISSED_EVENT = 'CRITICAL_ALARM_DISMISSED';

export interface CriticalAlarmDismissedPayload {
  alarmId: string;
  eventTitle: string;
  dismissedAt: number;
}

export interface CriticalAlarmNativeBridge {
  scheduleCriticalAlarm?: (id: string, triggerEpochMs: number, title: string) => Promise<boolean>;
  cancelCriticalAlarm?: (id: string) => Promise<boolean>;
  canScheduleExactAlarms?: () => Promise<boolean>;
  consumePendingDismissedAlarm?: () => Promise<CriticalAlarmDismissedPayload | null>;
}

export interface CriticalAlarmEventCandidate {
  id: string;
  title: string;
  start_at: string;
  description?: string;
  critical_alarm?: boolean;
  wake_offset_minutes?: number;
}

function getDefaultNativeBridge(): CriticalAlarmNativeBridge | undefined {
  try {
    // Carregamento preguiçoso compatível com Node/tsx/Jest e React Native Android
    const rn = require('react-native');
    if (rn?.Platform?.OS !== 'android') return undefined;
    return rn?.NativeModules?.VitoAlarmModule as CriticalAlarmNativeBridge | undefined;
  } catch {
    return undefined;
  }
}

/**
 * Verifica se um evento requer o Módulo de Alarme Crítico Nativo Android
 * (via flag explícita critical_alarm ou tag [ALARME] no título/descrição).
 */
export function isCriticalAlarmEvent(ev: CriticalAlarmEventCandidate): boolean {
  if (ev.critical_alarm) return true;
  const combined = `${ev.title || ''} ${ev.description || ''}`.toUpperCase();
  return combined.includes('[ALARME]') || combined.includes('[CRITICAL_ALARM]');
}

/**
 * Agenda um alarme crítico nativo no Android via AlarmManager.setAlarmClock().
 */
export async function scheduleCriticalAlarm(
  id: string,
  triggerEpochMs: number,
  title: string,
  bridgeOverride?: CriticalAlarmNativeBridge
): Promise<boolean> {
  if (!id || !Number.isFinite(triggerEpochMs) || triggerEpochMs <= Date.now()) {
    return false;
  }
  const bridge = bridgeOverride ?? getDefaultNativeBridge();
  if (!bridge?.scheduleCriticalAlarm) {
    return false;
  }
  try {
    return await bridge.scheduleCriticalAlarm(id, Math.round(triggerEpochMs), title || 'Compromisso Inadiável');
  } catch {
    return false;
  }
}

/**
 * Cancela um alarme crítico previamente agendado no Android.
 */
export async function cancelCriticalAlarm(
  id: string,
  bridgeOverride?: CriticalAlarmNativeBridge
): Promise<boolean> {
  if (!id) return false;
  const bridge = bridgeOverride ?? getDefaultNativeBridge();
  if (!bridge?.cancelCriticalAlarm) {
    return false;
  }
  try {
    return await bridge.cancelCriticalAlarm(id);
  } catch {
    return false;
  }
}

/**
 * Sincroniza uma lista de eventos da agenda com o AlarmManager nativo do Android,
 * agendando todos os compromissos futuros marcados como alarme crítico.
 */
export async function syncCriticalAlarmsFromEvents(
  events: CriticalAlarmEventCandidate[],
  bridgeOverride?: CriticalAlarmNativeBridge
): Promise<number> {
  if (!Array.isArray(events) || events.length === 0) return 0;
  let scheduledCount = 0;
  const now = Date.now();

  for (const ev of events) {
    if (!isCriticalAlarmEvent(ev)) continue;
    const startMs = new Date(ev.start_at).getTime();
    if (!Number.isFinite(startMs)) continue;
    const offsetMs = Math.max(0, (ev.wake_offset_minutes ?? 0) * 60_000);
    const triggerMs = startMs - offsetMs;
    if (triggerMs <= now) continue;

    const cleanTitle = (ev.title || 'Compromisso Inadiável')
      .replace(/\[ALARME\]/gi, '')
      .replace(/\[CRITICAL_ALARM\]/gi, '')
      .trim();

    const ok = await scheduleCriticalAlarm(ev.id, triggerMs, cleanTitle, bridgeOverride);
    if (ok) scheduledCount += 1;
  }

  return scheduledCount;
}

export async function consumePendingDismissedAlarm(
  bridgeOverride?: CriticalAlarmNativeBridge
): Promise<CriticalAlarmDismissedPayload | null> {
  const bridge = bridgeOverride ?? getDefaultNativeBridge();
  if (!bridge?.consumePendingDismissedAlarm) {
    return null;
  }
  try {
    const res = await bridge.consumePendingDismissedAlarm();
    return res && res.alarmId ? res : null;
  } catch {
    return null;
  }
}

export function buildMorningBriefingPromptFromAlarm(payload: CriticalAlarmDismissedPayload): string {
  const title = payload.eventTitle?.trim();
  if (title) {
    return `Bom dia! Acabei de desligar o alarme de "${title}". Me dê meu briefing matinal com agenda, tarefas e alertas de hoje.`;
  }
  return 'Bom dia! Acabei de desligar o alarme. Me dê meu briefing matinal com agenda, tarefas e alertas de hoje.';
}

export function subscribeCriticalAlarmDismissed(
  onDismissed: (payload: CriticalAlarmDismissedPayload) => void,
  bridgeOverride?: CriticalAlarmNativeBridge
): () => void {
  const seenKeys = new Set<string>();
  const dispatchOnce = (payload: CriticalAlarmDismissedPayload | null | undefined) => {
    if (!payload || !payload.alarmId) return;
    const key = `${payload.alarmId}:${payload.dismissedAt || 0}`;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    onDismissed(payload);
  };

  consumePendingDismissedAlarm(bridgeOverride).then(dispatchOnce).catch(() => {});

  let sub: { remove: () => void } | null = null;
  try {
    const rn = require('react-native');
    if (rn?.Platform?.OS === 'android' && rn?.DeviceEventEmitter?.addListener) {
      sub = rn.DeviceEventEmitter.addListener(CRITICAL_ALARM_DISMISSED_EVENT, dispatchOnce);
    }
  } catch {
    sub = null;
  }

  return () => {
    sub?.remove?.();
  };
}
