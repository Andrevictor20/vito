import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findOrphanNotificationIds, shouldSkipReschedulingEvent } from './notificationReconcile';

describe('Purge série e órfãos (P3)', () => {
  it('purga notificação de evento excluído', () => {
    const scheduled = [
      { identifier: 'event-reminder-adv-a', content: { data: { eventId: 'a' } } },
      { identifier: 'event-reminder-start-b', content: { data: { eventId: 'b' } } },
    ];
    const orphans = findOrphanNotificationIds(scheduled, new Set(['a']));
    assert.deepEqual(orphans, ['event-reminder-start-b']);
  });

  it('purga série inteira (3 ids) quando título foi apagado', () => {
    const scheduled = [1, 2, 3].map((i) => ({
      identifier: `event-reminder-start-series-${i}`,
      content: { data: { eventId: `series-${i}` } },
    }));
    const orphans = findOrphanNotificationIds(scheduled, new Set([]));
    assert.equal(orphans.length, 3);
  });

  it('mantém válidos e purga todo concluído', () => {
    const scheduled = [
      { identifier: 'todo-reminder-due-t1', content: { data: { todoId: 't1' } } },
      { identifier: 'todo-reminder-due-t2', content: { data: { todoId: 't2' } } },
    ];
    const orphans = findOrphanNotificationIds(scheduled, new Set([]), new Set(['t1']));
    assert.deepEqual(orphans, ['todo-reminder-due-t2']);
  });

  it('purga lembrete de pendência concluída/excluída (W2)', () => {
    const scheduled = [
      { identifier: 'pending-reminder-p1', content: { data: { pendingId: 'p1' } } },
      { identifier: 'pending-reminder-p2', content: { data: { pendingId: 'p2' } } },
    ];
    const orphans = findOrphanNotificationIds(scheduled, new Set([]), new Set([]), new Set(['p1']));
    assert.deepEqual(orphans, ['pending-reminder-p2']);
  });

  it('impede reagendamento repetido de notificação já agendada/descartada (ex: Do my Duolingo)', () => {
    const signatures = new Map<string, number>();
    const startMs = Date.parse('2026-10-17T21:00:00Z');
    assert.equal(shouldSkipReschedulingEvent('duo-1', startMs, signatures, undefined, 'Do my Duolingo 💚'), false);
    signatures.set('duo-1', startMs);
    // Segunda chamada com o mesmo horário deve ser ignorada para não reabrir notificação descartada
    assert.equal(shouldSkipReschedulingEvent('duo-1', startMs, signatures, undefined, 'Do my Duolingo 💚'), true);
    // Se o usuário editar o horário do evento, permite reagendar
    const newStartMs = Date.parse('2026-10-17T22:00:00Z');
    assert.equal(shouldSkipReschedulingEvent('duo-1', newStartMs, signatures, undefined, 'Do my Duolingo 💚'), false);
  });

  it('deduplica múltiplos eventos idênticos (mesmo título e start_at) no mesmo lote', () => {
    const signatures = new Map<string, number>();
    const seenBatch = new Set<string>();
    const startMs = Date.parse('2026-10-17T21:00:00Z');
    assert.equal(shouldSkipReschedulingEvent('duo-1', startMs, signatures, seenBatch, 'Do my Duolingo 💚'), false);
    assert.equal(shouldSkipReschedulingEvent('duo-2', startMs, signatures, seenBatch, '  do my duolingo 💚 '), true);
  });
});

