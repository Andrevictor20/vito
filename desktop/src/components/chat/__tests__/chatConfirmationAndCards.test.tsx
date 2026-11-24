import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as fs from 'fs';
import * as path from 'path';
import { ChatStructuredCards } from '../cards/ChatStructuredCards';
import { ChatApi } from '../../../services/api/chatApi';
import type { ApiClient } from '../../../services/api/client';
import type { ChatMessage } from '../../../types';

describe('AC-04 Desktop: ActionConfirmationCard HITL e Cards Inline', () => {
  it('renderiza ActionConfirmationCard quando requires_confirmation=true e todos os 7 cards inline', () => {
    const msg: ChatMessage & Record<string, any> = {
      id: 'm-1',
      sender: 'vito',
      text: 'Preparei sua tarefa.',
      timestamp: '2026-11-24T10:00:00Z',
      requires_confirmation: true,
      pending_confirmation_id: 'pend-desktop-1',
      cards: [
        {
          id: 'pend-desktop-1',
          type: 'confirm',
          title: 'Criar tarefa',
          subtitle: 'Enviar relatório',
          action_label: 'Confirmar',
          confirm: true,
          dismiss: true,
        },
      ],
      todo: { id: 'td-1', user_id: 'u1', title: 'Enviar relatório', priority: 'medium', category: 'geral', status: 'pending', created_at: '2026-11-24T10:00:00Z', updated_at: '2026-11-24T10:00:00Z' },
      event: { id: 'ev-1', user_id: 'u1', title: 'Daily', start_at: '2026-11-25T10:00:00Z', end_at: '2026-11-25T10:30:00Z' },
      conflict: { has_conflict: true, conflicting_title: 'Outra call', suggested_slots: [] },
      booking: { id: 'bk-1', user_id: 'u1', title: 'Café', slug: 'cafe', duration_minutes: 30, buffer_minutes: 0, start_hour: '09:00', end_hour: '18:00', days_of_week: '[1,2,3,4,5]', is_active: true, public_url: 'https://vito.local/book/andre/cafe', created_at: '2026-11-24T10:00:00Z' },
      meeting: { id: 'mt-1', user_id: 'u1', title: 'Sync', duration_minutes: 30, mode: 'one_on_one', status: 'open', created_at: '2026-11-24T10:00:00Z' },
      pending: { id: 'pd-1', title: 'Revisar PR', source: 'manual', status: 'pending', created_at: '2026-11-24T10:00:00Z' },
      trigger: { id: 'tr-1', user_id: 'u1', title: 'Monitor BTC', category: 'custom', query: 'btc', frequency: 'daily_morning', status: 'active', created_at: '2026-11-24T10:00:00Z', updated_at: '2026-11-24T10:00:00Z' },
    };

    const html = renderToStaticMarkup(React.createElement(ChatStructuredCards, { message: msg }));
    expect(html).toContain('Criar tarefa');
    expect(html).toContain('Confirmar');
    expect(html).toContain('Cancelar');
    expect(html).toContain('Enviar relatório');
    expect(html).toContain('Daily');
    expect(html).toContain('Café');
    expect(html).toContain('Sync');
    expect(html).toContain('Revisar PR');
    expect(html).toContain('Monitor BTC');
  });

  it('desktop/src/services/api/chatApi.ts preserva cards/HITL/entidades e expõe assistantConfirm', async () => {
    const mockClient = {
      request: async () => ({
        reply: 'Preparei a tarefa.',
        requires_confirmation: true,
        pending_confirmation_id: 'pend-d-1',
        cards: [{ id: 'pend-d-1', type: 'confirm', title: 'Criar tarefa', confirm: true, dismiss: true }],
        conflict: { has_conflict: true },
        pending: { id: 'pd-1', title: 'Pendência' },
        meeting: { id: 'mt-1', title: 'Reunião' },
      }),
    } as unknown as ApiClient;

    const api = new ChatApi(mockClient);
    const res = await api.assistantChat('teste');
    expect(res.requires_confirmation).toBe(true);
    expect(res.pending_confirmation_id).toBe('pend-d-1');
    expect(Array.isArray(res.cards)).toBe(true);
    expect(res.conflict?.has_conflict).toBe(true);
    expect(res.pending?.id).toBe('pd-1');
    expect(res.meeting?.id).toBe('mt-1');
    expect(typeof api.assistantConfirm).toBe('function');

    const cardPath = path.resolve(__dirname, '../cards/ActionConfirmationCard.tsx');
    expect(fs.existsSync(cardPath)).toBe(true);
  });
});
