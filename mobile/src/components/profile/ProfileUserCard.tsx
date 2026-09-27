import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

interface ProfileUserCardProps {
  name: string;
  email: string;
  quotaPercentage?: number;
}

export const ProfileUserCard: React.FC<ProfileUserCardProps> = ({
  name,
  email,
  quotaPercentage = 18.5,
}) => {
  const initials = (name || 'UV').slice(0, 2).toUpperCase();

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>{name.toUpperCase()}</Text>
            <MaterialIcons name="check-circle" size={14} color={tokens.colors.primary} />
          </View>
          <Text style={styles.email} numberOfLines={1}>{email}</Text>
        </View>

        <View style={styles.proBadge}>
          <Text style={styles.proBadgeText}>PRO</Text>
        </View>
      </View>

      <View style={styles.telemetryBox}>
        <View style={styles.telemetryRow}>
          <Text style={styles.telemetryLabel}>Cota semanal utilizada</Text>
          <Text style={styles.telemetryValue}>{quotaPercentage}%</Text>
        </View>
        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${quotaPercentage}%` }]} />
        </View>
        <View style={styles.telemetryFooter}>
          <Text style={styles.telemetrySub}>92.5k / 500k ops</Text>
          <Text style={styles.telemetrySub}>Renova em 4 dias</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
    color: '#fff',
  },
  infoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  name: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.sm + 1,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.5,
  },
  email: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
    marginTop: 2,
  },
  proBadge: {
    backgroundColor: tokens.colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
    borderColor: 'rgba(173, 198, 255, 0.3)',
  },
  proBadgeText: {
    color: tokens.colors.primary,
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
  },
  telemetryBox: {
    backgroundColor: tokens.colors.surfaceContainerLow,
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.sm,
    gap: 6,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemetryLabel: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
  },
  telemetryValue: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.semibold,
  },
  progressBarTrack: {
    height: 4,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.cobalt,
    borderRadius: tokens.radii.full,
  },
  telemetryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  telemetrySub: {
    color: tokens.colors.outline,
    fontSize: 10,
  },
});
