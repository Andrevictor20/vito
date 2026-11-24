import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeHmacSha256,
  hashContactIdentifiers,
  matchContactsWithServer,
  LocalContactRecord,
} from './contactMatchingService';

describe('contactMatchingService (TDD)', () => {
  const testSalt = 'abc123salt';

  it('calcula HMAC-SHA256 idêntico ao esperado criptograficamente', async () => {
    const message = '+5511999998888';
    const hash = await computeHmacSha256(testSalt, message);
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64); // SHA-256 hex é 64 chars

    // Mesma entrada deve gerar mesmo hash
    const hash2 = await computeHmacSha256(testSalt, message);
    assert.equal(hash, hash2);

    // Sal diferente gera hash diferente
    const hashDiffSalt = await computeHmacSha256('different-salt', message);
    assert.notEqual(hash, hashDiffSalt);
  });

  it('normaliza e gera hashes para contatos locais mapeando de volta para os registros', async () => {
    const localContacts: LocalContactRecord[] = [
      {
        id: 'c1',
        name: 'Maria Silva',
        phoneNumbers: ['(11) 98765-4321', '011 98765-4321'], // Duplicados após normalização
        emails: ['Maria@Exemplo.com'],
      },
      {
        id: 'c2',
        name: 'João Santos',
        phoneNumbers: ['+55 21 91234-5678'],
        emails: [],
      },
    ];

    const { hashes, hashToContactMap } = await hashContactIdentifiers(testSalt, localContacts);

    // Deve conter hashes únicos
    assert.ok(hashes.length >= 2);
    // Cada hash na lista deve estar no mapa
    for (const h of hashes) {
      assert.ok(hashToContactMap.has(h));
    }

    // Verifica que Maria foi mapeada tanto pelo telefone normalizado quanto pelo email normalizado
    const mariaEntries = Array.from(hashToContactMap.values()).filter(v => v.contact.id === 'c1');
    assert.equal(mariaEntries.length, 2); // 1 telefone único normalizado + 1 email
  });

  it('cruza matches retornados pelo servidor com os nomes da agenda local', async () => {
    const localContacts: LocalContactRecord[] = [
      {
        id: 'c1',
        name: 'Carlos Amigo',
        phoneNumbers: ['(11) 97777-8888'],
        emails: ['carlos@vito.app'],
      },
    ];

    const mockApi = {
      getChallenge: async () => ({ salt: 'challenge-salt-456' }),
      matchContacts: async (salt: string, hashes: string[]) => {
        assert.equal(salt, 'challenge-salt-456');
        assert.ok(hashes.length > 0);
        return [
          {
            user_id: 'user-carlos-123',
            name: 'Carlos no Vito',
            phone: '+5511977778888',
            email: 'carlos@vito.app',
          },
        ];
      },
    };

    const results = await matchContactsWithServer(mockApi as any, localContacts);

    assert.equal(results.length, 1);
    assert.equal(results[0].userId, 'user-carlos-123');
    assert.equal(results[0].localName, 'Carlos Amigo');
    assert.equal(results[0].serverName, 'Carlos no Vito');
    assert.equal(results[0].phone, '+5511977778888');
  });
});
