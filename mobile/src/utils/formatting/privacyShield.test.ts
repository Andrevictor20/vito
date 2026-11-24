import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { shouldShowPrivacyShield, isVerifiedUniversalLinkPrefix } from './privacyShield';

describe('Sprint 14 OS Privacy Shield & Universal Links (TDD)', () => {
  it('ativa escudo visual quando AppState vai para background ou inactive', () => {
    assert.equal(shouldShowPrivacyShield('active', 'android'), false);
    assert.equal(shouldShowPrivacyShield('background', 'android'), true);
    assert.equal(shouldShowPrivacyShield('inactive', 'ios'), true);
    assert.equal(shouldShowPrivacyShield('background', 'web'), false);
  });

  it('reconhece prefixos de App Links e Universal Links verificados (https://vito.rasppi.cloud)', () => {
    assert.equal(isVerifiedUniversalLinkPrefix('https://vito.rasppi.cloud'), true);
    assert.equal(isVerifiedUniversalLinkPrefix('https://vito.rasppi.cloud/meet/123'), true);
    assert.equal(isVerifiedUniversalLinkPrefix('http://untrusted.example.com'), false);
  });
});
