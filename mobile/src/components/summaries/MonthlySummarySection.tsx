import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';

interface MonthlyMetrics {
  totalHours: string;
  totalEvents: number;
  totalTodos: number;
  completionRate: number;
  workRatio: number;
  personalRatio: number;
}

interface MonthlySummarySectionProps {
  metrics: MonthlyMetrics;
  diagnosisText: string;
  onOpenRaioX: () => void;
}

export const MonthlySummarySection: React.FC<MonthlySummarySectionProps> = ({
  metrics,
  diagnosisText,
  onOpenRaioX,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.bentoGrid}>
      <TouchableOpacity
        style={[
          styles.bentoCard,
          styles.bentoCardSpan2,
          {
            backgroundColor: colors.surfaceContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
        onPress={() => {
          hapticFeedback.selection();
          onOpenRaioX();
        }}
        activeOpacity={0.8}
      >
        <View style={styles.bentoHeader}>
          <Text style={[styles.bentoTag, { color: colors.primary }]}>EFICÁCIA MENSAL</Text>
          <MaterialIcons name="trending-up" size={16} color={colors.textMuted} />
        </View>

        <View style={styles.heroNumbersRow}>
          <View style={styles.heroNumberBlock}>
            <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.onSurface }]}>
              {metrics.completionRate}%
            </Text>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
              Taxa de resolução
            </Text>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroNumberBlock}>
            <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.primary }]}>
              {metrics.totalHours}h
            </Text>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
              Em compromissos
            </Text>
          </View>
        </View>

        <View style={[styles.cardClickHintRow, { borderTopColor: colors.outlineVariant }]}>
          <Text style={[styles.cardClickHintText, { color: colors.primary }]}>
            Toque para abrir o Raio-X
          </Text>
          <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
        </View>
      </TouchableOpacity>

      <View
        style={[
          styles.bentoCard,
          styles.bentoCardSpan2,
          {
            backgroundColor: colors.surfaceContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.bentoHeader}>
          <View style={styles.synthesisHeaderBadge}>
            <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
            <Text style={[styles.bentoTag, { color: colors.primary }]}>DIAGNÓSTICO</Text>
          </View>
        </View>

        <Text style={[styles.synthesisBodyText, { color: colors.onSurface }]}>
          {diagnosisText}
        </Text>
      </View>

      <View
        style={[
          styles.bentoCard,
          styles.bentoCardSpan2,
          {
            backgroundColor: colors.surfaceContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.bentoHeader}>
          <Text style={[styles.bentoTag, { color: colors.primary }]}>
            EQUILÍBRIO DE VIDA
          </Text>
          <MaterialIcons name="pie-chart" size={16} color={colors.textMuted} />
        </View>

        <View style={styles.balanceBarContainer}>
          <View
            style={[
              styles.balanceBarSegment,
              { width: `${metrics.workRatio}%`, backgroundColor: colors.primary },
            ]}
          />
          <View
            style={[
              styles.balanceBarSegment,
              { width: `${metrics.personalRatio}%`, backgroundColor: '#10B981' },
            ]}
          />
        </View>

        <View style={styles.balanceLegendRow}>
          <View style={styles.balanceLegendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.balanceLegendText, { color: colors.onSurface }]}>
              Trabalho ({metrics.workRatio}%)
            </Text>
          </View>
          <View style={styles.balanceLegendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#10B981' }]} />
            <Text style={[styles.balanceLegendText, { color: colors.onSurface }]}>
              Pessoal ({metrics.personalRatio}%)
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.sm,
  },
  bentoCard: {
    width: '48.5%',
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 8,
  },
  bentoCardSpan2: {
    width: '100%',
  },
  bentoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bentoTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  heroNumbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  heroNumberBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroBigNumber: {
    fontSize: 28,
    fontWeight: '700',
  },
  heroLabel: {
    fontSize: 12,
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(128,128,128,0.2)',
  },
  cardClickHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  cardClickHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
  synthesisHeaderBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  synthesisBodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  balanceBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    flexDirection: 'row',
    marginVertical: 8,
  },
  balanceBarSegment: {
    height: '100%',
  },
  balanceLegendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  balanceLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  balanceLegendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
