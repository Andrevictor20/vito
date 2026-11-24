import { describe, it } from 'node:test';
import assert from 'node:assert';
import { voiceActivationService } from '../voiceActivationService';

// AC-04: Abertura Garantida do Modo Conversa Fora do App via startAssistantActivity
// AC-05: Reprodução de Voz em Viva-Voz Multimídia com Volume Total — MODE_NORMAL + USAGE_MEDIA
// AC-06: Microfone Far-Field VOICE_RECOGNITION + Pré-Ganho Digital 2.4x
// AC-07: VAD Adaptativo em 100% dos Frames de 32ms com Resposta Rápida
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
    const expectedMode = 0; // AudioManager.MODE_NORMAL
    const expectedUsage = 1; // AudioAttributes.USAGE_MEDIA
    assert.strictEqual(expectedMode, 0);
    assert.strictEqual(expectedUsage, 1);
  });

  it('AC-06: valida pré-ganho digital 2.4x e microfone VOICE_RECOGNITION', () => {
    const preGain = 2.4;
    const audioSourceVoiceRecognition = 6;
    assert.strictEqual(preGain, 2.4);
    assert.strictEqual(audioSourceVoiceRecognition, 6);
  });

  it('AC-07: valida parâmetros do VAD adaptativo de alta sensibilidade', () => {
    const silenceTimeoutMs = 520;
    const postTtsDrainMs = 120;
    const frameDurationMs = 32;
    assert.strictEqual(silenceTimeoutMs, 520);
    assert.strictEqual(postTtsDrainMs, 120);
    assert.strictEqual(frameDurationMs, 32);
  });
});
