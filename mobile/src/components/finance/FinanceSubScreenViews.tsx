import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import type {
  ExtractFilterKey,
  FinanceAccount,
  FinanceTransaction,
  FinancialSummary,
} from '../../types/finance';
import {
  buildDailySpendingSeries,
  buildFinScale,
  filterExtractTransactions,
  formatBRL,
  getCategoryAmount,
  getCategoryDelta,
  getPaymentMethodKind,
  groupTransactionsByDay,
  isCreditTransaction,
  maskBRL,
} from './financeHelpers';
import { FinanceDailyBarsChart, FinanceDonutChart } from './FinanceSubScreenCharts';
import { subScreenStyles as styles } from './financeSubScreenStyles';

export interface SubViewCommonProps {
  summary: FinancialSummary;
  accounts: FinanceAccount[];
  transactions: FinanceTransaction[];
  isPrivacyHidden: boolean;
  onAskVito: (prompt: string) => void;
}

const EXTRACT_FILTERS: ReadonlyArray<{ key: ExtractFilterKey; label: string }> = [
  { key: 'all', label: 'Tudo' },
  { key: 'in', label: 'Entradas' },
  { key: 'out', label: 'Saídas' },
  { key: 'card', label: 'Cartão' },
  { key: 'pix', label: 'Pix' },
];

export const ExtractSubView: React.FC<SubViewCommonProps> = ({
  transactions,
  isPrivacyHidden,
  onAskVito,
}) => {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<ExtractFilterKey>('all');

  const filtered = filterExtractTransactions(transactions, filter);
  const groups = groupTransactionsByDay(filtered);

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
      >
        {EXTRACT_FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.key}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? colors.ink : colors.bg,
                  borderColor: active ? colors.ink : colors.line,
                },
              ]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.78}
            >
              <Text style={[styles.filterChipText, { color: active ? colors.bg : colors.ink }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {groups.length === 0 ? (
        <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
          <Text style={[styles.emptyText, { color: colors.muted }]}>
            Nenhuma movimentação encontrada para este filtro.
          </Text>
        </View>
      ) : (
        groups.map((grp) => (
          <View key={grp.dayLabel} style={styles.dayGroup}>
            <Text style={[styles.dayHeader, { color: colors.muted }]}>{grp.dayLabel}</Text>
            <View style={[styles.card2Flush, { backgroundColor: colors.bg, borderColor: colors.line }]}>
              {grp.items.map((tx, idx) => {
                const isCredit = isCreditTransaction(tx);
                const method = getPaymentMethodKind(tx);
                const chipBg = isCredit ? colors.greenBg : colors.finBg;
                const chipFg = isCredit ? colors.acc : colors.fin;
                return (
                  <TouchableOpacity
                    key={tx.id || tx.pluggy_transaction_id || `ext_${idx}`}
                    style={[
                      styles.txRow,
                      idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                    ]}
                    onPress={() =>
                      onAskVito(
                        `Me explique ou ajude a recategorizar este lançamento: "${tx.clean_merchant_name || tx.description}" (${formatBRL(tx.amount)})`
                      )
                    }
                    activeOpacity={0.75}
                  >
                    <View style={[styles.chip, { backgroundColor: chipBg }]}>
                      <MaterialIcons
                        name={method === 'pix' ? 'qr-code-2' : 'credit-card'}
                        size={20}
                        color={chipFg}
                      />
                    </View>
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                        {tx.clean_merchant_name || tx.description || 'Lançamento'}
                      </Text>
                      <Text style={[styles.rowMeta, { color: colors.muted }]} numberOfLines={1}>
                        {tx.category || 'Geral'} · {method === 'pix' ? 'Pix' : 'Cartão / Conta'}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.rowAmount,
                        tabularNumbers,
                        { color: isCredit ? colors.acc : colors.ink },
                      ]}
                    >
                      {isPrivacyHidden
                        ? maskBRL(true, '')
                        : `${isCredit ? '+' : '−'}${formatBRL(tx.amount)}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ))
      )}
    </View>
  );
};

export const SpendingSubView: React.FC<SubViewCommonProps> = ({
  summary,
  transactions,
  isPrivacyHidden,
}) => {
  const { colors } = useTheme();
  const finScale = buildFinScale(colors.fin);
  const categories = summary.category_spending;
  const total =
    categories.reduce((acc, c) => acc + getCategoryAmount(c), 0) || (summary.month_expenses ?? 0);
  const dailySeries = buildDailySpendingSeries(transactions);
  const topExpenses = transactions
    .filter((t) => !isCreditTransaction(t))
    .slice()
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5);

  return (
    <View>
      <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        <Text style={[styles.eyebrow, { color: colors.muted }]}>TOTAL NO MÊS</Text>
        <Text style={[styles.bigValue, tabularNumbers, { color: colors.ink }]}>
          {maskBRL(isPrivacyHidden, formatBRL(total))}
        </Text>

        {categories.length > 0 ? (
          <>
            <FinanceDonutChart
              segments={categories.map((c) => ({
                label: c.category,
                value: getCategoryAmount(c),
              }))}
              centerPrimary={maskBRL(isPrivacyHidden, formatBRL(total, 0))}
              centerSecondary="gasto no mês"
            />
            <View style={styles.legendList}>
              {categories.map((cat, idx) => {
                const amt = getCategoryAmount(cat);
                const pct =
                  total > 0 ? Math.round((amt / total) * 100) : Math.round(cat.percentage || 0);
                const delta = getCategoryDelta(cat);
                return (
                  <View
                    key={`${cat.category}_${idx}`}
                    style={[
                      styles.legendRow,
                      idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                    ]}
                  >
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: finScale[idx % finScale.length] },
                      ]}
                    />
                    <View style={styles.rowBody}>
                      <Text style={[styles.rowTitle, { color: colors.ink }]}>{cat.category}</Text>
                      <Text style={[styles.rowMeta, { color: colors.muted }]}>
                        {pct}% do total
                        {typeof delta === 'number' && delta > 10
                          ? ` · +${Math.round(delta)}% vs média`
                          : ''}
                      </Text>
                    </View>
                    <Text style={[styles.rowAmount, tabularNumbers, { color: colors.ink }]}>
                      {maskBRL(isPrivacyHidden, formatBRL(amt, 0))}
                    </Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <Text style={[styles.emptyText, { color: colors.muted, marginTop: 12 }]}>
            Nenhuma categoria de gasto registrada neste mês.
          </Text>
        )}
      </View>

      {dailySeries.values.length > 0 && (
        <>
          <View style={styles.secHeader}>
            <Text style={[styles.secTitle, { color: colors.ink }]}>Por dia</Text>
          </View>
          <View style={[styles.card2, { backgroundColor: colors.bg, borderColor: colors.line }]}>
            <FinanceDailyBarsChart
              values={dailySeries.values}
              labels={dailySeries.labels}
              highlightIndex={dailySeries.peakIndex}
              averageValue={dailySeries.avg}
            />
            <Text style={[styles.rowMeta, { color: colors.muted, marginTop: 10 }]}>
              Média de {maskBRL(isPrivacyHidden, formatBRL(dailySeries.avg, 0))} por dia · maior dia: dia{' '}
              {dailySeries.peakDay}, {maskBRL(isPrivacyHidden, formatBRL(dailySeries.peakAmount, 0))}
            </Text>
          </View>
        </>
      )}

      {topExpenses.length > 0 && (
        <>
          <View style={styles.secHeader}>
            <Text style={[styles.secTitle, { color: colors.ink }]}>Maiores gastos</Text>
          </View>
          <View style={[styles.card2Flush, { backgroundColor: colors.bg, borderColor: colors.line }]}>
            {topExpenses.map((tx, idx) => (
              <View
                key={tx.id || `top_${idx}`}
                style={[
                  styles.legendRow,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                ]}
              >
                <View
                  style={[styles.legendDot, { backgroundColor: finScale[idx % finScale.length] }]}
                />
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, { color: colors.ink }]} numberOfLines={1}>
                    {tx.clean_merchant_name || tx.description}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.muted }]}>
                    {tx.category || 'Geral'}
                  </Text>
                </View>
                <Text style={[styles.rowAmount, tabularNumbers, { color: colors.ink }]}>
                  {maskBRL(isPrivacyHidden, formatBRL(tx.amount, 0))}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
};
