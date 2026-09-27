import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { tokens } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  serverUrl: string;
  onToggleServer: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  serverUrl,
  onToggleServer,
}) => {
  const { user, logout } = useAuth();
  const isCloud = serverUrl.includes('vito.rasppi.cloud');
  const firstName = user?.name || 'Usuário';

  const handleLogout = () => {
    onClose();
    logout();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              {/* Grab Bar Header */}
              <View style={styles.sheetHeader}>
                <View style={styles.grabBar} />
                <TouchableOpacity
                  style={styles.closeIconBtn}
                  onPress={onClose}
                  hitSlop={tokens.hitSlop.sm}
                  accessibilityLabel="Fechar preferências"
                >
                  <Text style={styles.closeIconText}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Executive Profile Card */}
              <View style={styles.userCard}>
                <View style={styles.userCardTop}>
                  <View style={styles.avatarLarge}>
                    <Text style={styles.avatarTextLarge}>
                      {firstName.slice(0, 2).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.profileInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.profileName} numberOfLines={1}>
                        {user?.name?.toUpperCase() || 'ANDRE VICTOR'}
                      </Text>
                      <Text style={styles.verifiedIcon}>✓</Text>
                    </View>
                    <Text style={styles.profileEmail} numberOfLines={1}>
                      {user?.email || 'usuario@vito.ai'}
                    </Text>
                  </View>
                  <View style={styles.proBadge}>
                    <Text style={styles.proBadgeText}>EXECUTIVE PRO</Text>
                  </View>
                </View>

                {/* Telemetria de Tokens & Compute Ops */}
                <View style={styles.telemetryBox}>
                  <View style={styles.telemetryRow}>
                    <Text style={styles.telemetryLabel}>Cota semanal de tokens</Text>
                    <Text style={styles.telemetryValue}>18.1% utilizada</Text>
                  </View>
                  <View style={styles.progressBarTrack}>
                    <View style={[styles.progressBarFill, { width: '18.1%' }]} />
                  </View>
                  <View style={styles.telemetryFooter}>
                    <Text style={styles.telemetrySub}>90.5k / 500k compute ops</Text>
                    <Text style={styles.telemetrySub}>Renova em 4 dias</Text>
                  </View>
                </View>
              </View>

              {/* Seção de Conexão do Servidor */}
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>SERVIDOR & CONEXÃO</Text>
                <View style={styles.onlineBadge}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>Online • 24ms</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.serverRow}
                onPress={onToggleServer}
                activeOpacity={0.75}
              >
                <View style={styles.serverInfoCol}>
                  <Text style={styles.serverLabel}>
                    {isCloud ? 'Cloudflare Tunnel (Remoto)' : 'Raspberry Pi (Rede Local)'}
                  </Text>
                  <Text style={styles.serverUrlText} numberOfLines={1}>
                    {serverUrl}
                  </Text>
                </View>
                <View style={styles.badgeSwitch}>
                  <Text style={styles.badgeSwitchText}>Alternar</Text>
                </View>
              </TouchableOpacity>

              {/* Ações da Sessão */}
              <View style={styles.actionsGroup}>
                <TouchableOpacity
                  style={styles.switchAccountButton}
                  onPress={handleLogout}
                  activeOpacity={0.8}
                >
                  <Text style={styles.switchAccountText}>Alternar Conta</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={handleLogout}
                  activeOpacity={0.8}
                >
                  <Text style={styles.logoutText}>Encerrar Sessão</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    backgroundColor: tokens.colors.surfaceSubtle,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: tokens.spacing.lg,
    paddingTop: tokens.spacing.sm,
    paddingBottom: tokens.spacing.xl,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    ...tokens.shadows.floating,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: tokens.spacing.xs,
  },
  grabBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    alignSelf: 'center',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  closeIconBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: tokens.colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  closeIconText: {
    color: tokens.colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },

  // Executive User Card
  userCard: {
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    marginTop: tokens.spacing.sm,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    gap: 12,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarLarge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: tokens.colors.surfaceElevated,
    borderWidth: 1,
    borderColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTextLarge: {
    fontSize: tokens.typography.size.md,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontSize: tokens.typography.size.sm + 1,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.textPrimary,
    letterSpacing: 0.3,
  },
  verifiedIcon: {
    fontSize: 12,
    color: tokens.colors.primary,
    fontWeight: '700',
  },
  profileEmail: {
    fontSize: 12,
    color: tokens.colors.textMuted,
    marginTop: 1,
  },
  proBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primaryLight,
  },
  proBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: tokens.colors.primary,
    letterSpacing: 0.5,
  },

  // Telemetry Box
  telemetryBox: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderRadius: tokens.radii.md,
    padding: 10,
    gap: 6,
  },
  telemetryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetryLabel: {
    fontSize: 11,
    color: tokens.colors.textSecondary,
  },
  telemetryValue: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.primary,
  },
  progressBarTrack: {
    width: '100%',
    height: 5,
    borderRadius: 2.5,
    backgroundColor: tokens.colors.surfaceContainerHighest,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: tokens.colors.primaryContainer,
    borderRadius: 2.5,
  },
  telemetryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  telemetrySub: {
    fontSize: 10,
    color: tokens.colors.textMuted,
  },

  // Section Header & Server Row
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: tokens.colors.textMuted,
    letterSpacing: 0.8,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: tokens.colors.success,
  },
  onlineText: {
    fontSize: 11,
    color: tokens.colors.success,
    fontWeight: '600',
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  serverInfoCol: {
    flex: 1,
    marginRight: 8,
  },
  serverLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.textPrimary,
  },
  serverUrlText: {
    fontSize: 11,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  badgeSwitch: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: tokens.colors.surfaceElevated,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  badgeSwitchText: {
    fontSize: 11,
    color: tokens.colors.primary,
    fontWeight: '600',
  },

  // Actions
  actionsGroup: {
    marginTop: tokens.spacing.md,
    gap: 8,
  },
  switchAccountButton: {
    backgroundColor: tokens.colors.surfaceElevated,
    borderRadius: tokens.radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  switchAccountText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.textPrimary,
  },
  logoutButton: {
    backgroundColor: tokens.colors.dangerLight,
    borderRadius: tokens.radii.md,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 180, 171, 0.25)',
  },
  logoutText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.danger,
  },
});
