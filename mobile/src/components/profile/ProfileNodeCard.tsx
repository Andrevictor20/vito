import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';

interface ProfileNodeCardProps {
  isCloud: boolean;
  onToggleServer: () => void;
}

export const ProfileNodeCard: React.FC<ProfileNodeCardProps> = ({
  isCloud,
  onToggleServer,
}) => {
  return (
    <View style={styles.nodeCard}>
      {/* Segmented Control */}
      <View style={styles.segmentedToggle}>
        <TouchableOpacity
          style={[styles.segmentBtn, isCloud && styles.segmentBtnActive]}
          onPress={isCloud ? undefined : onToggleServer}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="cloud-queue"
            size={15}
            color={isCloud ? tokens.colors.primary : tokens.colors.textSecondary}
          />
          <Text style={[styles.segmentText, isCloud && styles.segmentTextActive]}>
            Cloudflare Tunnel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.segmentBtn, !isCloud && styles.segmentBtnActive]}
          onPress={!isCloud ? undefined : onToggleServer}
          activeOpacity={0.8}
        >
          <MaterialIcons
            name="developer-board"
            size={15}
            color={!isCloud ? tokens.colors.primary : tokens.colors.textSecondary}
          />
          <Text style={[styles.segmentText, !isCloud && styles.segmentTextActive]}>
            RPi Local Node
          </Text>
        </TouchableOpacity>
      </View>

      {/* Detalhes do Nó Ativo */}
      <View style={styles.nodeDetailRow}>
        <View style={styles.nodeIconBox}>
          <MaterialIcons name="dns" size={18} color={tokens.colors.primary} />
        </View>
        <View style={styles.nodeTextCol}>
          <Text style={styles.nodeTitle}>
            {isCloud ? 'Cloudflare Edge Tunnel' : 'RPi Local Private Node'}
          </Text>
          <Text style={styles.nodeMeta} numberOfLines={1}>
            {isCloud ? 'TLS 1.3 • Saída Segura Zero-Trust' : 'Rede Local Privada • 192.168.1.100'}
          </Text>
        </View>
        <View style={styles.routeBadge}>
          <Text style={styles.routeBadgeText}>Automático</Text>
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
