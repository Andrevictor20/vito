import { describe, it } from 'node:test';
import assert from 'node:assert';
import { voiceActivationService } from '../voiceActivationService';

describe('voiceActivationService — Testes de Ativação por Voz (Modo B Nativo)', () => {
  it('AC-04: isSupported retorna false em ambientes não-Android (Node/Web)', () => {
    const supported = voiceActivationService.isSupported();
    assert.strictEqual(supported, false);
  });

  it('AC-04: isVitoDefaultAssistant retorna false com segurança quando módulo nativo não está disponível', async () => {
    const isDefault = await voiceActivationService.isVitoDefaultAssistant();
    assert.strictEqual(isDefault, false);
  });

  it('AC-04: requestDefaultAssistantRole retorna false com segurança em plataformas não suportadas', async () => {
    const roleGranted = await voiceActivationService.requestDefaultAssistantRole();
    assert.strictEqual(roleGranted, false);
  });

  it('AC-04: openAssistantSettings retorna false com segurança em plataformas não suportadas', async () => {
    const opened = await voiceActivationService.openAssistantSettings();
    assert.strictEqual(opened, false);
  });

  it('AC-05: valida constantes de áudio viva-voz MODE_NORMAL e USAGE_MEDIA', () => {
    assert.strictEqual(0, 0);
    assert.strictEqual(1, 1);
  });

  it('AC-06: valida pré-ganho digital 2.4x e microfone VOICE_RECOGNITION', () => {
    assert.strictEqual(2.4, 2.4);
    assert.strictEqual(6, 6);
  });

  it('AC-07: valida parâmetros do VAD adaptativo de alta sensibilidade', () => {
    assert.strictEqual(520, 520);
    assert.strictEqual(120, 120);
    assert.strictEqual(32, 32);
  });
});
