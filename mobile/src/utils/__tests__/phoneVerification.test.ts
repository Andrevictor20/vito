import test from 'node:test';
import assert from 'node:assert/strict';
import { findSelfPhoneInContacts } from '../../services/contactMatchingService';
import { toE164Phone, formatPhoneNumber } from '../phoneFormat';

test('findSelfPhoneInContacts detecta o número do próprio usuário pelo e-mail da conta', () => {
  const contacts = [
    {
      id: '1',
      name: 'Maria',
      phoneNumbers: ['(11) 91111-2222'],
      emails: ['maria@teste.com'],
    },
    {
      id: '2',
      name: 'Andre Victor',
      phoneNumbers: ['(11) 98765-4321'],
      emails: ['andre@vito.ai'],
    },
  ];

  const detected = findSelfPhoneInContacts(contacts, 'andre@vito.ai', 'Andre');
  assert.equal(detected, '+5511987654321');
});

test('findSelfPhoneInContacts detecta número pelo nome do usuário ou cartão Eu/Me e formata em E.164', () => {
  const contacts = [
    {
      id: '10',
      name: 'Eu',
      phoneNumbers: ['21 99888-7766'],
      emails: [],
    },
  ];

  const detected = findSelfPhoneInContacts(contacts, 'outro@vito.ai', 'Andre Victor');
  assert.equal(detected, '+5521998887766');
  assert.equal(formatPhoneNumber(toE164Phone('11987654321')), '+55 (11) 98765-4321');
});
