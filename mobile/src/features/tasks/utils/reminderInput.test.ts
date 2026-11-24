import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseReminderInput } from './reminderInput';

// W2: lembrete personalizado — "20/10 08:30" vira ISO local; inválidos dão null.
describe('reminderInput', () => {
  it('converte data+hora válidas em ISO', () => {
    // Referência fixa anterior à data: evita que o teste quebre quando 20/10/2026 vira "hoje".
    const ref = new Date(2026, 9, 13, 12, 0, 0).getTime();
    const iso = parseReminderInput('20/10/2026', '08:30', ref);
    assert.ok(iso);
    const d = new Date(iso!);
    assert.equal(d.getDate(), 20);
    assert.equal(d.getMonth(), 9);
    assert.equal(d.getHours(), 8);
    assert.equal(d.getMinutes(), 30);
  });

  it('rejeita data inválida', () => {
    assert.equal(parseReminderInput('40/13/2026', '08:30'), null);
    assert.equal(parseReminderInput('', '08:30'), null);
  });

  it('rejeita hora inválida', () => {
    assert.equal(parseReminderInput('20/10/2026', '25:00'), null);
    assert.equal(parseReminderInput('20/10/2026', ''), null);
  });

  it('rejeita passado (usa referência injetada)', () => {
    const ref = new Date(2026, 9, 13, 12, 0, 0).getTime();
    assert.equal(parseReminderInput('13/10/2026', '08:00', ref), null);
    assert.ok(parseReminderInput('13/10/2026', '18:00', ref));
  });
});
