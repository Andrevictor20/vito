import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { decideNotificationPermissionRequest } from './notificationPermissionPolicy';

describe('Política de permissão de notificações', () => {
  test('não pede quando a permissão já foi concedida', () => {
    const decision = decideNotificationPermissionRequest({
      status: 'granted',
      canAskAgain: true,
      alreadyAsked: false,
      userInitiated: false,
    });
    assert.deepEqual(decision, { action: 'skip', reason: 'granted' });
  });

  test('não pede novamente no login quando já perguntou uma vez', () => {
    const decision = decideNotificationPermissionRequest({
      status: 'denied',
      canAskAgain: true,
      alreadyAsked: true,
      userInitiated: false,
    });
    assert.deepEqual(decision, { action: 'skip', reason: 'already-asked' });
  });

  test('não chama o sistema quando a permissão está bloqueada de vez', () => {
    const decision = decideNotificationPermissionRequest({
      status: 'denied',
      canAskAgain: false,
      alreadyAsked: false,
      userInitiated: false,
    });
    assert.deepEqual(decision, { action: 'skip', reason: 'blocked' });
  });

  test('não chama o sistema quando bloqueada, mesmo com ação explícita do usuário', () => {
    const decision = decideNotificationPermissionRequest({
      status: 'denied',
      canAskAgain: false,
      alreadyAsked: true,
      userInitiated: true,
    });
    assert.deepEqual(decision, { action: 'skip', reason: 'blocked' });
  });

  test('pede na primeira vez (instalação nova)', () => {
    const decision = decideNotificationPermissionRequest({
      status: 'undetermined',
      canAskAgain: true,
      alreadyAsked: false,
      userInitiated: false,
    });
    assert.deepEqual(decision, { action: 'request' });
  });

  test('ação explícita do usuário pede mesmo que já tenha perguntado antes', () => {
    const decision = decideNotificationPermissionRequest({
      status: 'denied',
      canAskAgain: true,
      alreadyAsked: true,
      userInitiated: true,
    });
    assert.deepEqual(decision, { action: 'request' });
  });
});
