import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  VOICE_OPTIONS,
  normalizeVoiceChoice,
  getVoiceDisplayLabel,
  getVoiceEmoji,
} from '../../../services/voice/voiceSelectorHelpers';

describe('voiceSelectorHelpers — Opções e Normalização de Voz Gemini Neural', () => {
  it('contém exatamente 2 opções de voz (masculina Puck e feminina Kore)', () => {
    assert.strictEqual(VOICE_OPTIONS.length, 2);
    const ids = VOICE_OPTIONS.map((v) => v.id);
    assert.deepStrictEqual(ids, ['puck', 'kore']);
  });

  it('opção masculina possui metadados corretos', () => {
    const male = VOICE_OPTIONS.find((v) => v.id === 'puck');
    assert.ok(male);
    assert.strictEqual(male.gender, 'masculino');
    assert.strictEqual(male.label, 'Voz Masculina');
    assert.ok(male.sub.includes('Puck'));
    assert.strictEqual(male.badge, 'Gemini Neural');
  });

  it('opção feminina possui metadados corretos', () => {
    const female = VOICE_OPTIONS.find((v) => v.id === 'kore');
    assert.ok(female);
    assert.strictEqual(female.gender, 'feminino');
    assert.strictEqual(female.label, 'Voz Feminina');
    assert.ok(female.sub.includes('Kore'));
    assert.strictEqual(female.badge, 'Gemini Neural');
  });

  it('normalizeVoiceChoice resolve variações femininas para kore', () => {
    assert.strictEqual(normalizeVoiceChoice('kore'), 'kore');
    assert.strictEqual(normalizeVoiceChoice('Kore'), 'kore');
    assert.strictEqual(normalizeVoiceChoice('female'), 'kore');
    assert.strictEqual(normalizeVoiceChoice('feminino'), 'kore');
    assert.strictEqual(normalizeVoiceChoice('pt-BR-FranciscaNeural'), 'kore');
  });

  it('normalizeVoiceChoice resolve masculino e default para puck', () => {
    assert.strictEqual(normalizeVoiceChoice('puck'), 'puck');
    assert.strictEqual(normalizeVoiceChoice('male'), 'puck');
    assert.strictEqual(normalizeVoiceChoice('masculino'), 'puck');
    assert.strictEqual(normalizeVoiceChoice(null), 'puck');
    assert.strictEqual(normalizeVoiceChoice(''), 'puck');
  });

  it('getVoiceDisplayLabel e getVoiceEmoji retornam representações corretas', () => {
    assert.strictEqual(getVoiceDisplayLabel('kore'), 'Voz Feminina');
    assert.strictEqual(getVoiceDisplayLabel('puck'), 'Voz Masculina');
    assert.strictEqual(getVoiceEmoji('kore'), '👩');
    assert.strictEqual(getVoiceEmoji('puck'), '👨');
  });
});
