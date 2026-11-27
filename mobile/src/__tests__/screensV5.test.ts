import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { qaParse, DEFAULT_TASK_LISTS, formatIsoDate } from '../features/tasks/utils/taskQuickAddParser';
import {
  countUnreadNotifications,
  filterNotifications,
  groupNotifications,
} from '../features/notifications/utils/notificationHelpers';
import { formatBRL } from '../utils/formatting/currency';
import {
  DEVICE_PERMISSION_ROWS,
  FAQ_ITEMS,
  LEGAL_DOCS,
  NOTIFICATION_CATEGORY_ROWS,
  STORE_PLANS,
} from '../features/store/data/storeCatalogData';
import type { InboxNotification } from '../features/notifications/services/notificationsApi';

describe('Onda V5 qaParse (mobile)', () => {
  const ref = new Date(2026, 3, 20, 10, 0, 0); // Segunda-feira, 20/04/2026

  it('interpreta hoje, amanhã, p1/urgente e #lista', () => {
    const parsed = qaParse('Enviar proposta hoje p1 #trabalho', DEFAULT_TASK_LISTS, ref);
    assert.equal(parsed.dueDate, '2026-04-20');
    assert.equal(parsed.priority, 'high');
    assert.equal(parsed.listId, 'trabalho');
    assert.equal(parsed.title, 'Enviar proposta');

    const urgent = qaParse('pagar guia urgente amanha #casa', DEFAULT_TASK_LISTS, ref);
    assert.equal(urgent.dueDate, '2026-04-21');
    assert.equal(urgent.priority, 'high');
    assert.equal(urgent.listId, 'casa');
    assert.equal(urgent.title, 'Pagar guia');
  });

  it('interpreta dia da semana, dd/mm e p2', () => {
    const weekday = qaParse('Revisar deck sexta p2', DEFAULT_TASK_LISTS, ref);
    assert.equal(weekday.dueDate, '2026-04-24');
    assert.equal(weekday.priority, 'medium');
    assert.equal(weekday.title, 'Revisar deck');

    const dateSlash = qaParse('Dentista 25/12 #pessoal', DEFAULT_TASK_LISTS, ref);
    assert.equal(dateSlash.dueDate, '2026-12-25');
    assert.equal(dateSlash.listId, 'pessoal');
    assert.equal(dateSlash.title, 'Dentista');
  });

  it('interpreta depois de amanhã e formata ISO date', () => {
    const parsed = qaParse('Comprar presente depois de amanhã', DEFAULT_TASK_LISTS, ref);
    assert.equal(parsed.dueDate, formatIsoDate(new Date(2026, 3, 22)));
    assert.equal(parsed.title, 'Comprar presente');
  });
});

describe('Onda V4 Notifications helpers (mobile)', () => {
  const sample: InboxNotification[] = [
    {
      id: '1',
      group_key: 'Agora',
      type: 'aprovar',
      source_domain: 'bots',
      title: 'Bot Concierge',
      body: 'Enviar confirmação?',
      time_label: 'agora',
      is_unread: true,
      actions: [{ label: 'Aprovar', action: 'approve', primary: true }],
    },
    {
      id: '2',
      group_key: 'Hoje',
      type: 'alerta',
      source_domain: 'tasks',
      title: '2 tarefas atrasadas',
      body: 'Reagendar?',
      time_label: 'hoje',
      is_unread: true,
      actions: [{ label: 'Reagendar hoje', action: 'reschedule_today', primary: true }],
    },
    {
      id: '3',
      group_key: 'Ontem',
      type: 'info',
      source_domain: 'booking',
      title: 'Reunião confirmada',
      body: '4 votos',
      time_label: 'ontem',
      is_unread: false,
      actions: [],
    },
  ];

  it('filtra e agrupa notificações por Agora / Hoje / Ontem', () => {
    assert.equal(countUnreadNotifications(sample), 2);
    assert.equal(filterNotifications(sample, 'all').length, 3);
    assert.equal(filterNotifications(sample, 'aprovar').length, 1);
    assert.equal(filterNotifications(sample, 'alerta').length, 1);

    const grouped = groupNotifications(sample);
    assert.deepEqual(
      grouped.map((g) => g.group),
      ['Agora', 'Hoje', 'Ontem']
    );
  });
});

describe('Onda V6 Store & LGPD catalog (mobile)', () => {
  it('mantém planos, 6 categorias de notificação, 5 permissões e docs legais', () => {
    const pro = STORE_PLANS.find((p) => p.id === 'pro');
    const ultra = STORE_PLANS.find((p) => p.id === 'ultra');
    assert.ok(pro && ultra);
    assert.equal(pro.monthlyPrice, 29.9);
    assert.equal(pro.yearlyPrice, 249.9);
    assert.equal(formatBRL(29.9), 'R$ 29,90');
    assert.equal(NOTIFICATION_CATEGORY_ROWS.length, 6);
    assert.equal(DEVICE_PERMISSION_ROWS.length, 5);
    assert.ok(FAQ_ITEMS.length >= 4);
    assert.ok(LEGAL_DOCS.terms.sections.length > 0);
    assert.ok(LEGAL_DOCS.priv.sections.length > 0);
    assert.ok(LEGAL_DOCS.oss.sections.length > 0);
  });
});
