import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

interface ProfileNodeCardProps {
  isCloud: boolean;
  onToggleServer: () => void;
}

export const ProfileNodeCard: React.FC<ProfileNodeCardProps> = ({
  isCloud,
  onToggleServer,
}) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={[styles.nodeCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
      {/* Segmented Control */}
      <View style={[styles.segmentedToggle, { backgroundColor: colors.surfaceContainerHighest }]}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            isCloud && [
              styles.segmentBtnActive,
              {
                backgroundColor: isDark ? colors.surfaceContainer : '#FFFFFF',
                borderWidth: isDark ? 1 : 0,
                borderColor: colors.outlineVariant,
              },
            ],
          ]}
          onPress={isCloud ? undefined : onToggleServer}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="cloud-queue"
            size={15}
            color={isCloud ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.segmentText, { color: isCloud ? colors.onSurface : colors.textSecondary }]}>
            Cloudflare Tunnel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            !isCloud && [
              styles.segmentBtnActive,
              {
                backgroundColor: isDark ? colors.surfaceContainer : '#FFFFFF',
                borderWidth: isDark ? 1 : 0,
                borderColor: colors.outlineVariant,
              },
            ],
          ]}
          onPress={!isCloud ? undefined : onToggleServer}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="developer-board"
            size={15}
            color={!isCloud ? colors.primary : colors.textSecondary}
          />
          <Text style={[styles.segmentText, { color: !isCloud ? colors.onSurface : colors.textSecondary }]}>
            RPi Local Node
          </Text>
        </TouchableOpacity>
      </View>

      {/* Detalhes do Nó Ativo */}
      <View style={[styles.nodeDetailRow, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
        <View style={[styles.nodeIconBox, { backgroundColor: colors.surfaceContainerHighest }]}>
          <MaterialIcons name="dns" size={18} color={colors.primary} />
        </View>
        <View style={styles.nodeTextCol}>
          <Text style={[styles.nodeTitle, { color: colors.onSurface }]}>
            {isCloud ? 'Cloudflare Edge Tunnel' : 'RPi Local Private Node'}
          </Text>
          <Text style={[styles.nodeMeta, { color: colors.textSecondary }]} numberOfLines={1}>
            {isCloud ? 'TLS 1.3 • Saída Segura Zero-Trust' : 'Rede Local Privada • 192.168.1.100'}
          </Text>
        </View>
        <View style={[styles.routeBadge, { backgroundColor: colors.surfaceContainerHighest }]}>
          <Text style={[styles.routeBadgeText, { color: colors.primary }]}>Automático</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  nodeCard: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    gap: tokens.spacing.sm,
  },
  segmentedToggle: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.radii.sm,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 7,
    borderRadius: tokens.radii.xs,
  },
  segmentBtnActive: {
    backgroundColor: tokens.colors.surfaceContainerHigh,
  },
  segmentText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
    fontWeight: tokens.typography.weight.medium,
  },
  segmentTextActive: {
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  nodeDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(41, 42, 44, 0.4)',
    borderRadius: tokens.radii.sm,
    padding: tokens.spacing.sm,
    gap: tokens.spacing.sm,
  },
  nodeIconBox: {
    width: 32,
    height: 32,
    borderRadius: tokens.radii.sm,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nodeTextCol: {
    flex: 1,
  },
  nodeTitle: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.xs + 1,
    fontWeight: tokens.typography.weight.semibold,
  },
  nodeMeta: {
    color: tokens.colors.textSecondary,
    fontSize: 10,
    marginTop: 1,
  },
  routeBadge: {
    backgroundColor: tokens.colors.surfaceContainerHighest,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
  },
  routeBadgeText: {
    color: tokens.colors.primary,
    fontSize: 10,
    fontWeight: tokens.typography.weight.medium,
  },
});
