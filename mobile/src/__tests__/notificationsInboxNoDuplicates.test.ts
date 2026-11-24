import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  filterNotifications,
  type NotificationFilter,
} from '../features/notifications/components/notificationHelpers';
import type { InboxNotification } from '../features/notifications/services/inboxNotificationsApi';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('AC-05: Inbox sem duplicacao sintetica e filtro Avisos (info)', () => {
  it('test_ac_05_store_only_synthesizes_local_when_api_fails', () => {
    const storeSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/notifications/services/notificationsInboxStore.ts'),
      'utf8',
    );
    assert.equal(storeSrc.includes('let apiResponded = false;'), true);
    assert.equal(storeSrc.includes('if (!apiResponded)'), true);
    assert.equal(storeSrc.includes('dismissedKeys'), false);
  });

  it('test_ac_05_info_filter_and_screen_chip_close_counts', () => {
    const items: InboxNotification[] = [
      { id: '1', group_key: 'Agora', type: 'aprovar', source_domain: 'bots', title: 'A', body: '', is_unread: true, actions: [] },
      { id: '2', group_key: 'Hoje', type: 'alerta', source_domain: 'tarefas', title: 'B', body: '', is_unread: true, actions: [] },
      { id: '3', group_key: 'Hoje', type: 'info', source_domain: 'resumo', title: 'C', body: '', is_unread: false, actions: [] },
    ];

    const approveCount = filterNotifications(items, 'aprovar').length;
    const alertCount = filterNotifications(items, 'alerta').length;
    const infoCount = filterNotifications(items, 'info' as NotificationFilter).length;

    assert.equal(approveCount, 1);
    assert.equal(alertCount, 1);
    assert.equal(infoCount, 1);
    assert.equal(approveCount + alertCount + infoCount, items.length);

    const screenSrc = fs.readFileSync(
      path.resolve(__dirname, '../features/notifications/screens/NotificationsScreen.tsx'),
      'utf8',
    );
    assert.equal(screenSrc.includes("label: 'Avisos'"), true);
    assert.equal(screenSrc.includes('infoCount'), true);
  });
});
