import { describe, it } from 'node:test';
import assert from 'node:assert';
import { voiceActivationService } from '../voiceActivationService';

describe('voiceActivationService — Testes de Ativação por Voz', () => {
  it('retorna UNSUPPORTED_PLATFORM em ambientes não-Android (Node/Web)', async () => {
    const res = await voiceActivationService.setMode('COEXIST_WAKE_WORD');
    assert.strictEqual(res, 'UNSUPPORTED_PLATFORM');
  });

  it('isVitoDefaultAssistant retorna false com segurança quando módulo nativo não está disponível', async () => {
    const isDefault = await voiceActivationService.isVitoDefaultAssistant();
    assert.strictEqual(isDefault, false);
  });

  it('requestDefaultAssistantRole retorna false com segurança em plataformas não suportadas', async () => {
    const roleGranted = await voiceActivationService.requestDefaultAssistantRole();
    assert.strictEqual(roleGranted, false);
  });
});
