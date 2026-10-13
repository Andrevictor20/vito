import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore
import { getDayPeriod, pickWelcomeGreeting } from './chatGreetings';

describe('Chat Greetings Sorteadas (TDD)', () => {
  describe('getDayPeriod', () => {
    it('mapeia os limites de cada período (5/12/18/24)', () => {
      assert.equal(getDayPeriod(0), 'dawn');
      assert.equal(getDayPeriod(4), 'dawn');
      assert.equal(getDayPeriod(5), 'morning');
      assert.equal(getDayPeriod(11), 'morning');
      assert.equal(getDayPeriod(12), 'afternoon');
      assert.equal(getDayPeriod(17), 'afternoon');
      assert.equal(getDayPeriod(18), 'evening');
      assert.equal(getDayPeriod(23), 'evening');
    });
  });

  describe('pickWelcomeGreeting', () => {
    it('saúda de manhã com Bom dia (hora 9)', () => {
      const msg = pickWelcomeGreeting('André', 9, () => 0);
      assert.ok(msg.startsWith('Bom dia'), `esperava Bom dia, got ${msg}`);
      assert.ok(msg.includes('André'));
    });

    it('saúda à tarde com Boa tarde (hora 15)', () => {
      const msg = pickWelcomeGreeting('André', 15, () => 0);
      assert.ok(msg.startsWith('Boa tarde'), `esperava Boa tarde, got ${msg}`);
    });

    it('saúda à noite com Boa noite (hora 21)', () => {
      const msg = pickWelcomeGreeting('André', 21, () => 0);
      assert.ok(msg.startsWith('Boa noite'), `esperava Boa noite, got ${msg}`);
    });

    it('saúda de madrugada (hora 3)', () => {
      const msg = pickWelcomeGreeting('André', 3, () => 0);
      assert.ok(msg.startsWith('Boa madrugada'), `esperava Boa madrugada, got ${msg}`);
    });

    it('usa frase anônima sem interpolar quando não há nome útil', () => {
      const msg = pickWelcomeGreeting('Usuário', 9, () => 0);
      assert.equal(msg.includes('{name}'), false);
      assert.equal(msg.includes('Usuário'), false);
      const empty = pickWelcomeGreeting('', 15, () => 0);
      assert.equal(empty.includes('{name}'), false);
    });

    it('usa só o primeiro nome quando nome composto', () => {
      const msg = pickWelcomeGreeting('André Victor', 9, () => 0);
      assert.equal(msg.includes('Victor'), false);
    });

    it('sempre retorna frase não vazia em qualquer hora', () => {
      for (let h = 0; h < 24; h++) {
        const msg = pickWelcomeGreeting('André', h, () => 0.5);
        assert.ok(msg.length > 0, `hora ${h} retornou vazio`);
        assert.equal(msg.includes('{name}'), false);
      }
    });

    it('sorteio varia dentro do período (rand diferente = frases diferentes)', () => {
      const seen = new Set<string>();
      for (let i = 0; i < 10; i++) {
        seen.add(pickWelcomeGreeting('André', 9, () => i / 10));
      }
      assert.ok(seen.size > 1, 'esperava variedade no sorteio da manhã');
    });

    it('nunca usa emojis nas frases', () => {
      const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
      for (let h = 0; h < 24; h++) {
        assert.equal(emoji.test(pickWelcomeGreeting('André', h, () => 0.3)), false);
      }
    });
  });
});
