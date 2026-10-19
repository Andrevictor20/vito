import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { FOCUS_MODES, FocusMode } from './focus';

describe('Focus Modes Unit Tests', () => {
  test('FOCUS_MODES catalog contém os 6 modos suportados pelo backend', () => {
    const expectedIds = ['calendar', 'tasks', 'triggers', 'meetings', 'briefing', 'memory'];
    const actualIds = FOCUS_MODES.map((m: FocusMode) => m.id);

    assert.equal(actualIds.length, 6);
    for (const expected of expectedIds) {
      assert.ok(actualIds.includes(expected), `Modo esperado ausente: ${expected}`);
    }
  });

  test('cada modo possui título, descrição e ícone válidos', () => {
    for (const mode of FOCUS_MODES) {
      assert.ok(mode.id && mode.id.length > 0, 'id deve ser não vazio');
      assert.ok(mode.title && mode.title.length > 0, 'title deve ser não vazio');
      assert.ok(mode.description && mode.description.length > 0, 'description deve ser não vazia');
      assert.ok(mode.iconName && mode.iconName.length > 0, 'iconName deve ser não vazio');
    }
  });
});
