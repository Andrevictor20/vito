import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { tokens, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { getBankBrand } from '../../utils/bankBrands';
import {
  buildFinScale,
  buildMonthlyFlowSeries,
  computeCreditCardStats,
  formatBRL,
  getPaymentMethodKind,
  isCreditTransaction,
  maskBRL,
} from './financeHelpers';
import { FinanceGroupedFlowChart } from './FinanceSubScreenCharts';
import type { SubViewCommonProps } from './FinanceSubScreenViews';
import { subScreenStyles as styles } from './financeSubScreenStyles';

export const CashFlowSubView: React.FC<SubViewCommonProps> = ({
  summary,
  transactions,
  isPrivacyHidden,
}) => {
  const { colors } = useTheme();
  const income = summary.month_income ?? 0;
  const expenses = summary.month_expenses ?? summary.monthly_spend_actual ?? 0;
  const leftover = income - expenses;
  const savingsRate = income > 0 ? Math.max(0, Math.round((leftover / income) * 100)) : 0;
  const monthlySeries = buildMonthlyFlowSeries(transactions, income, expenses);

  return (
    <View>
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>SOBRA NO MÊS</Text>
        <Text
          style={[
            styles.bigValue,
            tabularNumbers,
            { color: leftover >= 0 ? colors.acc : colors.red },
          ]}
        >
          {isPrivacyHidden
            ? 'R$ ••••'
            : `${leftover >= 0 ? '+' : '−'}${formatBRL(leftover)}`}
        </Text>

        <View style={[localStyles.f3Row, { borderTopColor: colors.line }]}>
          <View style={localStyles.f3Col}>
            <Text style={[localStyles.f3Val, tabularNumbers, { color: colors.acc }]}>
              {maskBRL(isPrivacyHidden, formatBRL(income, 0))}
            </Text>
            <Text style={[localStyles.f3Lbl, { color: colors.muted }]}>Entradas</Text>
          </View>
          <View style={localStyles.f3Col}>
            <Text style={[localStyles.f3Val, tabularNumbers, { color: colors.red }]}>
              {maskBRL(isPrivacyHidden, formatBRL(expenses, 0))}
            </Text>
            <Text style={[localStyles.f3Lbl, { color: colors.muted }]}>Saídas</Text>
          </View>
          <View style={localStyles.f3Col}>
            <Text style={[localStyles.f3Val, tabularNumbers, { color: colors.ink }]}>
              {isPrivacyHidden ? '••%' : `${savingsRate}%`}
            </Text>
            <Text style={[localStyles.f3Lbl, { color: colors.muted }]}>Taxa de poupança</Text>
          </View>
        </View>
      </View>

      <View style={styles.secHeader}>
        <Text style={[styles.secTitle, { color: colors.ink }]}>Histórico mensal</Text>
      </View>
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <FinanceGroupedFlowChart
          income={monthlySeries.income}
          expenses={monthlySeries.expenses}
          labels={monthlySeries.labels}
        />
        <View style={localStyles.flowLegendRow}>
          <View style={localStyles.flowLegendItem}>
            <View style={[localStyles.smallDot, { backgroundColor: colors.acc }]} />
            <Text style={[styles.rowMeta, { color: colors.muted }]}>Entradas</Text>
          </View>
          <View style={localStyles.flowLegendItem}>
            <View style={[localStyles.smallDot, { backgroundColor: colors.red }]} />
            <Text style={[styles.rowMeta, { color: colors.muted }]}>Saídas</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export const CardsSubView: React.FC<SubViewCommonProps> = ({
  summary,
  accounts,
  transactions,
  isPrivacyHidden,
  onAskVito,
}) => {
  const { colors } = useTheme();
  const finScale = buildFinScale(colors.fin);
  const stats = computeCreditCardStats(accounts, summary);
  const primary = stats.creditAccounts[0];

  if (stats.creditAccounts.length === 0) {
    return (
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <Text style={[styles.rowTitle, { color: colors.ink }]}>Nenhum cartão de crédito conectado</Text>
        <Text style={[styles.rowMeta, { color: colors.muted, marginTop: 6 }]}>
          Conecte uma conta com cartão de crédito via Open Finance para acompanhar faturas e limite.
        </Text>
      </View>
    );
  }

  const cardTxByCat = new Map<string, number>();
  for (const tx of transactions) {
    if (!isCreditTransaction(tx) && getPaymentMethodKind(tx) === 'card') {
      const cat = tx.category || 'Outros';
      cardTxByCat.set(cat, (cardTxByCat.get(cat) || 0) + Math.abs(tx.amount));
    }
  }
  const catEntries = Array.from(cardTxByCat.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const catSum = catEntries.reduce((acc, [, v]) => acc + v, 0);

  return (
    <View>
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>
          FATURA ATUAL · {primary?.name || 'Cartão'}
        </Text>
        <Text style={[styles.bigValue, tabularNumbers, { color: colors.ink }]}>
          {maskBRL(isPrivacyHidden, formatBRL(stats.totalBill))}
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: colors.line }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${stats.usedPercent}%`, backgroundColor: colors.fin },
            ]}
          />
        </View>
        <View style={styles.splitMeta}>
          <Text style={[styles.rowMeta, { color: colors.muted }]}>
            {primary?.closing_day ? `Fecha dia ${primary.closing_day}` : 'Ciclo atual'}
          </Text>
          <Text
            style={[
              styles.rowMeta,
              {
                color: stats.hasBillAlert ? colors.orange : colors.muted,
                fontWeight: '600',
              },
            ]}
          >
            {stats.dueLabel}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryPillBtn, { backgroundColor: colors.ink }]}
          onPress={() =>
            onAskVito(
              `Me lembra de pagar a fatura do cartão ${primary?.name || ''} de ${formatBRL(stats.totalBill)}`
            )
          }
          activeOpacity={0.82}
        >
          <Text style={[styles.primaryPillBtnText, { color: colors.bg }]}>
            Lembrar de pagar fatura
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.secHeader}>
        <Text style={[styles.secTitle, { color: colors.ink }]}>Limite</Text>
        <View style={[styles.countPill, { backgroundColor: colors.surf }]}>
          <Text style={[styles.countText, { color: colors.muted }]}>
            {stats.creditAccounts.length}{' '}
            {stats.creditAccounts.length === 1 ? 'cartão' : 'cartões'}
          </Text>
        </View>
      </View>
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <View style={[styles.splitMeta, { marginTop: 0 }]}>
          <Text style={[styles.rowTitle, tabularNumbers, { color: colors.ink }]}>
            {maskBRL(isPrivacyHidden, formatBRL(stats.totalBill))} usados
          </Text>
          <Text style={[styles.rowMeta, tabularNumbers, { color: colors.muted }]}>
            de {maskBRL(isPrivacyHidden, formatBRL(stats.totalLimit, 0))}
          </Text>
        </View>
        <View style={[styles.progressTrack, { backgroundColor: colors.line }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${stats.usedPercent}%`, backgroundColor: colors.acc },
            ]}
          />
        </View>
        <Text style={[styles.rowMeta, { color: colors.muted, marginTop: 8 }]}>
          {stats.usedPercent}% do limite · disponível{' '}
          {maskBRL(isPrivacyHidden, formatBRL(stats.totalAvailable))}
        </Text>

        <View style={{ marginTop: 10 }}>
          {stats.creditAccounts.map((card, idx) => {
            const brand = getBankBrand(card.institution_name);
            return (
              <View
                key={card.id || `card_${idx}`}
                style={[styles.txRow, { borderTopWidth: 1, borderTopColor: colors.line }]}
              >
                <View style={[styles.avatarBig, { backgroundColor: brand.color }]}>
                  <Text style={[styles.avatarBigText, { color: brand.textColor }]}>
                    {brand.initials}
                  </Text>
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                    {card.name}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.muted }]}>
                    {card.due_day ? `Vence dia ${card.due_day}` : brand.name}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, tabularNumbers, { color: colors.ink }]}>
                  {maskBRL(isPrivacyHidden, formatBRL(Math.abs(card.balance || 0)))}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      {catEntries.length > 0 && (
        <>
          <View style={styles.secHeader}>
            <Text style={[styles.secTitle, { color: colors.ink }]}>Compras no cartão</Text>
          </View>
          <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
            <View style={localStyles.stackedBar}>
              {catEntries.map(([cat, val], idx) => (
                <View
                  key={cat}
                  style={{
                    flex: Math.max(1, val),
                    height: '100%',
                    borderRadius: 4,
                    backgroundColor: finScale[idx % finScale.length],
                  }}
                />
              ))}
            </View>
            <View style={styles.legendList}>
              {catEntries.map(([cat, val], idx) => (
                <View
                  key={cat}
                  style={[
                    styles.legendRow,
                    idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                  ]}
                >
                  <View
                    style={[styles.legendDot, { backgroundColor: finScale[idx % finScale.length] }]}
                  />
                  <View style={styles.rowBody}>
                    <Text style={[styles.rowTitle, { color: colors.ink }]}>{cat}</Text>
                    <Text style={[styles.rowMeta, { color: colors.muted }]}>
                      {catSum > 0 ? Math.round((val / catSum) * 100) : 0}%
                    </Text>
                  </View>
                  <Text style={[styles.rowAmount, tabularNumbers, { color: colors.ink }]}>
                    {maskBRL(isPrivacyHidden, formatBRL(val, 0))}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  );
};

const localStyles = StyleSheet.create({
  f3Row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  f3Col: {
    flex: 1,
  },
  f3Val: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 17,
    fontWeight: '800',
  },
  f3Lbl: {
    fontSize: 11.5,
    marginTop: 2,
  },
  flowLegendRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  flowLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  stackedBar: {
    flexDirection: 'row',
    gap: 3,
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
});
