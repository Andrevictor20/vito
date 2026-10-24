import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatGroupTimestamp,
  formatDrawerRowTime,
  formatShortDate,
  groupSessionsByDate,
  filterSessionsByQuery,
  resolveSwipeAction,
  findEmptyOrErrorSessions,
} from './chatHistoryGrouping';
import type { ConversationSession } from '../types';

const NOW = new Date(2026, 9, 14, 18, 10, 0); // 14 out 2026, 18:10

function sess(id: string, timestamp: string, extra?: Partial<ConversationSession>): ConversationSession {
  return { id, title: id, preview: 'oi', timestamp, messages: [], ...extra };
}

describe('chatHistoryGrouping', () => {
  it('hoje → "Hoje, 18:10" e formatDrawerRowTime → "18:10"', () => {
    const ts = new Date(2026, 9, 14, 18, 10, 0).toISOString();
    assert.equal(formatGroupTimestamp(ts, NOW), 'Hoje, 18:10');
    assert.equal(formatDrawerRowTime(ts, NOW), '18:10');
  });

  it('ontem → "Ontem" e formatDrawerRowTime → "ontem"', () => {
    const ts = new Date(2026, 9, 13, 22, 5, 0).toISOString();
    assert.equal(formatGroupTimestamp(ts, NOW), 'Ontem');
    assert.equal(formatDrawerRowTime(ts, NOW), 'ontem');
  });

  it('semana passada → "11 out" (sem ponto, sem "de")', () => {
    const ts = new Date(2026, 9, 11, 9, 0, 0).toISOString();
    const label = formatGroupTimestamp(ts, NOW);
    assert.equal(label, '11 out');
    assert.equal(formatDrawerRowTime(ts, NOW), '11 out');
    assert.ok(!label.includes('.'), 'sem ponto');
    assert.ok(!label.includes(' de '), 'sem "de"');
  });

  it('formatShortDate remove ponto e "de"', () => {
    assert.equal(formatShortDate(new Date(2026, 9, 10, 12, 0, 0)), '10 out');
  });

  it('agrupa HOJE / ONTEM / data e ordena grupos por recência + itens desc', () => {
    const groups = groupSessionsByDate(
      [
        sess('old-a', new Date(2026, 9, 10, 8, 0, 0).toISOString()),
        sess('today-old', new Date(2026, 9, 14, 9, 0, 0).toISOString()),
        sess('yesterday', new Date(2026, 9, 13, 20, 0, 0).toISOString()),
        sess('today-new', new Date(2026, 9, 14, 17, 0, 0).toISOString()),
        sess('old-b', new Date(2026, 9, 10, 15, 30, 0).toISOString()),
      ],
      NOW,
    );
    assert.deepEqual(
      groups.map((g) => g.title),
      ['Hoje', 'Ontem', '10 out'],
    );
    assert.deepEqual(
      groups[0].sessions.map((s) => s.id),
      ['today-new', 'today-old'],
    );
    assert.deepEqual(
      groups[2].sessions.map((s) => s.id),
      ['old-b', 'old-a'],
    );
  });

  it('timestamp inválido não quebra (vai por último)', () => {
    const groups = groupSessionsByDate(
      [sess('bad', 'nao-e-data'), sess('ok', new Date(2026, 9, 14, 10, 0, 0).toISOString())],
      NOW,
    );
    assert.equal(groups[0].title, 'Hoje');
    assert.equal(groups[groups.length - 1].sessions[0].id, 'bad');
    assert.equal(formatGroupTimestamp('nao-e-data', NOW), 'Recente');
  });

  it('filterSessionsByQuery filtra por título, preview ou mensagens ignorando caixa e acentos', () => {
    const list: ConversationSession[] = [
      sess('1', NOW.toISOString(), { title: 'Mensagem para a Isa', preview: 'Chego às 19h' }),
      sess('2', NOW.toISOString(), { title: 'Reunião de orçamento', preview: 'Confirmado quinta' }),
      sess('3', NOW.toISOString(), {
        title: 'Voo Rio',
        preview: 'Radar ativo',
        messages: [{ id: 'm1', sender: 'user', text: 'Passagem promocional', timestamp: NOW.toISOString() }],
      }),
    ];

    assert.equal(filterSessionsByQuery(list, '').length, 3);
    assert.deepEqual(filterSessionsByQuery(list, 'reuniao').map((s) => s.id), ['2']);
    assert.deepEqual(filterSessionsByQuery(list, 'ISA').map((s) => s.id), ['1']);
    assert.deepEqual(filterSessionsByQuery(list, 'promocional').map((s) => s.id), ['3']);
    assert.equal(filterSessionsByQuery(list, 'inexistente').length, 0);
  });

  it('resolveSwipeAction classifica arrasto para fixar (direita) e excluir (esquerda)', () => {
    assert.equal(resolveSwipeAction(80), 'pin');
    assert.equal(resolveSwipeAction(64), 'pin');
    assert.equal(resolveSwipeAction(30), 'none');
    assert.equal(resolveSwipeAction(0), 'none');
    assert.equal(resolveSwipeAction(-30), 'none');
    assert.equal(resolveSwipeAction(-64), 'delete');
    assert.equal(resolveSwipeAction(-95), 'delete');
  });

  it('findEmptyOrErrorSessions identifica conversas vazias inativas ou com falha', () => {
    const list: ConversationSession[] = [
      sess('active-empty', NOW.toISOString(), { active: true, messages: [] }),
      sess('inactive-empty', NOW.toISOString(), { active: false, messages: [] }),
      sess('error-conv', NOW.toISOString(), {
        active: false,
        title: 'Falha ao criar tarefa',
        preview: 'Falha de conexão, toque para tentar de novo',
        messages: [{ id: 'm1', sender: 'user', text: 'Oi', timestamp: NOW.toISOString() }],
      }),
      sess('valid-conv', NOW.toISOString(), {
        active: false,
        title: 'Agendar almoço',
        preview: 'Marcado para 12h',
        messages: [{ id: 'm2', sender: 'user', text: 'Almoço', timestamp: NOW.toISOString() }],
      }),
    ];

    const found = findEmptyOrErrorSessions(list);
    assert.deepEqual(found.map((s) => s.id), ['inactive-empty', 'error-conv']);
  });
});
