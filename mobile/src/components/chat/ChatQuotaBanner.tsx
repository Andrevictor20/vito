import React, { useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

interface ChatQuotaBannerProps {
  quotaPercentage?: number;
  daysRemaining?: number;
  onClose?: () => void;
}

export const ChatQuotaBanner: React.FC<ChatQuotaBannerProps> = ({
  quotaPercentage = 18.5,
  daysRemaining = 4,
  onClose,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    if (onClose) onClose();
  };

  return (
    <View style={styles.banner}>
      <View style={styles.leftRow}>
        <View style={styles.pulseDot} />
        <Text style={styles.text} numberOfLines={1}>
          <Text style={styles.boldText}>Plano Pro</Text> • {quotaPercentage}% da cota semanal utilizada. Renova em {daysRemaining}d.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.closeBtn}
        onPress={handleDismiss}
        hitSlop={tokens.hitSlop.sm}
        activeOpacity={0.7}
        accessibilityLabel="Fechar aviso de cota"
      >
        <MaterialIcons name="close" size={15} color={tokens.colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: tokens.colors.surfaceContainerLow,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginHorizontal: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  leftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs + 2,
    flex: 1,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primary,
  },
  text: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
    flex: 1,
  },
  boldText: {
    color: tokens.colors.textPrimary,
    fontWeight: tokens.typography.weight.semibold,
  },
  closeBtn: {
    width: 22,
    height: 22,
    borderRadius: tokens.radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
