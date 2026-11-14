import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { FinanceAccount, FinanceSubScreenKey, FinancialSummary } from '../../types/finance';
import {
  buildFinScale,
  computeCreditCardStats,
  formatBRL,
  getCategoryAmount,
  hasSubscriptionIncrease,
  maskBRL,
} from './financeHelpers';

interface BentoMetricsGridProps {
  summary: FinancialSummary;
  accounts: FinanceAccount[];
  isPrivacyHidden: boolean;
  onOpenSubScreen: (key: FinanceSubScreenKey) => void;
  onPressSafeToSpend: () => void;
}

export const BentoMetricsGrid: React.FC<BentoMetricsGridProps> = ({
  summary,
  accounts,
  isPrivacyHidden,
  onOpenSubScreen,
  onPressSafeToSpend,
}) => {
  const { colors } = useTheme();
  const finScale = buildFinScale(colors.fin);

  const monthExpenses = summary.month_expenses ?? summary.monthly_spend_actual ?? 0;
  const monthIncome = summary.month_income ?? 0;
  const leftover = monthIncome - monthExpenses;
  const hasFlowData = monthIncome > 0 || monthExpenses > 0;

  const creditStats = computeCreditCardStats(accounts, summary);
  const subscriptionsTotal = summary.subscriptions.reduce((acc, s) => acc + (s.amount || 0), 0);
  const subscriptionsCount = summary.subscriptions.length;
  const priceIncreaseCount = summary.subscriptions.filter(hasSubscriptionIncrease).length;
  const categories = summary.category_spending.slice(0, 5);

  return (
    <View style={styles.gridContainer}>
      {/* Linha 1: Gastos do mês | Fluxo de caixa */}
      <View style={styles.gridRow}>
        <TouchableOpacity
          style={[styles.tile, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={() => onOpenSubScreen('spend')}
          activeOpacity={0.82}
        >
          <View style={styles.tileHeader}>
            <Text style={[styles.tileTitle, { color: colors.muted }]}>Gastos do mês</Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.tileValue, tabularNumbers, { color: colors.ink }]}>
            {maskBRL(isPrivacyHidden, formatBRL(monthExpenses))}
          </Text>
          <View style={styles.segmentedBar}>
            {categories.length > 0 ? (
              categories.map((cat, idx) => (
                <View
                  key={`${cat.category}_${idx}`}
                  style={[
                    styles.segmentedPiece,
                    {
                      flex: Math.max(1, getCategoryAmount(cat)),
                      backgroundColor: finScale[idx % finScale.length],
                    },
                  ]}
                />
              ))
            ) : (
              <View style={[styles.segmentedPiece, { flex: 1, backgroundColor: colors.line }]} />
            )}
          </View>
          <Text style={[styles.tileSub, { color: colors.muted }]}>
            {summary.category_spending.length}{' '}
            {summary.category_spending.length === 1 ? 'categoria' : 'categorias'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tile, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={() => onOpenSubScreen('flow')}
          activeOpacity={0.82}
        >
          <View style={styles.tileHeader}>
            <Text style={[styles.tileTitle, { color: colors.muted }]}>Fluxo de caixa</Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text
            style={[
              styles.tileValue,
              tabularNumbers,
              { color: leftover >= 0 ? colors.acc : colors.red },
            ]}
          >
            {isPrivacyHidden
              ? 'R$ ••••'
              : `${leftover >= 0 ? '+' : '−'}${formatBRL(leftover)}`}
          </Text>
          <View style={styles.segmentedBar}>
            {hasFlowData ? (
              <>
                {monthIncome > 0 && (
                  <View
                    style={[
                      styles.segmentedPiece,
                      { flex: monthIncome, backgroundColor: colors.acc },
                    ]}
                  />
                )}
                {monthExpenses > 0 && (
                  <View
                    style={[
                      styles.segmentedPiece,
                      { flex: monthExpenses, backgroundColor: colors.red },
                    ]}
                  />
                )}
              </>
            ) : (
              <View style={[styles.segmentedPiece, { flex: 1, backgroundColor: colors.line }]} />
            )}
          </View>
          <Text style={[styles.tileSub, { color: colors.muted }]}>
            {leftover >= 0 ? 'Sobra no mês' : 'Déficit no mês'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Linha 2: Fatura atual | Limite usado */}
      <View style={styles.gridRow}>
        <TouchableOpacity
          style={[styles.tile, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={() => onOpenSubScreen('card')}
          activeOpacity={0.82}
        >
          <View style={styles.tileHeader}>
            <View style={styles.cardBadgeRow}>
              {creditStats.primaryBrand ? (
                <View
                  style={[
                    styles.miniBrandAvatar,
                    { backgroundColor: creditStats.primaryBrand.color },
                  ]}
                >
                  <Text
                    style={[
                      styles.miniBrandText,
                      { color: creditStats.primaryBrand.textColor },
                    ]}
                  >
                    {creditStats.primaryBrand.initials}
                  </Text>
                </View>
              ) : (
                <MaterialIcons name="credit-card" size={16} color={colors.muted} />
              )}
              <Text style={[styles.tileTitle, { color: colors.muted }]}>
                {creditStats.creditAccounts.length > 0
                  ? `${creditStats.creditAccounts.length} ${
                      creditStats.creditAccounts.length === 1 ? 'cartão' : 'cartões'
                    }`
                  : 'Cartões'}
              </Text>
            </View>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.tileSub, { color: colors.muted, marginTop: 6 }]}>Fatura atual</Text>
          <Text style={[styles.tileValue, tabularNumbers, { color: colors.ink, marginTop: 2 }]}>
            {maskBRL(isPrivacyHidden, formatBRL(creditStats.totalBill))}
          </Text>
          <Text
            style={[
              styles.tileSub,
              {
                color: creditStats.hasBillAlert ? colors.orange : colors.muted,
                fontWeight: creditStats.hasBillAlert ? '600' : '500',
              },
            ]}
          >
            {creditStats.dueLabel}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tile, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={() => onOpenSubScreen('card')}
          activeOpacity={0.82}
        >
          <View style={styles.tileHeader}>
            <Text style={[styles.tileTitle, { color: colors.muted }]}>Limite usado</Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.tileValue, tabularNumbers, { color: colors.ink }]}>
            {maskBRL(isPrivacyHidden, formatBRL(creditStats.totalBill))}
          </Text>
          <View style={[styles.progressTrack, { backgroundColor: colors.line }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${creditStats.usedPercent}%`,
                  backgroundColor: colors.acc,
                },
              ]}
            />
          </View>
          <Text style={[styles.tileSub, { color: colors.muted }]}>
            {isPrivacyHidden
              ? 'Disp: R$ ••••'
              : `Disp: ${formatBRL(creditStats.totalAvailable)}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Linha 3: Assinaturas | Pode gastar hoje */}
      <View style={styles.gridRow}>
        <TouchableOpacity
          style={[styles.tile, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={() => onOpenSubScreen('sub')}
          activeOpacity={0.82}
        >
          <View style={styles.tileHeader}>
            <Text style={[styles.tileTitle, { color: colors.muted }]}>Assinaturas</Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.tileValue, tabularNumbers, { color: colors.ink }]}>
            {maskBRL(isPrivacyHidden, formatBRL(subscriptionsTotal))}
          </Text>
          <Text style={[styles.tileSub, { color: colors.muted }]}>
            {subscriptionsCount} {subscriptionsCount === 1 ? 'serviço' : 'serviços'}
            {priceIncreaseCount > 0 ? ` · ${priceIncreaseCount} reajuste` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tile, { backgroundColor: colors.bg, borderColor: colors.line }]}
          onPress={onPressSafeToSpend}
          activeOpacity={0.82}
        >
          <View style={styles.tileHeader}>
            <Text style={[styles.tileTitle, { color: colors.muted }]}>Pode gastar hoje</Text>
          </View>
          <Text style={[styles.tileValue, tabularNumbers, { color: colors.ink }]}>
            {maskBRL(isPrivacyHidden, formatBRL(summary.safe_to_spend_daily, 0))}
          </Text>
          <Text style={[styles.tileSub, { color: colors.muted }]}>
            por dia · {summary.days_remaining_in_month}d restantes
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    gap: 12,
    marginBottom: 14,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  tile: {
    flex: 1,
    minWidth: 0,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    justifyContent: 'space-between',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  tileTitle: {
    fontSize: 13.5,
    fontWeight: '600',
  },
  tileValue: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginTop: 8,
  },
  tileSub: {
    fontSize: 12.5,
    fontWeight: '500',
    marginTop: 8,
  },
  segmentedBar: {
    flexDirection: 'row',
    gap: 3,
    height: 6,
    marginTop: 12,
    borderRadius: 3,
    overflow: 'hidden',
  },
  segmentedPiece: {
    height: '100%',
    borderRadius: 3,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  miniBrandAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniBrandText: {
    fontSize: 9,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginTop: 10,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
});
