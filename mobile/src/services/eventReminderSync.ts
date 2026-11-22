import type { Event, Todo } from '../types';
import { notificationService } from './notificationService';
import {
  cancelCriticalAlarm,
  isCriticalAlarmEvent,
  syncCriticalAlarmsFromEvents,
} from './criticalAlarmService';

export async function syncEventsAndTodosReminders(
  events: Event[],
  todos: Todo[]
): Promise<void> {
  await notificationService.reconcileOrphanReminders(events, todos).catch(() => {});
  if (events.length > 0 || todos.length > 0) {
    notificationService.scheduleAllUpcomingReminders(events, todos).catch(() => {});
  }
  syncCriticalAlarmsFromEvents(events).catch(() => {});
}

export function scheduleEventRemindersAndAlarm(event: Event): void {
  notificationService.scheduleEventDualReminders(event).catch(() => {});
  if (isCriticalAlarmEvent(event)) {
    syncCriticalAlarmsFromEvents([event]).catch(() => {});
  } else if (event.id) {
    cancelCriticalAlarm(event.id).catch(() => {});
  }
}

export function cancelEventRemindersAndAlarms(ids: string[]): void {
  if (!Array.isArray(ids) || ids.length === 0) return;
  notificationService.cancelEventReminders(ids).catch(() => {});
  Promise.all(ids.map((id) => cancelCriticalAlarm(id))).catch(() => {});
}
