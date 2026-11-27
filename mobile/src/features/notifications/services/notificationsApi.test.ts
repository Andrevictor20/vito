import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationsApi } from './notificationsApi';
import { ApiClient } from '../../../services/api/client';

describe('NotificationsApi Unit Tests', () => {
  test('registerPushToken e revokePushToken enviam payloads corretos', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return { status: 'registered', token: 'ExponentPushToken[abc]' };
      },
    } as unknown as ApiClient;
    const api = new NotificationsApi(client);

    await api.registerPushToken('ExponentPushToken[abc]', 'android');
    assert.equal(calls[0].ep, '/api/v1/notifications/device-token');
    assert.equal(calls[0].opt?.method, 'POST');
    assert.equal(calls[0].opt?.body, JSON.stringify({ token: 'ExponentPushToken[abc]', platform: 'android' }));

    await api.revokePushToken('ExponentPushToken[abc]');
    assert.equal(calls[1].ep, '/api/v1/notifications/device-token');
    assert.equal(calls[1].opt?.method, 'DELETE');
    assert.equal(calls[1].opt?.body, JSON.stringify({ token: 'ExponentPushToken[abc]' }));
  });

  test('listNotifications, performAction e markAllRead normalizam inbox corretamente', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        if (ep === '/api/v1/notifications') {
          return {
            notifications: [
              { id: 'n1', group_key: 'Agora', type: 'aprovar', source_domain: 'bots', title: 'T', body: 'B', is_unread: true, actions: [{ id: 'approve', label: 'Aprovar', style: 'primary' }] },
            ],
          };
        }
        return { status: 'ok' };
      },
    } as unknown as ApiClient;
    const api = new NotificationsApi(client);

    const list = await api.listNotifications();
    assert.equal(list.length, 1);
    assert.equal(list[0].actions[0].action, 'approve');
    assert.equal(list[0].actions[0].primary, true);

    await api.performAction('n1', 'approve');
    assert.equal(calls[1].ep, '/api/v1/notifications/n1/action');
    assert.equal(calls[1].opt?.method, 'POST');

    await api.markAllRead();
    assert.equal(calls[2].ep, '/api/v1/notifications/read-all');
    assert.equal(calls[2].opt?.method, 'POST');
  });
});
