import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { NotificationsApi } from './notificationsApi';
import { ApiClient } from './client';

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

  test('getNotificationStatus consulta endpoint /api/v1/notifications/status', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return { registered: true, device_count: 1 };
      },
    } as unknown as ApiClient;
    const api = new NotificationsApi(client);

    const status = await api.getNotificationStatus();
    assert.equal(calls[0].ep, '/api/v1/notifications/status');
    assert.equal(calls[0].opt?.method, 'GET');
    assert.equal(status.registered, true);
    assert.equal(status.device_count, 1);
  });

  test('testPushNotification dispara requisição com prioridade e títulos opcionais', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return { status: 'sent', dispatched: 1 };
      },
    } as unknown as ApiClient;
    const api = new NotificationsApi(client);

    const res = await api.testPushNotification('default', 'Teste', 'Corpo');
    assert.equal(calls[0].ep, '/api/v1/notifications/test');
    assert.equal(calls[0].opt?.method, 'POST');
    assert.equal(calls[0].opt?.body, JSON.stringify({ priority: 'default', title: 'Teste', body: 'Corpo' }));
    assert.equal(res.dispatched, 1);
  });
});
