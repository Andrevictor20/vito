import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { WeeklySummaryItem } from '../../utils/weeklySummaryCalculator';

interface WeeklySummarySectionProps {
  summaries: WeeklySummaryItem[];
  onSelectWeek: (item: WeeklySummaryItem) => void;
}

export const WeeklySummarySection: React.FC<WeeklySummarySectionProps> = ({
  summaries,
  onSelectWeek,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.weeklyList}>
      {summaries.map((item) => (
        <TouchableOpacity
          key={item.id}
          style={[
            styles.weeklyCard,
            {
              backgroundColor: colors.surfaceContainer,
              borderColor: colors.outlineVariant,
            },
          ]}
          onPress={() => {
            hapticFeedback.selection();
            onSelectWeek(item);
          }}
          activeOpacity={0.75}
        >
          <View style={styles.weeklyCardHeader}>
            <Text style={[styles.weeklyRange, { color: colors.onSurface }]}>
              {item.isCurrentWeek ? `Ciclo Atual · ${item.period}` : item.period}
            </Text>
            {item.isCurrentWeek && (
              <View
                style={[
                  styles.currentBadge,
                  { backgroundColor: colors.surfaceContainerHighest },
                ]}
              >
                <Text style={[styles.currentBadgeText, { color: colors.primary }]}>
                  EM ANDAMENTO
                </Text>
              </View>
            )}
          </View>

          <Text style={[styles.weeklyTheme, { color: colors.textMuted }]}>
            {item.title}
          </Text>

          <View style={[styles.cardAiSnippet, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
            <View style={styles.snippetHeaderRow}>
              <MaterialIcons name="auto-awesome" size={13} color={colors.primary} />
              <Text style={[styles.snippetTag, { color: colors.primary }]}>ANÁLISE DE IA</Text>
            </View>
            <Text style={[styles.snippetText, { color: colors.onSurface }]} numberOfLines={2}>
              {item.narrative}
            </Text>
          </View>

          <View style={styles.weeklyStatsRow}>
            <View style={styles.weeklyStat}>
              <Text style={[styles.weeklyStatVal, tabularNumbers, { color: colors.onSurface }]}>
                {item.hours}h
              </Text>
              <Text style={[styles.weeklyStatLbl, { color: colors.textMuted }]}>Horas</Text>
            </View>

            <View style={styles.weeklyStat}>
              <Text style={[styles.weeklyStatVal, tabularNumbers, { color: colors.onSurface }]}>
                {item.eventsCount}
              </Text>
              <Text style={[styles.weeklyStatLbl, { color: colors.textMuted }]}>Eventos</Text>
            </View>

            <View style={styles.weeklyStat}>
              <Text style={[styles.weeklyStatVal, tabularNumbers, { color: colors.onSurface }]}>
                {item.completedTodosCount}
              </Text>
              <Text style={[styles.weeklyStatLbl, { color: colors.textMuted }]}>Tarefas</Text>
            </View>
          </View>

          <View style={[styles.cardClickHintRow, { borderTopColor: colors.outlineVariant }]}>
            <Text style={[styles.cardClickHintText, { color: colors.primary }]}>
              Toque para abrir o Raio-X
            </Text>
            <MaterialIcons name="chevron-right" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  weeklyList: {
    gap: 12,
  },
  weeklyCard: {
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 8,
  },
  weeklyCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  weeklyRange: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  currentBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: MD3Shapes.extraSmall,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  weeklyTheme: {
    fontSize: 13,
  },
  cardAiSnippet: {
    padding: 8,
    borderRadius: MD3Shapes.small,
    marginVertical: 4,
    gap: 4,
  },
  snippetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  snippetTag: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  snippetText: {
    fontSize: 12,
    lineHeight: 16,
  },
  weeklyStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(128,128,128,0.2)',
  },
  weeklyStat: {
    alignItems: 'center',
  },
  weeklyStatVal: {
    fontSize: 16,
    fontWeight: '600',
  },
  weeklyStatLbl: {
    fontSize: 11,
    marginTop: 2,
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
});
