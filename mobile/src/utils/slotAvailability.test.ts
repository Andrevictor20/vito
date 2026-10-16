import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { checkSlotAvailability, formatSlotConflictMessage } from './slotAvailability';
import { Event } from '../types';

describe('slotAvailability (TDD)', () => {
  const mockEvents: Event[] = [
    {
      id: 'e1',
      user_id: 'u1',
      title: 'Reunião de Alinhamento',
      start_at: '2026-10-17T14:30:00.000Z',
      end_at: '2026-10-17T15:30:00.000Z',
      created_at: '2026-10-16T10:00:00.000Z',
    },
    {
      id: 'e2',
      user_id: 'u1',
      title: 'Dentista',
      start_at: '2026-10-18T09:00:00.000Z',
      end_at: '2026-10-18T10:00:00.000Z',
      created_at: '2026-10-16T10:00:00.000Z',
    },
  ];

  it('detecta conflito quando horário proposto sobrepõe evento existente', () => {
    // 14:45 às 15:30 colide com 14:30 às 15:30
    const result = checkSlotAvailability(
      { date: '2026-10-17', time: '14:45', durationMinutes: 45 },
      mockEvents
    );

    assert.equal(result.available, false);
    assert.equal(result.conflictingEvent?.id, 'e1');
    assert.equal(result.conflictingEvent?.title, 'Reunião de Alinhamento');
  });

  it('permite horário livre sem sobreposição', () => {
    // 16:00 às 16:45 no dia 17/10 está totalmente livre
    const result = checkSlotAvailability(
      { date: '2026-10-17', time: '16:00', durationMinutes: 45 },
      mockEvents
    );

    assert.equal(result.available, true);
    assert.equal(result.conflictingEvent, undefined);
  });

  it('permite horário adjacente sem intersecção', () => {
    // 13:45 às 14:30 termina exatamente quando 14:30 começa
    const result = checkSlotAvailability(
      { date: '2026-10-17', time: '13:45', durationMinutes: 45 },
      mockEvents
    );

    assert.equal(result.available, true);
  });

  it('formata mensagem amigável de conflito para exibição ao usuário', () => {
    const msg = formatSlotConflictMessage(mockEvents[0]);
    assert.ok(msg.includes('Reunião de Alinhamento'));
    assert.ok(msg.includes('Ocupado') || msg.includes('Conflito'));
  });
});
