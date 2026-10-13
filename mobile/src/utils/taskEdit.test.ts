import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getEditInitialState } from './taskEdit';
import type { Todo, PendingItem } from '../types';

const baseTodo: Todo = {
  id: 't1',
  user_id: 'u1',
  title: 'Pagar conta',
  priority: 'high',
  status: 'pending',
  due_date: '2026-10-20T09:00:00.000Z',
  remind_at: '2026-10-19T12:30:00.000Z',
  remind_repeat: 'daily',
  remind_advance_minutes: 30,
  created_at: '2026-10-01T00:00:00.000Z',
};

const basePending: PendingItem = {
  id: 'p1',
  user_id: 'u1',
  title: 'Ler artigo',
  category: 'estudos',
  status: 'inbox',
  scheduled_date: '2026-10-18',
  created_at: '2026-10-01T00:00:00.000Z',
  updated_at: '2026-10-01T00:00:00.000Z',
};

describe('taskEdit', () => {
  it('mapeia tarefa com prazo e lembrete', () => {
    const s = getEditInitialState(baseTodo, 'todo');
    assert.equal(s.kind, 'todo');
    assert.equal(s.title, 'Pagar conta');
    assert.equal(s.dateISO, '2026-10-20');
    assert.equal(s.priority, 'high');
    assert.equal(s.useReminder, true);
    assert.equal(s.repeat, 'daily');
    assert.equal(s.advance, 30);
    assert.match(s.time, /^\d{2}:\d{2}$/);
  });

  it('mapeia pendência sem lembrete (defaults)', () => {
    const s = getEditInitialState(basePending, 'pending');
    assert.equal(s.kind, 'pending');
    assert.equal(s.title, 'Ler artigo');
    assert.equal(s.dateISO, '2026-10-18');
    assert.equal(s.category, 'estudos');
    assert.equal(s.useReminder, false);
    assert.equal(s.time, '09:00');
    assert.equal(s.repeat, 'none');
    assert.equal(s.advance, 0);
  });

  it('tarefa sem datas resulta em nulos previsíveis', () => {
    const s = getEditInitialState({ ...baseTodo, due_date: undefined, remind_at: undefined }, 'todo');
    assert.equal(s.dateISO, null);
    assert.equal(s.useReminder, false);
    assert.equal(s.time, '09:00');
  });
});
