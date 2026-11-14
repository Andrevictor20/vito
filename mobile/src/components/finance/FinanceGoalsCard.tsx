import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import type { FinancialSummary } from '../../types/finance';
import { maskBRL } from './financeHelpers';

interface FinanceGoalsCardProps {
  summary: FinancialSummary;
  isPrivacyHidden: boolean;
  onPress: () => void;
}

export const FinanceGoalsCard: React.FC<FinanceGoalsCardProps> = ({
  summary,
  isPrivacyHidden,
  onPress,
}) => {
  const { colors } = useTheme();
  const goals = summary.goals || [];
  const budgets = summary.budgets || [];
  const mainGoal = goals[0];

  const goalPct =
    mainGoal && mainGoal.target_amount > 0
      ? Math.min(100, Math.round((mainGoal.current_amount / mainGoal.target_amount) * 100))
      : 0;

  const nearLimitCount = budgets.filter(
    (b) => b.target_amount > 0 && b.used_amount / b.target_amount >= 0.8
  ).length;

  const hasItems = goals.length > 0 || budgets.length > 0;
  const fallbackPct = Math.min(100, Math.max(0, Math.round(summary.pace_percent || 0)));
  const barPct = mainGoal ? goalPct : budgets.length > 0 ? Math.min(100, Math.round((budgets[0].used_amount / Math.max(1, budgets[0].target_amount)) * 100)) : fallbackPct;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.bg, borderColor: colors.line }]}
      onPress={() => {
        hapticFeedback.light();
        onPress();
      }}
      activeOpacity={0.82}
      accessibilityLabel="Abrir metas e orçamentos"
    >
      <View style={styles.topRow}>
        <Text style={[styles.title, { color: colors.ink }]}>Metas e orçamentos</Text>
        <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
      </View>

      <Text style={[styles.subtitle, { color: colors.muted }]}>
        {mainGoal
          ? `${mainGoal.title} · ${isPrivacyHidden ? '••%' : `${goalPct}%`}`
          : budgets.length > 0
            ? `${budgets[0].title} · ${isPrivacyHidden ? '••%' : `${barPct}%`}`
            : summary.category_spending.length > 0
              ? `Ritmo de gastos no mês · ${isPrivacyHidden ? maskBRL(true, '') : `${fallbackPct}%`}`
              : 'Defina tetos de gasto e metas de economia'}
      </Text>

      <View style={[styles.progressTrack, { backgroundColor: colors.line }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${isPrivacyHidden ? 0 : barPct}%`,
              backgroundColor: colors.fin,
            },
          ]}
        />
      </View>

      <Text style={[styles.footerMeta, { color: colors.muted }]}>
        {hasItems
          ? `${budgets.length} ${budgets.length === 1 ? 'orçamento ativo' : 'orçamentos ativos'} · ${nearLimitCount} perto do limite`
          : 'Toque para acompanhar limites por categoria e metas'}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 15.5,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 12.5,
    marginTop: 10,
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
  footerMeta: {
    fontSize: 12,
    marginTop: 8,
  },
});
