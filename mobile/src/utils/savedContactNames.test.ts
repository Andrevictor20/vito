import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildSavedNames } from './savedContactNames';

describe('buildSavedNames Unit Tests', () => {
  test('mapeia o nome salvo com o telefone em E.164', () => {
    const names = buildSavedNames([
      { name: 'Isa', phoneNumbers: ['(11) 98841-7165'] },
    ]);
    assert.equal(names.length, 1);
    assert.equal(names[0].name, 'Isa');
    assert.ok(names[0].phone.startsWith('+55'), `telefone deveria estar em E.164: ${names[0].phone}`);
  });

  test('ignora contato sem nome e o nome padrao "Sem Nome"', () => {
    const names = buildSavedNames([
      { name: '', phoneNumbers: ['11988417165'] },
      { name: '   ', phoneNumbers: ['11988417166'] },
      { name: 'Sem Nome', phoneNumbers: ['11988417167'] },
    ]);
    assert.equal(names.length, 0);
  });

  test('remove telefones duplicados do mesmo contato', () => {
    const names = buildSavedNames([
      { name: 'Isa', phoneNumbers: ['11988417165', '11988417165', '11988417166'] },
    ]);
    assert.equal(names.length, 2);
  });

  test('aceita agenda vazia', () => {
    assert.equal(buildSavedNames([]).length, 0);
  });
});
