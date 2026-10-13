import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { TRIGGER_CATEGORIES, Trigger } from '../../../types';
import { formatTriggerSchedule } from '../../../utils/chatCards';

interface TriggerInlineCardProps {
  trigger: Trigger;
}

export const TriggerInlineCard: React.FC<TriggerInlineCardProps> = ({ trigger }) => {
  const { colors } = useTheme();
  const categoryLabel =
    TRIGGER_CATEGORIES.find((c) => c.id === trigger.category)?.label ?? 'Radar';

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
      <View style={[styles.accentBar, { backgroundColor: colors.success }]} />

      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceContainerHighest }]}>
            <MaterialIcons name="track-changes" size={18} color={colors.success} />
          </View>
          <View style={styles.titleCol}>
            <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
              {trigger.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
              {trigger.query}
            </Text>
          </View>
        </View>

        <View style={[styles.categoryPill, { backgroundColor: colors.surfaceContainerHighest }]}>
          <Text style={[styles.categoryText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
            {categoryLabel}
          </Text>
        </View>
      </View>

      <View style={[styles.scheduleRow, { backgroundColor: colors.surfaceContainerLowest }]}>
        <MaterialIcons name="schedule" size={14} color={colors.onSurfaceVariant} />
        <Text style={[styles.scheduleText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
          {formatTriggerSchedule(trigger.frequency, trigger.scheduled_time)}
        </Text>
        {trigger.target_value ? (
          <Text style={[styles.targetText, { color: colors.onSurface }]} numberOfLines={1}>
            · {trigger.target_value}
          </Text>
        ) : null}
      </View>

      <View style={styles.activeRow}>
        <MaterialIcons name="radar" size={13} color={colors.success} style={{ marginRight: 4 }} />
        <Text style={[styles.activeText, { color: colors.success }]}>Radar ativo no Vito</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceContainerHigh,
    borderRadius: MD3Shapes.large,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
    gap: tokens.spacing.sm,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: MD3Shapes.small,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
  },
  title: {
    color: tokens.colors.onSurface,
    fontSize: tokens.typography.size.titleSmall,
    fontWeight: tokens.typography.weight.semibold,
  },
  subtitle: {
    color: tokens.colors.onSurfaceVariant,
    fontSize: tokens.typography.size.labelSmall,
    marginTop: 1,
  },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
    maxWidth: 110,
  },
  categoryText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.semibold,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: MD3Shapes.small,
  },
  scheduleText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.medium,
    flexShrink: 1,
  },
  targetText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.semibold,
    flexShrink: 1,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activeText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
