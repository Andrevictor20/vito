import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../../theme/tokens';
import { ConflictInfo } from '../../../types';

interface ConflictInlineCardProps {
  conflict: ConflictInfo;
  onPressAdjust?: () => void;
}

export const ConflictInlineCard: React.FC<ConflictInlineCardProps> = ({ conflict, onPressAdjust }) => {
  return (
    <View style={styles.card}>
      <View style={styles.accentBar} />

      <View style={styles.contentRow}>
        <View style={styles.leftGroup}>
          <View style={styles.iconBox}>
            <MaterialIcons name="warning" size={17} color={tokens.colors.onErrorContainer} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={1}>
              {conflict.conflicting_title || 'Conflito de Agenda'}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {conflict.message || 'Atenção: Pouco tempo de intervalo entre compromissos'}
            </Text>
          </View>
        </View>

        {onPressAdjust && (
          <TouchableOpacity style={styles.adjustBtn} onPress={onPressAdjust} activeOpacity={0.8}>
            <Text style={styles.adjustBtnText}>Ajustar</Text>
          </TouchableOpacity>
        )}
      </View>
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
});
