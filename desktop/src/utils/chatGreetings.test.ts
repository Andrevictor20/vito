import { describe, it, expect } from 'vitest';
import { getDayPeriod, pickWelcomeGreeting } from './chatGreetings';

describe('chatGreetings utility', () => {
  it('classifica períodos do dia corretamente', () => {
    expect(getDayPeriod(6)).toBe('morning');
    expect(getDayPeriod(11)).toBe('morning');
    expect(getDayPeriod(12)).toBe('afternoon');
    expect(getDayPeriod(17)).toBe('afternoon');
    expect(getDayPeriod(18)).toBe('evening');
    expect(getDayPeriod(23)).toBe('evening');
    expect(getDayPeriod(0)).toBe('dawn');
    expect(getDayPeriod(4)).toBe('dawn');
  });

  it('injeta o primeiro nome do usuário na saudação e não contém emojis', () => {
    const greeting = pickWelcomeGreeting('André Silva', 20, () => 0);
    expect(greeting).toContain('André');
    expect(greeting).not.toContain('Silva');
    expect(greeting).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it('faz fallback para saudação sem nome quando usuário não tem nome definido', () => {
    const greeting = pickWelcomeGreeting(undefined, 8, () => 0);
    expect(greeting).not.toContain('undefined');
    expect(greeting).not.toContain('Usuário');
    expect(greeting.length).toBeGreaterThan(5);
  });
});
