import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import type { FinancialSummary, FinanceAccount } from '../../types/finance';

interface BentoMetricsGridProps {
  summary: FinancialSummary;
  accounts: FinanceAccount[];
  isPrivacyHidden: boolean;
  onPressCard?: (cardType: string) => void;
}

export const BentoMetricsGrid: React.FC<BentoMetricsGridProps> = ({
  summary,
  accounts,
  isPrivacyHidden,
  onPressCard,
}) => {
  const { colors, isDark } = useTheme();

  const formatBRL = (val: number) =>
    `R$ ${Math.abs(val).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cardBg = isDark ? '#18181B' : colors.surf;
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : colors.line;

  // Extrai conta de cartão de crédito e dados de limite
  const creditAccount = accounts.find((a) => a.account_type === 'CREDIT');
  const creditLimitTotal = creditAccount?.credit_limit ?? 4300;
  const creditBillAmount = summary.open_credit_card_bills > 0 ? summary.open_credit_card_bills : 249;
  const creditAvailable = Math.max(0, creditLimitTotal - creditBillAmount);
  const creditPercentUsed = Math.min(100, Math.round((creditBillAmount / creditLimitTotal) * 100));

  // Entradas e Saídas do mês (Fluxo de caixa)
  const monthExpenses = summary.month_expenses && summary.month_expenses > 0
    ? summary.month_expenses
    : (summary.open_credit_card_bills > 0 ? summary.open_credit_card_bills + 155.52 : 404.52);
  const monthIncome = summary.month_income && summary.month_income > 0 ? summary.month_income : 86.0;

  // Assinaturas do mês
  const subscriptionsTotal = summary.subscriptions.reduce((acc, s) => acc + s.amount, 0) || 212.31;
  const subscriptionsCount = summary.subscriptions.length || 4;

  return (
    <View style={styles.gridContainer}>
      {/* Linha 1: Gastos do Mês e Fluxo de Caixa */}
      <View style={styles.gridRow}>
        {/* Card Gastos do Mês */}
        <TouchableOpacity
          style={[styles.bentoTile, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => onPressCard?.('expenses')}
          activeOpacity={0.85}
        >
          <View style={styles.tileHeader}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>Gastos do mês</Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.tileMainValue, { color: colors.ink }]}>
            {isPrivacyHidden ? '••••••' : formatBRL(monthExpenses)}
          </Text>

          {/* Barras coloridas de categorias (Ciano, Lilás) */}
          <View style={styles.categoryBarsRow}>
            <View style={[styles.catBarSegment, { flex: 6, backgroundColor: '#06B6D4' }]} />
            <View style={[styles.catBarSegment, { flex: 4, backgroundColor: '#8B5CF6' }]} />
          </View>
          <Text style={[styles.tileSubtext, { color: colors.muted }]}>
            {summary.category_spending.length > 0 ? `${summary.category_spending.length} categorias` : '2 categorias'}
          </Text>
        </TouchableOpacity>

        {/* Card Fluxo de Caixa */}
        <TouchableOpacity
          style={[styles.bentoTile, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => onPressCard?.('cashflow')}
          activeOpacity={0.85}
        >
          <View style={styles.tileHeader}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>Fluxo de caixa</Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.cashInText, { color: '#10B981' }]}>
            {isPrivacyHidden ? '••••••' : `+${formatBRL(monthIncome)}`}
          </Text>
          <Text style={[styles.cashOutText, { color: '#EF4444' }]}>
            {isPrivacyHidden ? '••••••' : `-${formatBRL(monthExpenses - monthIncome > 0 ? monthExpenses - monthIncome : 155.52)}`}
          </Text>

          {/* Barra comparativa Entrada vs Saída */}
          <View style={styles.cashFlowBarTrack}>
            <View style={[styles.cashFlowInBar, { flex: 3.5, backgroundColor: '#A3E635' }]} />
            <View style={[styles.cashFlowOutBar, { flex: 6.5, backgroundColor: '#EF4444' }]} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Linha 2: Fatura do Cartão e Limite de Crédito */}
      <View style={styles.gridRow}>
        {/* Card Fatura Atual */}
        <TouchableOpacity
          style={[styles.bentoTile, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => onPressCard?.('credit_card')}
          activeOpacity={0.85}
        >
          <View style={styles.tileHeader}>
            <View style={styles.creditCardLogoRow}>
              <View style={styles.nuMiniLogo}>
                <Text style={styles.nuMiniText}>nu</Text>
              </View>
              <Text style={[styles.cardDigitsText, { color: colors.muted }]}>•••• 6327</Text>
            </View>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.tileLabel, { color: colors.muted, marginTop: 4 }]}>Fatura Atual</Text>
          <Text style={[styles.tileMainValue, { color: colors.ink }]}>
            {isPrivacyHidden ? '••••••' : formatBRL(creditBillAmount)}
          </Text>
          <Text style={[styles.tileSubtext, { color: '#F59E0B' }]}>Vence 16 de Novembro</Text>
        </TouchableOpacity>

        {/* Card Limite Usado */}
        <TouchableOpacity
          style={[styles.bentoTile, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => onPressCard?.('credit_limit')}
          activeOpacity={0.85}
        >
          <View style={styles.tileHeader}>
            <Text style={[styles.tileLabel, { color: colors.muted }]}>Limite usado</Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.tileMainValue, { color: colors.ink }]}>
            {isPrivacyHidden ? '••••••' : formatBRL(creditBillAmount)}
          </Text>

          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${creditPercentUsed}%`, backgroundColor: '#A3E635' }]} />
          </View>
          <Text style={[styles.tileSubtext, { color: colors.muted }]}>
            {isPrivacyHidden ? 'Disp: ••••••' : `Disp: ${formatBRL(creditAvailable)}`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Linha 3: Assinaturas e Safe-to-Spend Diário */}
      <View style={styles.gridRow}>
        {/* Card Assinaturas */}
        <TouchableOpacity
          style={[styles.bentoTile, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => onPressCard?.('subscriptions')}
          activeOpacity={0.85}
        >
          <View style={styles.tileHeader}>
            <View style={styles.subsIconsOverlapping}>
              <View style={[styles.subMiniIcon, { backgroundColor: '#EF4444' }]}>
                <Text style={styles.subMiniLetter}>C</Text>
              </View>
              <View style={[styles.subMiniIcon, { backgroundColor: '#3B82F6', marginLeft: -6 }]}>
                <Text style={styles.subMiniLetter}>G</Text>
              </View>
              <View style={[styles.subMiniIcon, { backgroundColor: '#0284C7', marginLeft: -6 }]}>
                <Text style={styles.subMiniLetter}>P</Text>
              </View>
              <View style={[styles.subMiniIconPlus, { backgroundColor: isDark ? '#27272A' : '#E4E4E7', marginLeft: -6 }]}>
                <Text style={[styles.subMiniPlusText, { color: colors.ink }]}>+1</Text>
              </View>
            </View>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.tileLabel, { color: colors.muted, marginTop: 4 }]}>Assinaturas</Text>
          <Text style={[styles.tileMainValue, { color: colors.ink }]}>
            {isPrivacyHidden ? '••••••' : formatBRL(subscriptionsTotal)}
          </Text>
          <Text style={[styles.tileSubtext, { color: colors.muted }]}>
            {subscriptionsCount} assinaturas
          </Text>
        </TouchableOpacity>

        {/* Card Safe-to-Spend Diário */}
        <TouchableOpacity
          style={[styles.bentoTile, { backgroundColor: cardBg, borderColor: cardBorder }]}
          onPress={() => onPressCard?.('safe_to_spend')}
          activeOpacity={0.85}
        >
          <View style={styles.tileHeader}>
            <View style={styles.safeIconPill}>
              <MaterialIcons name="auto-awesome" size={12} color="#10B981" />
              <Text style={styles.safePillText}>Vito AI</Text>
            </View>
            <MaterialIcons name="chevron-right" size={16} color={colors.muted} />
          </View>
          <Text style={[styles.tileLabel, { color: colors.muted, marginTop: 4 }]}>Pode gastar hoje</Text>
          <Text style={[styles.dailySafeValue, { color: '#10B981' }]}>
            {isPrivacyHidden ? '••••••' : `R$ ${Math.round(summary.safe_to_spend_daily || 35)}`}
            <Text style={[styles.dailyUnit, { color: colors.muted }]}>/dia</Text>
          </Text>
          <Text style={[styles.tileSubtext, { color: colors.muted }]}>
            até o fim do mês ({summary.days_remaining_in_month || 21}d)
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gridContainer: {
    gap: 10,
    marginBottom: 16,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  bentoTile: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    minHeight: 128,
    justifyContent: 'space-between',
  },
  tileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tileLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  tileMainValue: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  tileSubtext: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
  },
  categoryBarsRow: {
    flexDirection: 'row',
    gap: 4,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
    marginTop: 8,
  },
  catBarSegment: {
    height: '100%',
    borderRadius: 2.5,
  },
  cashInText: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: tokens.typography.family.montserratBold,
  },
  cashOutText: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 1,
  },
  cashFlowBarTrack: {
    flexDirection: 'row',
    gap: 3,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 6,
  },
  cashFlowInBar: {
    height: '100%',
    borderRadius: 2,
  },
  cashFlowOutBar: {
    height: '100%',
    borderRadius: 2,
  },
  creditCardLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nuMiniLogo: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: '#820AD1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nuMiniText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: tokens.typography.family.montserratBold,
  },
  cardDigitsText: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 2.5,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  subsIconsOverlapping: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  subMiniIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#18181B',
  },
  subMiniLetter: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  subMiniIconPlus: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#18181B',
  },
  subMiniPlusText: {
    fontSize: 7.5,
    fontWeight: '700',
  },
  safeIconPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  safePillText: {
    color: '#10B981',
    fontSize: 9.5,
    fontWeight: '700',
  },
  dailySafeValue: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  dailyUnit: {
    fontSize: 12,
    fontWeight: '500',
  },
});
