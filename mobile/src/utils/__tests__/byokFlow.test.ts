import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  initialStep,
  isShortcutMode,
  isStepUnlocked,
  nextAfter,
  step2Outcome,
  parseItemId,
  isByokStep,
  BYOK_SYNC_CHECKPOINTS,
  isAllowedPluggyWebViewUrl,
  isPluggyDashboardUrl,
  formatWebViewDisplayUrl,
} from '../byokFlow';

describe('byokFlow', () => {
  it('sem chaves: tutorial na primeira vez, Etapa 1 depois', () => {
    assert.equal(initialStep({ hasKeys: false, tutorialSeen: false, step: null }), 'tutorial');
    assert.equal(initialStep({ hasKeys: false, tutorialSeen: true, step: '2' }), '1');
  });

  it('com chaves: retoma a etapa persistida (BYOK-05)', () => {
    assert.equal(initialStep({ hasKeys: true, tutorialSeen: true, step: '2' }), '2');
    assert.equal(initialStep({ hasKeys: true, tutorialSeen: true, step: '3' }), '3');
    assert.equal(initialStep({ hasKeys: true, tutorialSeen: true, step: '1' }), '2');
    assert.equal(initialStep({ hasKeys: true, tutorialSeen: true, step: null }), '2');
  });

  it('atalho pós-configuração só com chaves e done (BYOK-06)', () => {
    assert.equal(isShortcutMode({ hasKeys: true, tutorialSeen: true, step: 'done' }), true);
    assert.equal(isShortcutMode({ hasKeys: false, tutorialSeen: true, step: 'done' }), false);
    assert.equal(isShortcutMode({ hasKeys: true, tutorialSeen: true, step: '2' }), false);
  });

  it('etapas 2 e 3 bloqueadas sem chaves válidas (BYOK-01)', () => {
    assert.equal(isStepUnlocked('1', 'tutorial', false), true);
    assert.equal(isStepUnlocked('2', '1', false), false);
    assert.equal(isStepUnlocked('3', '2', false), false);
    assert.equal(isStepUnlocked('2', '2', true), true);
    assert.equal(isStepUnlocked('3', '2', true), false);
    assert.equal(isStepUnlocked('3', '3', true), true);
  });

  it('nextAfter avança e satura em done', () => {
    assert.equal(nextAfter('tutorial'), '1');
    assert.equal(nextAfter('2'), '3');
    assert.equal(nextAfter('done'), 'done');
  });

  it('step2Outcome só avança com ≥1 item (Q-3)', () => {
    assert.equal(step2Outcome(0).advance, false);
    assert.ok(step2Outcome(0).message.length > 0);
    assert.equal(step2Outcome(2).advance, true);
  });

  it('parseItemId extrai e decodifica', () => {
    assert.equal(parseItemId('vito://pluggy-success?itemId=abc-123'), 'abc-123');
    assert.equal(parseItemId('vito://pluggy-success?x=1&item_id=z%20y'), 'z y');
    assert.equal(parseItemId('vito://pluggy-success'), '');
    assert.equal(parseItemId(undefined), '');
  });

  it('isByokStep valida valores persistidos', () => {
    assert.equal(isByokStep('2'), true);
    assert.equal(isByokStep('x'), false);
    assert.equal(isByokStep(null), false);
  });

  it('BYOK_SYNC_CHECKPOINTS possui exatamente 6 etapas', () => {
    assert.equal(BYOK_SYNC_CHECKPOINTS.length, 6);
    assert.equal(BYOK_SYNC_CHECKPOINTS[0].title, 'Autenticando na Pluggy');
    assert.equal(BYOK_SYNC_CHECKPOINTS[5].title, 'Enviando ao servidor · Edge-Sync');
  });

  it('isAllowedPluggyWebViewUrl permite apenas HTTPS Pluggy e OAuth oficial', () => {
    assert.equal(isAllowedPluggyWebViewUrl('https://dashboard.pluggy.ai/applications'), true);
    assert.equal(isAllowedPluggyWebViewUrl('https://app.pluggy.ai/login'), true);
    assert.equal(isAllowedPluggyWebViewUrl('https://auth.pluggy.ai/oauth'), true);
    assert.equal(isAllowedPluggyWebViewUrl('https://accounts.google.com/o/oauth2/v2/auth'), true);
    assert.equal(isAllowedPluggyWebViewUrl('https://github.com/login/oauth/authorize'), true);

    assert.equal(isAllowedPluggyWebViewUrl('http://dashboard.pluggy.ai/applications'), false);
    assert.equal(isAllowedPluggyWebViewUrl('file:///etc/passwd'), false);
    assert.equal(isAllowedPluggyWebViewUrl('javascript:alert(1)'), false);
    assert.equal(isAllowedPluggyWebViewUrl('data:text/html,<script>alert(1)</script>'), false);
    assert.equal(isAllowedPluggyWebViewUrl('https://evil.com/phishing'), false);
    assert.equal(isAllowedPluggyWebViewUrl('https://dashboard.pluggy.ai.evil.com'), false);
    assert.equal(isAllowedPluggyWebViewUrl('https://user@dashboard.pluggy.ai'), false);
    assert.equal(isAllowedPluggyWebViewUrl('about:blank', true), false);
    assert.equal(isAllowedPluggyWebViewUrl('about:blank', false), true);
  });

  it('formatWebViewDisplayUrl formata domínio e caminho', () => {
    assert.equal(formatWebViewDisplayUrl('https://dashboard.pluggy.ai/applications?tab=1'), 'dashboard.pluggy.ai/applications');
    assert.equal(formatWebViewDisplayUrl('https://dashboard.pluggy.ai/'), 'dashboard.pluggy.ai');
    assert.equal(formatWebViewDisplayUrl('invalido'), 'dashboard.pluggy.ai');
  });

  it('isPluggyDashboardUrl exige HTTPS e host pluggy.ai para postMessage', () => {
    assert.equal(isPluggyDashboardUrl('https://dashboard.pluggy.ai/applications'), true);
    assert.equal(isPluggyDashboardUrl('https://pluggy.ai'), true);
    assert.equal(isPluggyDashboardUrl('http://dashboard.pluggy.ai'), false);
    assert.equal(isPluggyDashboardUrl('https://accounts.google.com'), false);
    assert.equal(isPluggyDashboardUrl('https://dashboard.pluggy.ai.evil.com'), false);
  });
});
