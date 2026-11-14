import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isPluggyUuid,
  isPlausiblePluggySecret,
  normalizeKey,
  maskSecret,
  maskClientIdShort,
  canValidate,
  extractUuids,
  hasIdenticalKeys,
  detectSwappedKeysCandidate,
  parseCapturedKeysMessage,
} from '../pluggyKeys';

const UUID = '3f2b8c1e-9a47-4d6e-8b21-5c7a0e9d1f42';
const UUID_2 = 'b71e0d94-2c3a-48f7-a6d5-9e1f40c8a2b3';

describe('pluggyKeys', () => {
  it('isPluggyUuid aceita UUID válido (com espaços e maiúsculas)', () => {
    assert.equal(isPluggyUuid(UUID), true);
    assert.equal(isPluggyUuid(`  ${UUID.toUpperCase()} `), true);
  });

  it('isPluggyUuid rejeita valores inválidos', () => {
    assert.equal(isPluggyUuid(''), false);
    assert.equal(isPluggyUuid('abc'), false);
    assert.equal(isPluggyUuid(UUID + 'x'), false);
    assert.equal(isPluggyUuid('3f2b8c1e-9a47-4d6e-8b21'), false);
  });

  it('normalizeKey remove espaços e quebras de linha das pontas', () => {
    assert.equal(normalizeKey(`\n  ${UUID}  \t`), UUID);
  });

  it('maskSecret mostra só os 4 últimos caracteres', () => {
    assert.equal(maskSecret('abcdefgh'), '••••efgh');
    assert.equal(maskSecret('abc'), '•••');
    assert.equal(maskSecret(''), '');
  });

  it('maskClientIdShort formata no padrão xxxx••••xx', () => {
    assert.equal(maskClientIdShort(UUID), '3f2b••••42');
    assert.equal(maskClientIdShort(''), '—');
  });

  it('canValidate exige clientId UUID, secret não vazio e não idêntico', () => {
    assert.equal(canValidate(UUID, 'segredo'), true);
    assert.equal(canValidate(UUID, UUID_2), true);
    assert.equal(canValidate(UUID, UUID), false);
    assert.equal(canValidate(UUID, UUID.toUpperCase()), false);
    assert.equal(canValidate(UUID, '   '), false);
    assert.equal(canValidate('nao-uuid', 'segredo'), false);
    assert.equal(canValidate('', ''), false);
  });

  it('hasIdenticalKeys detecta chaves iguais case-insensitive', () => {
    assert.equal(hasIdenticalKeys(UUID, UUID.toUpperCase()), true);
    assert.equal(hasIdenticalKeys(UUID, UUID_2), false);
    assert.equal(hasIdenticalKeys('', ''), false);
  });

  it('extractUuids extrai UUIDs em ordem e remove duplicatas', () => {
    const text = `Client ID:\n${UUID}\nOutro: ${UUID.toUpperCase()}\nClient Secret:\n${UUID_2}`;
    assert.deepEqual(extractUuids(text), [UUID, UUID_2]);
    assert.deepEqual(extractUuids('nenhum uuid aqui'), []);
    assert.deepEqual(extractUuids(''), []);
  });

  it('detectSwappedKeysCandidate retorna par invertido apenas para dois UUIDs distintos', () => {
    assert.deepEqual(detectSwappedKeysCandidate(UUID_2, UUID), { clientId: UUID, clientSecret: UUID_2 });
    assert.equal(detectSwappedKeysCandidate(UUID, UUID), null);
    assert.equal(detectSwappedKeysCandidate(UUID, 'segredo-nao-uuid'), null);
  });

  it('parseCapturedKeysMessage extrai par completo do rawText ou campos diretos', () => {
    const msg = parseCapturedKeysMessage(
      JSON.stringify({
        type: 'captured_keys',
        rawText: `Client ID ${UUID} Client Secret ${UUID_2}`,
        source: 'scan',
      }),
    );
    assert.deepEqual(msg, {
      clientId: UUID,
      clientSecret: UUID_2,
      partial: false,
      maskedSecretDetected: false,
      source: 'scan',
    });

    const direct = parseCapturedKeysMessage(
      JSON.stringify({
        type: 'captured_keys',
        clientId: UUID,
        clientSecret: UUID_2,
        source: 'clipboard',
      }),
    );
    assert.deepEqual(direct, {
      clientId: UUID,
      clientSecret: UUID_2,
      partial: false,
      maskedSecretDetected: false,
      source: 'clipboard',
    });
  });

  it('parseCapturedKeysMessage trata captura parcial com secret mascarado e rejeita payload inválido', () => {
    const partial = parseCapturedKeysMessage(
      JSON.stringify({
        type: 'partial_keys',
        rawText: UUID,
        maskedSecretDetected: true,
        source: 'scan',
      }),
    );
    assert.deepEqual(partial, {
      clientId: UUID,
      clientSecret: '',
      partial: true,
      maskedSecretDetected: true,
      source: 'scan',
    });

    assert.equal(parseCapturedKeysMessage('not-json'), null);
    assert.equal(parseCapturedKeysMessage(JSON.stringify({ type: 'unknown', rawText: UUID })), null);
    assert.equal(parseCapturedKeysMessage(JSON.stringify({ type: 'clipboard_copy', rawText: 'minha-senha-123' })), null);
  });

  it('aceita Client Secret gerado não-UUID (network/copy/auto_scan) e rejeita API Key JWT', () => {
    const nonUuidSecret = 'plg_sec_9a8b7c6d5e4f3a2b1c0d9e8f';
    assert.equal(isPlausiblePluggySecret(nonUuidSecret), true);
    assert.equal(
      isPlausiblePluggySecret('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.payload_123456.sig_7890'),
      false,
    );
    assert.equal(isPlausiblePluggySecret('b735999c-1306-4759-86de-49af53d0...'), false);

    const netMsg = parseCapturedKeysMessage(
      JSON.stringify({
        type: 'partial_keys',
        clientSecret: nonUuidSecret,
        source: 'network',
      }),
    );
    assert.deepEqual(netMsg, {
      clientId: '',
      clientSecret: nonUuidSecret,
      partial: true,
      maskedSecretDetected: false,
      source: 'network',
    });

    const copiedSecret = parseCapturedKeysMessage(
      JSON.stringify({
        type: 'clipboard_copy',
        rawText: nonUuidSecret,
        source: 'copy',
      }),
    );
    assert.deepEqual(copiedSecret, {
      clientId: '',
      clientSecret: nonUuidSecret,
      partial: true,
      maskedSecretDetected: false,
      source: 'copy',
    });
  });
});
