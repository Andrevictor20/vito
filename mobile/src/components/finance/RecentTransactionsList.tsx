import React, { useMemo } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ProtoUiIcon } from '../../icons/ProtoUiIcons';
import { tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { FinanceTransaction } from '../../types/finance';
import {
  formatBRL,
  formatShortTxDate,
  getPaymentMethodKind,
  isCreditTransaction,
  maskBRL,
} from './financeHelpers';
import { TransactionSemanticBadge } from './FinanceSemanticIcons';

interface RecentTransactionsListProps {
  transactions: FinanceTransaction[];
  isPrivacyHidden: boolean;
  onViewAll: () => void;
  onSelectTransaction?: (tx: FinanceTransaction) => void;
}

export interface DayGroup {
  dayLabel: string;
  items: FinanceTransaction[];
}

export function groupTransactionsByDay(transactions: FinanceTransaction[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const tx of transactions.slice(0, 5)) {
    const label = formatShortTxDate(tx.occurred_at);
    const last = groups[groups.length - 1];
    if (last && last.dayLabel === label) {
      last.items.push(tx);
    } else {
      groups.push({ dayLabel: label, items: [tx] });
    }
  }
  return groups;
}

export const RecentTransactionsList: React.FC<RecentTransactionsListProps> = ({
  transactions,
  isPrivacyHidden,
  onViewAll,
  onSelectTransaction,
}) => {
  const { colors, isDark } = useTheme();
  const grouped = useMemo(() => groupTransactionsByDay(transactions), [transactions]);

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.ink }]}>Últimas movimentações</Text>
        <TouchableOpacity
          style={[styles.extractPill, { backgroundColor: colors.surf }]}
          onPress={onViewAll}
          activeOpacity={0.75}
        >
          <Text style={[styles.extractPillText, { color: colors.ink }]}>Extrato</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.fxList, { backgroundColor: colors.surf }]}>
        {grouped.length === 0 ? (
          <View style={styles.emptyBox}>
            <ProtoUiIcon name="receipt-long" size={28} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              As movimentações dos seus bancos aparecerão aqui após a sincronização.
            </Text>
          </View>
        ) : (
          grouped.map((group, gIdx) => (
            <View key={`${group.dayLabel}_${gIdx}`}>
              <Text style={[styles.fxDay, { color: colors.muted }]}>{group.dayLabel}</Text>
              {group.items.map((tx, idx) => {
                const isCredit = isCreditTransaction(tx);
                const methodKind = getPaymentMethodKind(tx);
                const merchantName = tx.clean_merchant_name || tx.description || 'Lançamento bancário';

                return (
                  <TouchableOpacity
                    key={tx.id || tx.pluggy_transaction_id || `tx_${gIdx}_${idx}`}
                    style={[
                      styles.txRow,
                      idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                    ]}
                    onPress={() => onSelectTransaction?.(tx)}
                    activeOpacity={0.75}
                  >
                    <TransactionSemanticBadge
                      merchant={merchantName}
                      category={tx.category}
                      isCredit={isCredit}
                      isPix={methodKind === 'pix'}
                      isDark={isDark}
                      index={idx}
                      size={38}
                    />

                    <View style={styles.txDetailsCol}>
                      <Text style={[styles.txDescription, { color: colors.ink }]} numberOfLines={1}>
                        {merchantName}
                      </Text>
                      <Text style={[styles.txMeta, { color: colors.muted }]} numberOfLines={1}>
                        {tx.category || 'Geral'}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.txAmountText,
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
          ))
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: 'Geist_500Medium',
    fontSize: 17,
    letterSpacing: -0.3,
  },
  extractPill: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractPillText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
  },
  fxList: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  fxDay: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12.5,
    paddingTop: 14,
    paddingBottom: 2,
  },
  emptyBox: {
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontFamily: 'Geist',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetailsCol: {
    flex: 1,
    minWidth: 0,
  },
  txDescription: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
  },
  txMeta: {
    fontFamily: 'Geist',
    fontSize: 12,
    marginTop: 2,
  },
  txAmountText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
  },
});
