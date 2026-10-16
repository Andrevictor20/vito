import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface TodayMetrics {
  eventsCount: number;
  committedHours: string;
  freeHours: string;
  totalTodos: number;
  completedTodos: number;
}

interface DailySummarySectionProps {
  metrics: TodayMetrics;
  hasFreeWindow: boolean;
  synthesisText: string;
}

export const DailySummarySection: React.FC<DailySummarySectionProps> = ({
  metrics,
  hasFreeWindow,
  synthesisText,
}) => {
  const { colors } = useTheme();

  return (
    <View style={styles.bentoGrid}>
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
          <Text style={[styles.bentoTag, { color: colors.primary }]}>CARGA DO DIA</Text>
          <MaterialIcons name="schedule" size={16} color={colors.textMuted} />
        </View>

        <View style={styles.heroNumbersRow}>
          <View style={styles.heroNumberBlock}>
            <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.onSurface }]}>
              {metrics.committedHours}h
            </Text>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
              Comprometidas
            </Text>
          </View>

          <View style={styles.heroDivider} />

          <View style={styles.heroNumberBlock}>
            <Text style={[styles.heroBigNumber, tabularNumbers, { color: colors.primary }]}>
              {metrics.freeHours}h
            </Text>
            <Text style={[styles.heroLabel, { color: colors.textMuted }]}>
              Blocos livres
            </Text>
            {hasFreeWindow && (
              <View
                style={[
                  styles.focusBadge,
                  { backgroundColor: colors.surfaceContainerHighest },
                ]}
              >
                <MaterialIcons name="center-focus-strong" size={12} color={colors.primary} />
                <Text style={[styles.focusBadgeText, { color: colors.primary }]}>
                  JANELA FOCO LIVRE
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View
        style={[
          styles.bentoCard,
          {
            backgroundColor: colors.surfaceContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.bentoHeader}>
          <Text style={[styles.bentoTag, { color: colors.primary }]}>AGENDA</Text>
          <MaterialIcons name="event" size={16} color={colors.textMuted} />
        </View>
        <Text style={[styles.cardValue, tabularNumbers, { color: colors.onSurface }]}>
          {metrics.eventsCount}
        </Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
          {metrics.eventsCount === 1 ? 'Compromisso hoje' : 'Compromissos hoje'}
        </Text>
      </View>

      <View
        style={[
          styles.bentoCard,
          {
            backgroundColor: colors.surfaceContainer,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.bentoHeader}>
          <Text style={[styles.bentoTag, { color: colors.primary }]}>TAREFAS</Text>
          <MaterialIcons name="check-circle-outline" size={16} color={colors.textMuted} />
        </View>
        <Text style={[styles.cardValue, tabularNumbers, { color: colors.onSurface }]}>
          {metrics.completedTodos}/{metrics.totalTodos}
        </Text>
        <Text style={[styles.cardSubtitle, { color: colors.textMuted }]}>
          Finalizadas no dia
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
          <View style={styles.synthesisHeaderBadge}>
            <MaterialIcons name="auto-awesome" size={15} color={colors.primary} />
            <Text style={[styles.bentoTag, { color: colors.primary }]}>SÍNTESE EXECUTIVA</Text>
          </View>
        </View>

        <Text style={[styles.synthesisBodyText, { color: colors.onSurface }]}>
          {synthesisText}
        </Text>
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
  focusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  focusBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  cardValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  cardSubtitle: {
    fontSize: 12,
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
});
