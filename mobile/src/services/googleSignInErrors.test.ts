import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  GoogleSignInCancelledError,
  isCancelledSignInResult,
  isConfigurationError,
  isPlayServicesUnavailable,
  isUserCancellation,
  normalizeGoogleSignInErrorCode,
} from './googleSignInErrors';

describe('Google Sign-In native error handling', () => {
  test('isCancelledSignInResult reconhece o retorno { type: "cancelled" } sem exceção', () => {
    assert.equal(isCancelledSignInResult({ type: 'cancelled' }), true);
    assert.equal(isCancelledSignInResult({ type: 'success', data: { idToken: 'token' } }), false);
    assert.equal(isCancelledSignInResult(null), false);
    assert.equal(isCancelledSignInResult(undefined), false);
    assert.equal(isCancelledSignInResult('cancelled'), false);
  });

  test('GoogleSignInCancelledError é classificado como cancelamento e nunca como configuração', () => {
    const err = new GoogleSignInCancelledError();
    assert.equal(err.code, 'SIGN_IN_CANCELLED');
    assert.equal(err.message, 'Login com Google cancelado.');
    assert.equal(isUserCancellation(err), true);
    assert.equal(isConfigurationError(err), false);
    assert.equal(isPlayServicesUnavailable(err), false);
  });

  test('isUserCancellation reconhece código nativo 4, string e mensagem em português', () => {
    assert.equal(isUserCancellation({ code: 4 }), true);
    assert.equal(isUserCancellation({ code: 'SIGN_IN_CANCELLED' }), true);
    assert.equal(isUserCancellation({ message: 'Login com Google cancelado.' }), true);
    assert.equal(isUserCancellation(new Error('Usuário cancelou a operação')), true);
    assert.equal(isUserCancellation(new Error('Falha no login com Google')), false);
  });

  test('normalizeGoogleSignInErrorCode mapeia códigos numéricos e strings numéricas', () => {
    assert.equal(normalizeGoogleSignInErrorCode({ code: 10 }), 'DEVELOPER_ERROR');
    assert.equal(normalizeGoogleSignInErrorCode({ code: '10' }), 'DEVELOPER_ERROR');
    assert.equal(normalizeGoogleSignInErrorCode({ code: 'DEVELOPER_ERROR' }), 'DEVELOPER_ERROR');
    assert.equal(
      normalizeGoogleSignInErrorCode({ message: 'erro 13: PLAY_SERVICES_NOT_AVAILABLE' }),
      'PLAY_SERVICES_NOT_AVAILABLE'
    );
    assert.equal(normalizeGoogleSignInErrorCode(null), null);
    assert.equal(normalizeGoogleSignInErrorCode(undefined), null);
  });

  test('classificação separa erro de configuração de indisponibilidade do Play Services', () => {
    assert.equal(isConfigurationError({ code: 'DEVELOPER_ERROR' }), true);
    assert.equal(isConfigurationError({ code: 10 }), true);
    assert.equal(isConfigurationError({ code: 4 }), false);
    assert.equal(isPlayServicesUnavailable({ code: 13 }), true);
    assert.equal(isPlayServicesUnavailable({ code: 14 }), true);
    assert.equal(isPlayServicesUnavailable({ code: 10 }), false);
  });

  test('mapeia os códigos internos 12500-12503 do Google Play Services', () => {
    assert.equal(normalizeGoogleSignInErrorCode({ code: 12500 }), 'SIGN_IN_FAILED');
    assert.equal(normalizeGoogleSignInErrorCode({ code: '12500' }), 'SIGN_IN_FAILED');
    assert.equal(normalizeGoogleSignInErrorCode({ code: 12501 }), 'SIGN_IN_CANCELLED');
    assert.equal(normalizeGoogleSignInErrorCode({ code: 12502 }), 'IN_PROGRESS');
    assert.equal(normalizeGoogleSignInErrorCode({ code: 12503 }), 'PLAY_SERVICES_NOT_AVAILABLE');
  });

  test('classifica o erro real de SHA-1 "Invalid key value" como DEVELOPER_ERROR', () => {
    const sha1Mismatch = {
      code: '12500',
      message:
        'A non-recoverable sign in failure occurred: Invalid key value: bWxl5m0ykkxrzZ9PbIJOsQtjgkM=:com.andrevmp.vito',
    };
    assert.equal(normalizeGoogleSignInErrorCode(sha1Mismatch), 'DEVELOPER_ERROR');
    assert.equal(isConfigurationError(sha1Mismatch), true);
    assert.equal(isUserCancellation(sha1Mismatch), false);
    assert.equal(isPlayServicesUnavailable(sha1Mismatch), false);
  });

  test('12500 puro é falha de configuração; 12501/12502 são cancelamento; 12503 é Play Services', () => {
    assert.equal(isConfigurationError({ code: 12500 }), true);
    assert.equal(isUserCancellation({ code: 12501 }), true);
    assert.equal(isConfigurationError({ code: 12501 }), false);
    assert.equal(isUserCancellation({ code: 12502 }), true);
    assert.equal(isPlayServicesUnavailable({ code: 12503 }), true);
    assert.equal(isConfigurationError({ code: 12503 }), false);
  });
});
