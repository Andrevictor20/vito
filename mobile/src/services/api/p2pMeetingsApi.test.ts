import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { P2PMeetingsApi } from './p2pMeetingsApi';
import { ApiClient } from './client';

describe('P2PMeetingsApi Unit Tests', () => {
  test('getChallenge e matchContacts chamam endpoints corretos com payload adequado', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        if (ep === '/api/v1/contacts/challenge') {
          return { salt: 'dummy-salt' };
        }
        return { matches: [{ user_id: 'u-1', name: 'Alice' }] };
      },
    } as unknown as ApiClient;

    const api = new P2PMeetingsApi(client);
    const chal = await api.getChallenge();
    assert.equal(chal.salt, 'dummy-salt');
    assert.equal(calls[0].ep, '/api/v1/contacts/challenge');

    const matches = await api.matchContacts('dummy-salt', ['hash1', 'hash2']);
    assert.equal(calls[1].ep, '/api/v1/contacts/match');
    assert.equal(calls[1].opt?.method, 'POST');
    assert.equal(calls[1].opt?.body, JSON.stringify({ salt: 'dummy-salt', hashes: ['hash1', 'hash2'] }));
    assert.equal(matches.length, 1);
    assert.equal(matches[0].name, 'Alice');
  });

  test('updatePhone e getMutualSlots constroem query parameters corretos', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        if (ep.includes('/mutual-slots')) {
          return { mutual_slots: [{ start_at: '2026-10-16T10:00:00Z', end_at: '2026-10-16T10:30:00Z' }] };
        }
        return { status: 'updated' };
      },
    } as unknown as ApiClient;

    const api = new P2PMeetingsApi(client);
    await api.updatePhone('+5511999998888');
    assert.equal(calls[0].ep, '/api/v1/users/phone');
    assert.equal(calls[0].opt?.body, JSON.stringify({ phone: '+5511999998888' }));

    const slots = await api.getMutualSlots('target-user-123', '2026-10-16T09:00:00Z', '2026-10-16T18:00:00Z', 45);
    assert.ok(calls[1].ep.startsWith('/api/v1/meetings/p2p/mutual-slots?'));
    assert.ok(calls[1].ep.includes('target_user_id=target-user-123'));
    assert.ok(calls[1].ep.includes('duration=45'));
    assert.equal(slots.length, 1);
  });

  test('ciclo de vida de convite: sendInvite, acceptInvite, declineInvite, cancelInvite', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        if (ep.endsWith('/accept')) {
          return { id: 'inv-1', status: 'accepted' };
        }
        return { id: 'inv-1', status: 'pending' };
      },
    } as unknown as ApiClient;

    const api = new P2PMeetingsApi(client);
    const invite = await api.sendInvite({
      to_user_id: 'u2',
      title: 'Sync',
      start_at: '2026-10-17T10:00:00Z',
      end_at: '2026-10-17T10:45:00Z',
    });
    assert.equal(invite.id, 'inv-1');
    assert.equal(calls[0].ep, '/api/v1/meetings/p2p/invite');
    assert.equal(calls[0].opt?.method, 'POST');

    const accepted = await api.acceptInvite('inv-1');
    assert.equal(accepted.status, 'accepted');
    assert.equal(calls[1].ep, '/api/v1/meetings/p2p/invites/inv-1/accept');

    await api.declineInvite('inv-1');
    assert.equal(calls[2].ep, '/api/v1/meetings/p2p/invites/inv-1/decline');

    await api.cancelInvite('inv-1');
    assert.equal(calls[3].ep, '/api/v1/meetings/p2p/invites/inv-1/cancel');
  });
});
