import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { FinanceTransaction } from '../../types/finance';

interface RecentTransactionsListProps {
  transactions: FinanceTransaction[];
  isPrivacyHidden: boolean;
  onViewAll?: () => void;
  onSelectTransaction?: (tx: FinanceTransaction) => void;
}

export const RecentTransactionsList: React.FC<RecentTransactionsListProps> = ({
  transactions,
  isPrivacyHidden,
  onViewAll,
  onSelectTransaction,
}) => {
  const { colors, isDark } = useTheme();

  const formatBRL = (val: number) =>
    `R$ ${Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return 'Novembro';
      return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    } catch {
      return 'Recente';
    }
  };

  const cardBg = colors.surf;
  const cardBorder = colors.line;

  const displayList = transactions.slice(0, 5);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.headerRow}
        onPress={onViewAll}
        activeOpacity={0.7}
      >
        <View>
          <Text style={[styles.sectionTitle, { color: colors.ink }]}>Transações recentes</Text>
          <Text style={[styles.sectionSubtitle, { color: colors.muted }]}>
            {transactions.length > 0
              ? `${transactions.length} ${transactions.length === 1 ? 'última movimentação' : 'últimas movimentações'}`
              : 'Nenhuma movimentação ainda'}
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
      </TouchableOpacity>

      <View style={[styles.cardContainer, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        {displayList.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialIcons name="receipt-long" size={32} color={colors.muted} />
            <Text style={[styles.emptyText, { color: colors.muted }]}>
              As movimentações do seu banco aparecerão aqui assim que sincronizadas.
            </Text>
          </View>
        ) : (
          displayList.map((tx, idx) => {
            const isCredit = tx.amount > 0 || tx.transaction_type === 'CREDIT';
            return (
              <TouchableOpacity
                key={tx.id || tx.pluggy_transaction_id || `tx_${idx}`}
                style={[
                  styles.txRow,
                  idx > 0 && { borderTopWidth: 1, borderTopColor: colors.line },
                ]}
                onPress={() => onSelectTransaction?.(tx)}
                activeOpacity={0.7}
              >
                <View style={styles.txIconBox}>
                  <View style={[styles.txIconCircle, { backgroundColor: colors.bg }]}>
                    <MaterialIcons
                      name={isCredit ? 'arrow-downward' : 'shopping-bag'}
                      size={16}
                      color={isCredit ? '#10B981' : colors.ink}
                    />
                  </View>
                  <View style={[styles.nuTinyBadge, { borderColor: cardBg }]}>
                    <Text style={styles.nuTinyText}>nu</Text>
                  </View>
                </View>

                <View style={styles.txDetailsCol}>
                  <Text style={[styles.txDescription, { color: colors.ink }]} numberOfLines={1}>
                    {tx.clean_merchant_name || tx.description || 'Lançamento bancário'}
                  </Text>
                  <Text style={[styles.txMeta, { color: colors.muted }]}>
                    {formatDate(tx.occurred_at)} • {tx.category || 'Geral'}
                  </Text>
                </View>

                <View style={styles.txAmountCol}>
                  <Text
                    style={[
                      styles.txAmountText,
                      { color: isCredit ? '#10B981' : colors.ink },
                    ]}
                  >
                    {isPrivacyHidden ? '••••••' : `${isCredit ? '+' : '-'}${formatBRL(tx.amount)}`}
                  </Text>
                </View>
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
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 16,
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 1,
    fontWeight: '500',
  },
  cardContainer: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: 'hidden',
  },
  emptyBox: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 17,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  txIconBox: {
    position: 'relative',
    marginRight: 12,
  },
  txIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nuTinyBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#820AD1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nuTinyText: {
    color: '#FFFFFF',
    fontSize: 7,
    fontWeight: '800',
  },
  txDetailsCol: {
    flex: 1,
    marginRight: 10,
  },
  txDescription: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  txMeta: {
    fontSize: 11.5,
    marginTop: 2,
    fontWeight: '400',
  },
  txAmountCol: {
    alignItems: 'flex-end',
  },
  txAmountText: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 14.5,
    fontWeight: '700',
  },
});
