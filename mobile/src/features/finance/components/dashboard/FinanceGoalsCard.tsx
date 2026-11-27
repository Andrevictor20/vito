import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { ProtoUiIcon } from '../../../../icons/ProtoUiIcons';
import { tabularNumbers } from '../../../../theme/tokens';
import { useTheme } from '../../../../context/ThemeContext';
import { hapticFeedback } from '../../../../theme/motion';
import { AnimatedProgressBar, CountUpText } from '../../../../theme/vitoMotion';
import type { FinancialSummary } from '../../types/finance';
import { formatBRL, maskBRL, withHexAlpha } from '../../utils/financeHelpers';
import { CategorySemanticBadge, resolveCategoryVisual } from '../shared/FinanceSemanticIcons';

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
  const { colors, isDark } = useTheme();
  const goals = summary.goals || [];
  const budgets = summary.budgets || [];
  const mainGoal = goals[0];

  const goalPct =
    mainGoal && mainGoal.target_amount > 0
      ? Math.min(100, Math.round((mainGoal.current_amount / mainGoal.target_amount) * 100))
      : 0;

  const nearLimitCount = budgets.filter(
    (b) => b.target_amount > 0 && b.used_amount / b.target_amount >= 0.85
  ).length;

  const fallbackPct = Math.min(100, Math.max(0, Math.round(summary.pace_percent || 0)));
  const barPct = mainGoal
    ? goalPct
    : budgets.length > 0
      ? Math.min(100, Math.round((budgets[0].used_amount / Math.max(1, budgets[0].target_amount)) * 100))
      : fallbackPct;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: colors.surf }]}
      onPress={() => {
        hapticFeedback.light();
        onPress();
      }}
      activeOpacity={0.82}
      accessibilityLabel="Abrir metas e orçamentos"
    >
      <View style={styles.topRow}>
        <View style={styles.ttlRow}>
          <View style={[styles.fxIc, { backgroundColor: withHexAlpha(colors.blue, 0.14) }]}>
            <ProtoUiIcon name="check-circle" size={18} color={colors.blue} />
          </View>
          <Text style={[styles.title, { color: colors.ink }]}>Metas e orçamentos</Text>
        </View>
        <ProtoUiIcon name="chevron-right" size={16} color={colors.muted} />
      </View>

      <View style={styles.glRow}>
        <Text style={[styles.glName, { color: colors.ink }]} numberOfLines={1}>
          {mainGoal
            ? mainGoal.title
            : budgets.length > 0
              ? budgets[0].title
              : 'Ritmo de gastos no mês'}
        </Text>
        <CountUpText
          value={barPct}
          suffix="%"
          privacyHidden={isPrivacyHidden}
          maskedText="••%"
          style={[styles.glPct, tabularNumbers, { color: colors.blue }]}
        />
      </View>

      <AnimatedProgressBar
        pct={isPrivacyHidden ? 0 : barPct}
        color={colors.ink}
        trackColor={withHexAlpha(colors.ink, 0.09)}
        height={8}
        delayMs={240}
        style={{ marginTop: 10 }}
      />

      <Text style={[styles.goalMeta, tabularNumbers, { color: colors.muted }]}>
        {mainGoal
          ? `${maskBRL(isPrivacyHidden, formatBRL(mainGoal.current_amount, 0))} de ${maskBRL(isPrivacyHidden, formatBRL(mainGoal.target_amount, 0))}`
          : 'Toque para acompanhar limites por categoria e metas'}
      </Text>

      {budgets.length > 0 && (
        <>
          <View style={styles.budHead}>
            <Text style={[styles.budHeadLabel, { color: colors.muted }]}>Orçamentos do mês</Text>
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor: withHexAlpha(
                    nearLimitCount > 0 ? colors.orange : colors.acc,
                    0.14
                  ),
                },
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  { color: nearLimitCount > 0 ? colors.orange : colors.acc },
                ]}
              >
                {nearLimitCount > 0 ? `${nearLimitCount} perto do limite` : 'Tudo em dia'}
              </Text>
            </View>
          </View>

          <View style={[styles.budList, { borderTopColor: withHexAlpha(colors.ink, 0.08) }]}>
            {budgets.slice(0, 4).map((b, idx) => {
              const ratio = b.target_amount > 0 ? b.used_amount / b.target_amount : 0;
              const pct = Math.min(100, Math.round(ratio * 100));
              const isHot = ratio >= 0.85;
              const catVis = resolveCategoryVisual(b.title, isDark, idx);
              const barColor = ratio >= 1 ? colors.red : isHot ? colors.orange : catVis.color;
              const left = b.target_amount - b.used_amount;

              return (
                <View key={b.id || `bud_${idx}`} style={styles.budRow}>
                  <CategorySemanticBadge category={b.title} isDark={isDark} index={idx} size={28} />
                  <View style={styles.budBody}>
                    <View style={styles.budTop}>
                      <Text style={[styles.budTitle, { color: colors.ink }]} numberOfLines={1}>
                        {b.title}
                      </Text>
                      <CountUpText
                        value={pct}
                        suffix="%"
                        delayMs={200 + idx * 70}
                        privacyHidden={isPrivacyHidden}
                        maskedText="••%"
                        style={[
                          styles.budPct,
                          tabularNumbers,
                          { color: isHot ? barColor : colors.muted },
                        ]}
                      />
                    </View>
                    <AnimatedProgressBar
                      pct={isPrivacyHidden ? 0 : pct}
                      color={barColor}
                      trackColor={withHexAlpha(colors.ink, 0.09)}
                      height={6}
                      delayMs={260 + idx * 80}
                    />
                    <Text style={[styles.budSub, tabularNumbers, { color: colors.muted }]}>
                      {left >= 0
                        ? `Faltam ${maskBRL(isPrivacyHidden, formatBRL(left, 0))}`
                        : `Passou ${maskBRL(isPrivacyHidden, formatBRL(-left, 0))}`}{' '}
                      de {maskBRL(isPrivacyHidden, formatBRL(b.target_amount, 0))}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 16,
    marginTop: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ttlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fxIc: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: 'Geist_500Medium',
    fontSize: 16,
    letterSpacing: -0.2,
  },
  glRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 14,
    gap: 8,
  },
  glName: {
    flex: 1,
    fontFamily: 'Geist',
    fontSize: 14.5,
  },
  glPct: {
    fontFamily: 'Geist_500Medium',
    fontSize: 14.5,
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
  goalMeta: {
    fontFamily: 'Geist',
    fontSize: 12.5,
    marginTop: 8,
  },
  budHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
  },
  budHeadLabel: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPillText: {
    fontFamily: 'Geist_500Medium',
    fontSize: 12,
  },
  budList: {
    gap: 12,
    marginTop: 12,
    paddingTop: 14,
    borderTopWidth: 1,
  },
  budRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  budIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  budBody: {
    flex: 1,
    minWidth: 0,
  },
  budTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  budTitle: {
    fontFamily: 'Geist',
    fontSize: 13.5,
  },
  budPct: {
    fontFamily: 'Geist_500Medium',
    fontSize: 13,
  },
  budTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  budFill: {
    height: '100%',
    borderRadius: 3,
  },
  budSub: {
    fontFamily: 'Geist',
    fontSize: 12,
    marginTop: 4,
  },
});
