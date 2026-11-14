import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { FinanceTransaction } from '../../types/finance';
import {
  formatBRL,
  formatShortTxDate,
  getPaymentMethodKind,
  isCreditTransaction,
  maskBRL,
} from './financeHelpers';

interface RecentTransactionsListProps {
  transactions: FinanceTransaction[];
  isPrivacyHidden: boolean;
  onViewAll: () => void;
  onSelectTransaction?: (tx: FinanceTransaction) => void;
}

export const RecentTransactionsList: React.FC<RecentTransactionsListProps> = ({
  transactions,
  isPrivacyHidden,
  onViewAll,
  onSelectTransaction,
}) => {
  const { colors } = useTheme();
  const displayList = transactions.slice(0, 5);

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

      <View style={[styles.cardContainer, { backgroundColor: colors.bg, borderColor: colors.line }]}>
        {displayList.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialIcons name="receipt-long" size={28} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              As movimentações dos seus bancos aparecerão aqui após a sincronização.
            </Text>
          </View>
        ) : (
          displayList.map((tx, idx) => {
            const isCredit = isCreditTransaction(tx);
            const methodKind = getPaymentMethodKind(tx);
            const chipBg = isCredit ? colors.greenBg : colors.finBg;
            const chipFg = isCredit ? colors.acc : colors.fin;

            return (
              <TouchableOpacity
                key={tx.id || tx.pluggy_transaction_id || `tx_${idx}`}
                style={[
                  styles.txRow,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                ]}
                onPress={() => onSelectTransaction?.(tx)}
                activeOpacity={0.75}
              >
                <View style={[styles.chip, { backgroundColor: chipBg }]}>
                  <MaterialIcons
                    name={methodKind === 'pix' ? 'qr-code-2' : 'credit-card'}
                    size={20}
                    color={chipFg}
                  />
                </View>

                <View style={styles.txDetailsCol}>
                  <Text style={[styles.txDescription, { color: colors.ink }]} numberOfLines={1}>
                    {tx.clean_merchant_name || tx.description || 'Lançamento bancário'}
                  </Text>
                  <Text style={[styles.txMeta, { color: colors.muted }]} numberOfLines={1}>
                    {tx.category || 'Geral'} · {formatShortTxDate(tx.occurred_at)}
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
          })
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    marginBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitle: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  extractPill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extractPillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  cardContainer: {
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
  },
  emptyBox: {
    paddingVertical: 24,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDetailsCol: {
    flex: 1,
    minWidth: 0,
  },
  txDescription: {
    fontSize: 15,
    fontWeight: '600',
  },
  txMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  txAmountText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
