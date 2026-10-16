import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { formatPhoneNumber } from '../../utils/phoneFormat';

interface ProfileUserCardProps {
  name: string;
  email: string;
  phone?: string;
  onEditPhone?: () => void;
  quotaPercentage?: number;
}

export const ProfileUserCard: React.FC<ProfileUserCardProps> = ({
  name,
  email,
  phone,
  onEditPhone,
  quotaPercentage = 18.5,
}) => {
  const { colors } = useTheme();
  const initials = (name || 'UV').slice(0, 2).toUpperCase();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
      <View style={styles.topRow}>
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text style={[styles.avatarText, { color: colors.onPrimary }]}>{initials}</Text>
        </View>

        <View style={styles.infoCol}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.onSurface }]} numberOfLines={1}>{name.toUpperCase()}</Text>
            <MaterialIcons name="check-circle" size={14} color={colors.primary} />
          </View>
          <Text style={[styles.email, { color: colors.textSecondary }]} numberOfLines={1} ellipsizeMode="middle">{email}</Text>
          {onEditPhone ? (
            <TouchableOpacity
              style={styles.phoneRow}
              onPress={onEditPhone}
              activeOpacity={0.7}
              accessibilityLabel="Confirmar ou editar número de telefone"
            >
              <MaterialIcons name={phone ? 'verified-user' : 'phone'} size={12} color={colors.primary} />
              <Text style={[styles.phoneText, { color: phone ? colors.onSurfaceVariant : colors.primary }]}>
                {phone ? formatPhoneNumber(phone) : '+ Confirmar telefone via WhatsApp'}
              </Text>
              <MaterialIcons name="edit" size={12} color={colors.textSecondary} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={[styles.proBadge, { backgroundColor: colors.primaryContainer, borderColor: colors.outlineVariant }]}>
          <Text style={[styles.proBadgeText, { color: colors.primary }]}>PRO AI</Text>
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  phoneText: {
    fontSize: tokens.typography.size.xs,
    fontFamily: tokens.typography.family.medium,
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: tokens.radii.full,
    borderWidth: 1,
  },
  proBadgeText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.4,
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
