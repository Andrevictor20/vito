import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ApiClient } from '../../../services/api/client';
import { PhoneVerificationApi, findSelfPhoneInContacts } from './phoneVerificationService';

describe('phoneVerificationService', () => {
  it('requestPhoneVerification e verifyPhoneCode chamam endpoints corretos', async () => {
    const calls: { ep: string; opt?: any }[] = [];
    const client = {
      request: async (ep: string, opt?: any) => {
        calls.push({ ep, opt });
        return { verified: true, phone: '+5511999999999', status: 'ok' };
      },
    } as unknown as ApiClient;
    const api = new PhoneVerificationApi(client);

    await api.requestPhoneVerification('+5511999999999');
    assert.equal(calls[0].ep, '/api/v1/users/phone/request-verification');
    assert.equal(calls[0].opt?.method, 'POST');
    assert.equal(calls[0].opt?.body, JSON.stringify({ phone: '+5511999999999' }));

    const res = await api.verifyPhoneCode({ code: '123456' });
    assert.equal(calls[1].ep, '/api/v1/users/phone/verify');
    assert.equal(calls[1].opt?.method, 'POST');
    assert.equal(res.verified, true);
  });

  it('findSelfPhoneInContacts resolve por e-mail ou cartão próprio', () => {
    const detected = findSelfPhoneInContacts(
      [
        { id: '1', name: 'Outro', phoneNumbers: ['11 91111-1111'], emails: ['x@vito.ai'] },
        { id: '2', name: 'Eu', phoneNumbers: ['(21) 98765-4321'], emails: [] },
      ],
      'admin@vito.ai',
      'André'
    );
    assert.equal(detected, '+5521987654321');
  });
});
