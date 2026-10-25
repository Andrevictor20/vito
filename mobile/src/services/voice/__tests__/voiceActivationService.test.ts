import { describe, it } from 'node:test';
import assert from 'node:assert';
import { voiceActivationService } from '../voiceActivationService';

describe('voiceActivationService — Testes de Ativação por Voz (Modo B Nativo)', () => {
  it('isSupported retorna false em ambientes não-Android (Node/Web)', () => {
    const supported = voiceActivationService.isSupported();
    assert.strictEqual(supported, false);
  });

  it('isVitoDefaultAssistant retorna false com segurança quando módulo nativo não está disponível', async () => {
    const isDefault = await voiceActivationService.isVitoDefaultAssistant();
    assert.strictEqual(isDefault, false);
  });

  it('requestDefaultAssistantRole retorna false com segurança em plataformas não suportadas', async () => {
    const roleGranted = await voiceActivationService.requestDefaultAssistantRole();
    assert.strictEqual(roleGranted, false);
  });

  it('openAssistantSettings retorna false com segurança em plataformas não suportadas', async () => {
    const opened = await voiceActivationService.openAssistantSettings();
    assert.strictEqual(opened, false);
  });
});
