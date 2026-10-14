import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cleanSnippet, semanticTitle, humanizePreview } from './chatPreview';

describe('chatPreview', () => {
  it('corta sem quebrar palavra', () => {
    assert.equal(cleanSnippet('Comprar café em grãos na padaria', 16), 'Comprar café em...');
  });

  it('título semântico corta na pontuação', () => {
    assert.equal(semanticTitle('Criar evento dentista amanhã. E outra coisa'), 'Criar evento dentista amanhã');
    assert.equal(semanticTitle(''), 'Conversa Atual');
  });

  it('prévia higieniza erro técnico', () => {
    assert.equal(
      humanizePreview('fetch failed: java.net.UnknownHostException: vito.rasppi.cloud'),
      'Falha de conexão — toque para resgatar a conversa',
    );
    assert.equal(humanizePreview('https://x.com/abc erro HTTP 500'), 'Falha de conexão — toque para resgatar a conversa');
    assert.equal(humanizePreview('Olá, tudo bem?'), 'Olá, tudo bem?');
    assert.equal(humanizePreview(''), 'Sem mensagens');
  });
});
