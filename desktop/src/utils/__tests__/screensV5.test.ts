import { describe, expect, it } from 'vitest';
import { DEFAULT_TASK_LISTS, qaParse } from '../taskQuickAddParser';
import {
  DEVICE_PERMISSION_ROWS,
  FAQ_ITEMS,
  formatBrl,
  LEGAL_DOCS,
  NOTIFICATION_CATEGORY_ROWS,
  STORE_PLANS,
} from '../../components/store/StoreCatalogData';

describe('Onda V5 qaParse (desktop)', () => {
  const ref = new Date(2026, 3, 20, 10, 0, 0); // Monday 20/04/2026

  it('extracts today, priority p1 and #list tokens', () => {
    const parsed = qaParse('Enviar contrato hoje p1 #trabalho', DEFAULT_TASK_LISTS, ref);
    expect(parsed.dueDate).toBe('2026-04-20');
    expect(parsed.priority).toBe('high');
    expect(parsed.listId).toBe('trabalho');
    expect(parsed.title).toBe('Enviar contrato');
  });

  it('extracts weekday, dd/mm, and urgente', () => {
    const friday = qaParse('alinhamento sexta p2 #pessoal', DEFAULT_TASK_LISTS, ref);
    expect(friday.dueDate).toBe('2026-04-24');
    expect(friday.priority).toBe('medium');
    expect(friday.listId).toBe('pessoal');
    expect(friday.title).toBe('Alinhamento');

    const explicitDate = qaParse('pagar boleto 05/11 urgente #casa', DEFAULT_TASK_LISTS, ref);
    expect(explicitDate.dueDate).toBe('2026-11-05');
    expect(explicitDate.priority).toBe('high');
    expect(explicitDate.listId).toBe('casa');
  });
});

describe('Onda V6 Store & LGPD catalog (desktop)', () => {
  it('provides Pro/Ultra pricing, 6 notification toggles, 5 permissions and legal docs', () => {
    const pro = STORE_PLANS.find((p) => p.id === 'pro');
    const ultra = STORE_PLANS.find((p) => p.id === 'ultra');
    expect(pro?.monthlyPrice).toBe(29.9);
    expect(ultra?.yearlyPrice).toBe(599.9);
    expect(formatBrl(20.9)).toBe('R$ 20,90');
    expect(NOTIFICATION_CATEGORY_ROWS).toHaveLength(6);
    expect(DEVICE_PERMISSION_ROWS).toHaveLength(5);
    expect(FAQ_ITEMS.length).toBeGreaterThanOrEqual(4);
    expect(LEGAL_DOCS.terms.sections.length).toBeGreaterThan(0);
    expect(LEGAL_DOCS.priv.sections.length).toBeGreaterThan(0);
    expect(LEGAL_DOCS.oss.sections.length).toBeGreaterThan(0);
  });
});
