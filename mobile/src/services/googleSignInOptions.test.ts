import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_SIGN_IN_OPTIONS } from './googleSignInOptions';

// Regressão: as flags offlineAccess/forceCodeForRefreshToken faziam o Play Services
// reexibir o consentimento a cada login (e-mail do Google + apenas a última conta).
describe('Opções do Google Sign-In', () => {
  test('não força consentimento offline (mantém o seletor de contas e evita e-mail a cada login)', () => {
    const opts = GOOGLE_SIGN_IN_OPTIONS as Record<string, unknown>;
    assert.equal(opts.offlineAccess, undefined, 'offlineAccess não deve ser usado');
    assert.equal(opts.forceCodeForRefreshToken, undefined, 'forceCodeForRefreshToken não deve ser usado');
  });

  test('mantém o webClientId do projeto (Vito assistant no GCP helical)', () => {
    assert.equal(
      GOOGLE_SIGN_IN_OPTIONS.webClientId,
      '125131803371-im5dtmilhasug6spdhc50pr0ssb4l92b.apps.googleusercontent.com'
    );
  });
});
