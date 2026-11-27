import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { MeetingsApi } from './bookingApi';
import { ApiClient } from '../../../services/api/client';

describe('MeetingsApi Unit Tests', () => {
  test('getMeetings chama endpoint com filtro opcional', async () => {
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
  });

  test('confirmConsensus e deleteMeeting chamam endpoints corretos', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return { status: 'confirmed' };
      },
    } as unknown as ApiClient;
    const api = new MeetingsApi(client);

    await api.confirmConsensus('m1', 'slot-1');
    assert.equal(calls[0].ep, '/api/v1/meetings/m1/confirm');
    assert.equal(calls[0].opt?.body, JSON.stringify({ slot_id: 'slot-1' }));

    await api.deleteMeeting('m1');
    assert.equal(calls[1].ep, '/api/v1/meetings/m1');
    assert.equal(calls[1].opt?.method, 'DELETE');
  });
});
