import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getBankBrand, partitionBankAccounts } from '../../../utils/bankBrands';
import type { FinanceAccount } from '../../../types/finance';

describe('BankBrands & Multi-Account Partitioning', () => {
  it('reconhece corretamente as principais instituições financeiras e cores', () => {
    const nu = getBankBrand('Nubank S.A.');
    assert.strictEqual(nu.name, 'Nubank');
    assert.strictEqual(nu.initials, 'nu');
    assert.strictEqual(nu.color, '#820AD1');

    const itau = getBankBrand('Banco Itaú Unibanco');
    assert.strictEqual(itau.name, 'Itaú');
    assert.strictEqual(itau.initials, 'IT');
    assert.strictEqual(itau.color, '#EC7000');

    const inter = getBankBrand('Banco Inter');
    assert.strictEqual(inter.name, 'Inter');
    assert.strictEqual(inter.initials, 'IN');
    assert.strictEqual(inter.color, '#FF7A00');

    const bradesco = getBankBrand('Banco Bradesco');
    assert.strictEqual(bradesco.name, 'Bradesco');
    assert.strictEqual(bradesco.initials, 'BR');
    assert.strictEqual(bradesco.color, '#CC092F');

    const bb = getBankBrand('Banco do Brasil');
    assert.strictEqual(bb.name, 'BB');
    assert.strictEqual(bb.initials, 'BB');

    const fallback = getBankBrand('XP Investimentos');
    assert.strictEqual(fallback.name, 'XP Investimentos');
    assert.strictEqual(fallback.initials, 'XP');
  });

  it('organiza e particiona corretamente 2 ou mais contas bancárias', () => {
    const mockAccounts: FinanceAccount[] = [
      {
        id: 'acc-1',
        connection_id: 'conn-nu',
        pluggy_account_id: 'plg-1',
        institution_name: 'Nubank',
        name: 'Conta do Nubank',
        account_type: 'BANK',
        account_subtype: 'CHECKING_ACCOUNT',
        balance: 200.99,
        currency_code: 'BRL',
        updated_at: new Date().toISOString(),
      },
      {
        id: 'acc-2',
        connection_id: 'conn-nu',
        pluggy_account_id: 'plg-2',
        institution_name: 'Nubank',
        name: 'Caixinha Reserva',
        account_type: 'BANK',
        account_subtype: 'SAVINGS_ACCOUNT',
        balance: 86.00,
        currency_code: 'BRL',
        updated_at: new Date().toISOString(),
      },
      {
        id: 'acc-3',
        connection_id: 'conn-nu',
        pluggy_account_id: 'plg-3',
        institution_name: 'Nubank',
        name: 'Cartão de Crédito',
        account_type: 'CREDIT',
        balance: -249.00,
        credit_limit: 4300,
        currency_code: 'BRL',
        updated_at: new Date().toISOString(),
      },
    ];

    const { bankAccounts, creditAccounts, totalBankBalance } = partitionBankAccounts(mockAccounts);
    assert.strictEqual(bankAccounts.length, 2);
    assert.strictEqual(creditAccounts.length, 1);
    assert.strictEqual(Number(totalBankBalance.toFixed(2)), 286.99);

    // Valida share percentual de cada conta no saldo consolidado
    const share1 = Math.round((bankAccounts[0].balance / totalBankBalance) * 100);
    const share2 = Math.round((bankAccounts[1].balance / totalBankBalance) * 100);
    assert.strictEqual(share1, 70); // 200.99 / 286.99 = 70.03%
    assert.strictEqual(share2, 30); // 86.00 / 286.99 = 29.97%
    assert.strictEqual(share1 + share2, 100);
  });

  it('lida com múltiplas instituições bancárias simultâneas', () => {
    const mockAccounts: FinanceAccount[] = [
      {
        id: 'acc-nu',
        connection_id: 'conn-nu',
        pluggy_account_id: 'plg-1',
        institution_name: 'Nubank',
        name: 'NuConta',
        account_type: 'BANK',
        balance: 286.99,
        currency_code: 'BRL',
        updated_at: new Date().toISOString(),
      },
      {
        id: 'acc-itau',
        connection_id: 'conn-itau',
        pluggy_account_id: 'plg-2',
        institution_name: 'Itaú Unibanco',
        name: 'Conta Corrente Itaú',
        account_type: 'BANK',
        balance: 1500.00,
        currency_code: 'BRL',
        updated_at: new Date().toISOString(),
      },
    ];

    const { bankAccounts } = partitionBankAccounts(mockAccounts);
    const distinctInstitutions = Array.from(
      new Set(bankAccounts.map((a) => a.institution_name))
    );

    assert.strictEqual(distinctInstitutions.length, 2);
    assert.deepStrictEqual(distinctInstitutions, ['Nubank', 'Itaú Unibanco']);
  });
});
