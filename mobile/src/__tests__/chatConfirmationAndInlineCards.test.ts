import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildAssistantMessage } from '../utils/chatMessageBuilder';
import type { AssistantChatResponse } from '../types';

const MOBILE_SRC = path.resolve(__dirname, '..');

describe('AC-04: Cards HITL (ActionConfirmationCard) e Cards Inline no Mobile', () => {
  test('test_ac_04_buildAssistantMessage_preserva_hitl_e_entidades_inline', () => {
    const hitlRes: AssistantChatResponse & Record<string, any> = {
      intent: 'create_todo',
      reply: 'Preparei a tarefa "Pagar boleto". Deseja confirmar?',
      requires_confirmation: true,
      pending_confirmation_id: 'pend-123',
      cards: [
        {
          id: 'pend-123',
          type: 'confirm',
          title: 'Criar tarefa',
          subtitle: 'Pagar boleto',
          action_label: 'Confirmar',
          confirm: true,
          dismiss: true,
        },
      ],
    };

    const hitlMsg: any = buildAssistantMessage('vito', hitlRes, 'OK');
    assert.equal(hitlMsg.requires_confirmation, true);
    assert.equal(hitlMsg.pending_confirmation_id, 'pend-123');
    assert.equal(hitlMsg.confirmationStatus, 'pending');
    assert.ok(Array.isArray(hitlMsg.cards) && hitlMsg.cards.length === 1);
    assert.equal(hitlMsg.cards[0].type, 'confirm');

    const entitiesRes: AssistantChatResponse & Record<string, any> = {
      intent: 'multi_cards',
      reply: 'Itens criados.',
      action_performed: 'create_todo',
      todo: { id: 'todo-1', title: 'Pagar boleto', priority: 'medium', status: 'pending', created_at: '2026-11-24T10:00:00Z' },
      event: { id: 'evt-1', title: 'Alinhamento', start_at: '2026-11-25T10:00:00Z', end_at: '2026-11-25T11:00:00Z' },
      conflict: { has_conflict: true, conflicting_title: 'Call', suggested_slots: [] },
      booking: { id: 'bk-1', title: 'Café', duration_minutes: 30, public_url: 'https://vito.local/book/andre/cafe' },
      booking_url: 'https://vito.local/book/andre/cafe',
      meeting: { id: 'mt-1', title: 'Sync', duration_minutes: 45, mode: 'one_on_one', status: 'pending' },
      meeting_url: 'https://vito.local/m/sync',
      pending: { id: 'pd-1', title: 'Responder contrato', source: 'gmail', status: 'pending' },
      trigger: { id: 'tr-1', title: 'Monitor Dólar', status: 'active' },
    };

    const entityMsg: any = buildAssistantMessage('vito', entitiesRes, 'OK');
    assert.equal(entityMsg.todo?.id, 'todo-1');
    assert.equal(entityMsg.event?.id, 'evt-1');
    assert.equal(entityMsg.conflict?.has_conflict, true);
    assert.equal(entityMsg.booking?.id, 'bk-1');
    assert.equal(entityMsg.meeting?.id, 'mt-1');
    assert.equal(entityMsg.pending?.id, 'pd-1');
    assert.equal(entityMsg.trigger?.id, 'tr-1');
  });

  test('test_ac_04_action_confirmation_card_e_wiring_mobile', () => {
    const cardPath = path.join(MOBILE_SRC, 'components/chat/cards/ActionConfirmationCard.tsx');
    assert.equal(fs.existsSync(cardPath), true, 'ActionConfirmationCard.tsx deve existir');
    const cardSrc = fs.readFileSync(cardPath, 'utf8');
    assert.equal(cardSrc.includes('@expo/vector-icons'), false);
    assert.ok(cardSrc.includes('ProtoUiIcon'));
    assert.ok(cardSrc.includes('Confirmar'));
    assert.ok(cardSrc.includes('Cancelar'));
    assert.ok(cardSrc.split('\n').length < 200, 'ActionConfirmationCard.tsx deve ter < 200 linhas');

    const structuredSrc = fs.readFileSync(path.join(MOBILE_SRC, 'components/chat/cards/ChatStructuredCards.tsx'), 'utf8');
    assert.ok(structuredSrc.includes('ActionConfirmationCard'));
    assert.ok(structuredSrc.includes('TodoInlineCard'));
    assert.ok(structuredSrc.includes('EventInlineCard'));
    assert.ok(structuredSrc.includes('ConflictInlineCard'));
    assert.ok(structuredSrc.includes('BookingInlineCard'));
    assert.ok(structuredSrc.includes('MeetingInlineCard'));
    assert.ok(structuredSrc.includes('PendingInlineCard'));
    assert.ok(structuredSrc.includes('TriggerInlineCard'));

    const useMessagesSrc = fs.readFileSync(path.join(MOBILE_SRC, 'hooks/useChatMessages.ts'), 'utf8');
    assert.ok(useMessagesSrc.includes('resolveConfirmation'));
    assert.ok(useMessagesSrc.includes('assistantConfirm'));

    const chatScreenSrc = fs.readFileSync(path.join(MOBILE_SRC, 'screens/ChatScreen.tsx'), 'utf8');
    assert.ok(chatScreenSrc.includes('resolveConfirmation'));
  });
});
