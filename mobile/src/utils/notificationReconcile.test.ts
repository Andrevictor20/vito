import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findOrphanNotificationIds } from './notificationReconcile';

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
});
