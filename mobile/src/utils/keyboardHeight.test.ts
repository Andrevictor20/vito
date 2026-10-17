import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveKeyboardHeight,
  KEYBOARD_HEIGHT_DEADZONE,
  computeSheetBottomMetrics,
  computeSubViewBottomPadding,
} from './keyboardHeight';
import {
  buildMeetingShareMessage,
  getMeetingShareButtonLabel,
} from './meetingPollUtils';

describe('keyboardHeight', () => {
  it('adota altura quando teclado estaba fechado', () => {
    assert.equal(resolveKeyboardHeight(0, false, 280), 280);
  });

  it('ignora re-disparo com variação pequena (faixa de sugestões)', () => {
    assert.equal(resolveKeyboardHeight(280, true, 300), null);
    assert.equal(resolveKeyboardHeight(280, true, 260), null);
  });

  it('adota variação grande (troca p/ emoji/painel alto)', () => {
    assert.equal(resolveKeyboardHeight(280, true, 280 + KEYBOARD_HEIGHT_DEADZONE + 10), 280 + KEYBOARD_HEIGHT_DEADZONE + 10);
  });

  it('zera ao fechar', () => {
    assert.equal(resolveKeyboardHeight(280, true, 0), 0);
  });

  it('computeSheetBottomMetrics eleva modal acima do teclado no Android e reduz padding redundante', () => {
    const closed = computeSheetBottomMetrics(0, 16, 'android');
    assert.deepEqual(closed, { marginBottom: 0, paddingBottom: 116 });

    const openAndroid = computeSheetBottomMetrics(290, 16, 'android');
    assert.deepEqual(openAndroid, { marginBottom: 290, paddingBottom: 16 });

    const openIOS = computeSheetBottomMetrics(310, 34, 'ios');
    assert.deepEqual(openIOS, { marginBottom: 0, paddingBottom: 16 });
  });

  it('computeSubViewBottomPadding garante folga mínima de 120px + safe-area para não ser coberto pela footbar', () => {
    assert.equal(computeSubViewBottomPadding(0), 120);
    assert.equal(computeSubViewBottomPadding(24), 144);
  });

  it('getMeetingShareButtonLabel e buildMeetingShareMessage usam rótulo neutro Compartilhar sem vínculo com app específico', () => {
    assert.equal(getMeetingShareButtonLabel(false), 'Compartilhar Enquete');
    assert.equal(getMeetingShareButtonLabel(true), 'Compartilhar Confirmação');

    const openMsg = buildMeetingShareMessage(
      {
        id: 'm1',
        title: 'Alinhamento Semanal',
        status: 'open',
        slots: [],
        participants: [],
      } as any,
      'https://vito.s.gy/m-123'
    );
    assert.equal(openMsg.includes('Alinhamento Semanal'), true);
    assert.equal(openMsg.includes('https://vito.s.gy/m-123'), true);
    assert.equal(openMsg.toLowerCase().includes('whatsapp'), false);
  });
});

