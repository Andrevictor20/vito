import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { PendingItem } from '../../../types';
import { formatScheduledDate } from '../../../utils/chatCards';

interface PendingInlineCardProps {
  pending: PendingItem;
}

export const PendingInlineCard: React.FC<PendingInlineCardProps> = ({ pending }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
      <View style={[styles.accentBar, { backgroundColor: colors.warning }]} />

      <View style={styles.topRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconBox, { backgroundColor: colors.surfaceContainerHighest }]}>
            <MaterialIcons name="inbox" size={18} color={colors.warning} />
          </View>
          <View style={styles.titleCol}>
            <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
              {pending.title}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {formatScheduledDate(pending.scheduled_date)} • Guardada nas Pendências
            </Text>
          </View>
        </View>

        <View style={[styles.categoryPill, { backgroundColor: colors.surfaceContainerHighest }]}>
          <Text style={[styles.categoryText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
            {pending.category || 'geral'}
          </Text>
        </View>
      </View>

      {pending.description ? (
        <Text style={[styles.description, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
          {pending.description}
        </Text>
      ) : null}
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
    alignItems: 'center',
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
    maxWidth: 96,
  },
  categoryText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.semibold,
  },
  description: {
    fontSize: tokens.typography.size.bodySmall,
    lineHeight: 18,
  },
});
