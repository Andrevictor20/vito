import { describe, it } from 'node:test';
import assert from 'node:assert';
import { getBankBrand, partitionBankAccounts } from '../../../utils/bankBrands';
import { darkColors, lightColors } from '../../../theme/tokens';
import type { FinanceAccount, FinanceTransaction } from '../../../types/finance';
import {
  EMPTY_FINANCIAL_SUMMARY,
  buildDailySpendingSeries,
  buildFinScale,
  buildMonthlyFlowSeries,
  computeCreditCardStats,
  filterExtractTransactions,
  formatBRL,
  getAlertMessage,
  getCategoryAmount,
  getPaymentMethodKind,
  getSubscriptionName,
  hasSubscriptionIncrease,
  maskBRL,
  normalizeSummary,
} from '../financeHelpers';

describe('Vito Finance Design System & Helpers', () => {
  it('define tokens canônicos --fin e --fin-bg nos temas Light e Dark', () => {
    assert.strictEqual(lightColors.fin, '#a8710a');
    assert.strictEqual(lightColors.finBg, '#fbf0d8');
    assert.strictEqual(darkColors.fin, '#f5b93d');
    assert.strictEqual(darkColors.finBg, '#3a2b0b');

    const lightScale = buildFinScale(lightColors.fin);
    assert.strictEqual(lightScale.length, 5);
    assert.strictEqual(lightScale[0], '#a8710a');
    assert.ok(lightScale[1].startsWith('rgba(168, 113, 10, 0.72)'));
  });

  it('normalizeSummary preserva zeros reais sem injetar dados mockados falsos', () => {
    const empty = normalizeSummary(null);
    assert.deepStrictEqual(empty, EMPTY_FINANCIAL_SUMMARY);
    assert.strictEqual(empty.total_balance, 0);
    assert.strictEqual(empty.month_expenses, 0);
    assert.strictEqual(empty.connected_institutions_count, 0);
    assert.strictEqual(empty.category_spending.length, 0);
    assert.strictEqual(empty.subscriptions.length, 0);

    const backendNormalized = normalizeSummary({
      consolidated_balance: 1420.5,
      open_invoices_total: 320.0,
      safe_to_spend_daily: 55.0,
      safe_to_spend_days_remaining: 20,
      connected_institutions_count: 2,
      month_expenses: 890.0,
      month_income: 2100.0,
      category_spending: [
        { category: 'Alimentação', total_amount: 540, percentage: 60.7, delta_percent: 14 },
      ],
      subscriptions: [
        { merchant_name: 'Spotify', amount: 21.9, frequency: 'monthly', is_price_increased: true },
      ],
      alerts: [
        { id: 'a1', kind: 'INVOICE_EXCEEDS_BALANCE', title: 'Fatura', message: 'Faltam R$ 100', severity: 'critical' },
      ],
    });

    assert.strictEqual(backendNormalized.total_balance, 1420.5);
    assert.strictEqual(backendNormalized.open_credit_card_bills, 320.0);
    assert.strictEqual(backendNormalized.days_remaining_in_month, 20);
    assert.strictEqual(getCategoryAmount(backendNormalized.category_spending[0]), 540);
    assert.strictEqual(getSubscriptionName(backendNormalized.subscriptions[0]), 'Spotify');
    assert.strictEqual(hasSubscriptionIncrease(backendNormalized.subscriptions[0]), true);
    assert.strictEqual(getAlertMessage(backendNormalized.attention_alerts[0]), 'Faltam R$ 100');
  });

  it('reconhece corretamente as principais instituições financeiras e cores', () => {
    const nu = getBankBrand('Nubank S.A.');
    assert.strictEqual(nu.name, 'Nubank');
    assert.strictEqual(nu.initials, 'nu');
    assert.strictEqual(nu.color, '#820AD1');

    const itau = getBankBrand('Banco Itaú Unibanco');
    assert.strictEqual(itau.name, 'Itaú');
    assert.strictEqual(itau.initials, 'IT');

    const inter = getBankBrand('Banco Inter');
    assert.strictEqual(inter.name, 'Inter');
    assert.strictEqual(inter.initials, 'IN');
  });

  it('organiza e particiona corretamente múltiplas contas bancárias e cartões', () => {
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
        balance: 86.0,
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
        balance: -249.0,
        credit_limit: 4300,
        available_credit_limit: 4051,
        due_day: 16,
        currency_code: 'BRL',
        updated_at: new Date().toISOString(),
      },
    ];

    const { bankAccounts, creditAccounts, totalBankBalance } = partitionBankAccounts(mockAccounts);
    assert.strictEqual(bankAccounts.length, 2);
    assert.strictEqual(creditAccounts.length, 1);
    assert.strictEqual(Number(totalBankBalance.toFixed(2)), 286.99);

    const summary = normalizeSummary({ open_credit_card_bills: 249.0 });
    const cardStats = computeCreditCardStats(mockAccounts, summary);
    assert.strictEqual(cardStats.totalBill, 249.0);
    assert.strictEqual(cardStats.totalLimit, 4300);
    assert.strictEqual(cardStats.totalAvailable, 4051);
    assert.strictEqual(cardStats.usedPercent, 6);
    assert.strictEqual(cardStats.dueLabel, 'Vence dia 16');
    assert.strictEqual(cardStats.primaryBrand?.initials, 'nu');
  });

  it('filtra extrato, detecta Pix/Cartão e agrega séries diárias e mensais', () => {
    const now = new Date();
    const d1 = new Date(now.getFullYear(), now.getMonth(), 2).toISOString();
    const d2 = new Date(now.getFullYear(), now.getMonth(), 5).toISOString();
    const txs: FinanceTransaction[] = [
      {
        id: 't1',
        account_id: 'a1',
        pluggy_transaction_id: 'p1',
        description: 'Pix recebido',
        amount: 500,
        transaction_type: 'CREDIT',
        payment_method: 'PIX',
        category: 'Entrada',
        occurred_at: d1,
      },
      {
        id: 't2',
        account_id: 'a1',
        pluggy_transaction_id: 'p2',
        description: 'Uber',
        amount: -32.5,
        transaction_type: 'DEBIT',
        payment_method: 'CREDIT_CARD',
        category: 'Transporte',
        occurred_at: d2,
      },
    ];

    assert.strictEqual(getPaymentMethodKind(txs[0]), 'pix');
    assert.strictEqual(getPaymentMethodKind(txs[1]), 'card');
    assert.strictEqual(filterExtractTransactions(txs, 'in').length, 1);
    assert.strictEqual(filterExtractTransactions(txs, 'out').length, 1);
    assert.strictEqual(filterExtractTransactions(txs, 'pix').length, 1);
    assert.strictEqual(filterExtractTransactions(txs, 'card').length, 1);

    const daily = buildDailySpendingSeries(txs);
    assert.strictEqual(daily.peakDay, 5);
    assert.strictEqual(daily.peakAmount, 32.5);

    const monthly = buildMonthlyFlowSeries(txs, 0, 0);
    assert.strictEqual(monthly.income[0], 500);
    assert.strictEqual(monthly.expenses[0], 32.5);

    assert.strictEqual(maskBRL(true, formatBRL(100)), 'R$ ••••');
    assert.strictEqual(maskBRL(false, formatBRL(100)), 'R$ 100,00');
  });
});
