import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AC-06: Fonte unica de notificacoes na barra do Android (sem agendamento local duplicado)', () => {
  it('test_ac_06_init_clears_legacy_local_schedules', () => {
    const svcSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/notifications/services/notificationService.ts'),
      'utf8',
    );
    assert.equal(svcSrc.includes('cancelAllScheduledNotificationsAsync'), true);
    assert.equal(svcSrc.includes('legacySchedulesCleared'), true);
  });

  it('test_ac_06_mobile_hooks_do_not_schedule_local_reminders', () => {
    const srcRoot = path.resolve(__dirname, '..');
    const files = [
      'hooks/useHomeData.ts',
      'features/chat/hooks/chatMessageEffects.ts',
      'features/tasks/hooks/usePendingItems.ts',
      'features/notifications/services/notificationService.ts',
    ];
    for (const rel of files) {
      const content = fs.readFileSync(path.join(srcRoot, rel), 'utf8');
      assert.equal(
        /syncEventsAndTodosReminders|scheduleEventDualReminders|scheduleTodoReminder|schedulePendingReminder|scheduleAllUpcomingReminders|reconcileOrphanReminders|scheduleEventRemindersAndAlarm/.test(content),
        false,
        `${rel} não deve agendar lembretes locais duplicados`,
      );
    }
  });
});
