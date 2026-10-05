import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../../theme/tokens';
import { useTheme } from '../../../context/ThemeContext';
import { ConflictInfo } from '../../../types';

interface ConflictInlineCardProps {
  conflict: ConflictInfo;
  onPressAdjust?: () => void;
  onSelectSlot?: (slot: import('../../../types').TimeSlot) => void;
}

export const ConflictInlineCard: React.FC<ConflictInlineCardProps> = ({ conflict, onPressAdjust, onSelectSlot }) => {
  const { colors } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainerHigh, borderColor: colors.outlineVariant }]}>
      <View style={[styles.accentBar, { backgroundColor: colors.error }]} />

      <View style={styles.contentRow}>
        <View style={styles.leftGroup}>
          <View style={[styles.iconBox, { backgroundColor: colors.errorContainer }]}>
            <MaterialIcons name="warning" size={17} color={colors.onErrorContainer} />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={1}>
              {conflict.conflicting_title || 'Conflito de Agenda'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.error }]} numberOfLines={2}>
              {conflict.message || 'Atenção: Horário sobreposto com outro compromisso'}
            </Text>
          </View>
        </View>

        {onPressAdjust && (
          <TouchableOpacity
            style={[styles.adjustBtn, { backgroundColor: colors.surfaceContainerHighest }]}
            onPress={onPressAdjust}
            activeOpacity={0.8}
          >
            <Text style={[styles.adjustBtnText, { color: colors.onSurface }]}>Ajustar</Text>
          </TouchableOpacity>
        )}
      </View>

      {conflict.suggested_slots && conflict.suggested_slots.length > 0 && (
        <View style={styles.slotsSection}>
          <Text style={[styles.slotsHeader, { color: colors.onSurfaceVariant }]}>
            Sugestões de horário livre:
          </Text>
          <View style={styles.slotsRow}>
            {conflict.suggested_slots.map((slot, idx) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.slotChip,
                  { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant },
                ]}
                onPress={() => onSelectSlot?.(slot)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="schedule" size={13} color={colors.primary} />
                <Text style={[styles.slotChipText, { color: colors.onSurface }]}>
                  {slot.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: MD3Shapes.medium,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.xs,
    position: 'relative',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: tokens.colors.outlineVariant,
  },
  accentBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: tokens.colors.error,
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  leftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    flex: 1,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: MD3Shapes.small,
    backgroundColor: tokens.colors.errorContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
  },
  title: {
    color: tokens.colors.onSurface,
    fontSize: tokens.typography.size.titleSmall,
    fontWeight: tokens.typography.weight.semibold,
  },
  subtitle: {
    color: tokens.colors.error,
    fontSize: tokens.typography.size.labelSmall,
    marginTop: 1,
    fontWeight: tokens.typography.weight.medium,
  },
  adjustBtn: {
    backgroundColor: tokens.colors.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: MD3Shapes.full,
  },
  adjustBtnText: {
    color: tokens.colors.onSecondaryContainer,
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: tokens.typography.weight.semibold,
  },
  slotsSection: {
    marginTop: tokens.spacing.sm,
    paddingTop: tokens.spacing.xs + 2,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  slotsHeader: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.medium,
    marginBottom: tokens.spacing.xs,
  },
  slotsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
  },
  slotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: MD3Shapes.small,
    borderWidth: 1,
  },
  slotChipText: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
  },
});
