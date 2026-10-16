import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MeetingsApi } from './meetingsApi';
import { ApiClient } from './client';

describe('MeetingsApi Unit Tests', () => {
  test('getMeetings e getMeeting chamam endpoints corretos', async () => {
    const calls: string[] = [];
    const client = {
      request: async (ep: string) => {
        calls.push(ep);
        return [{ id: 'm1' }];
      },
    } as unknown as ApiClient;
    const api = new MeetingsApi(client);
    const list = await api.getMeetings('open');
    assert.equal(calls[0], '/api/v1/meetings?status=open');
    assert.equal(list.length, 1);

    await api.getMeeting('m1');
    assert.equal(calls[1], '/api/v1/meetings/m1');
  });

  test('createMeeting, confirmConsensus e deleteMeeting', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return { status: 'confirmed' };
      },
    } as unknown as ApiClient;
    const api = new MeetingsApi(client);

    await api.createMeeting({ title: 'Reunião', duration_minutes: 30, slots: [] });
    assert.equal(calls[0].ep, '/api/v1/meetings');
    assert.equal(calls[0].opt?.method, 'POST');

    await api.confirmConsensus('m1', 'slot-1');
    assert.equal(calls[1].ep, '/api/v1/meetings/m1/confirm');
    assert.equal(calls[1].opt?.body, JSON.stringify({ slot_id: 'slot-1' }));

    await api.deleteMeeting('m1');
    assert.equal(calls[2].ep, '/api/v1/meetings/m1');
    assert.equal(calls[2].opt?.method, 'DELETE');
  });

  test('getWhatsAppShare chama rota de share', async () => {
    const client = {
      request: async (ep: string) => ({ whatsapp_deep_link: 'whatsapp://send' }),
    } as unknown as ApiClient;
    const api = new MeetingsApi(client);
    const res = await api.getWhatsAppShare('m1');
    assert.equal(res.whatsapp_deep_link, 'whatsapp://send');
  });
});
