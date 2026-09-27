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
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Header do Perfil */}
              <View style={styles.profileHeader}>
                <View style={styles.avatarLarge}>
                  <Text style={styles.avatarTextLarge}>
                    {firstName.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.profileName}>{user?.name}</Text>
                  <Text style={styles.profileEmail}>{user?.email}</Text>
                </View>
              </View>

              <View style={styles.divider} />

              {/* Seção de Conexão do Servidor */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Servidor e Conexão</Text>
                <TouchableOpacity
                  style={styles.serverRow}
                  onPress={onToggleServer}
                  activeOpacity={0.7}
                >
                  <View>
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
              </View>

              <View style={styles.divider} />

              {/* Ações da Sessão */}
              <TouchableOpacity
                style={styles.switchAccountButton}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.switchAccountText}>Trocar de Conta</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.logoutButton}
                onPress={handleLogout}
                activeOpacity={0.8}
              >
                <Text style={styles.logoutText}>Encerrar Sessão</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={styles.closeButtonText}>Fechar</Text>
              </TouchableOpacity>
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: tokens.spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: tokens.colors.surfaceElevated,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.lg,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    ...tokens.shadows.floating,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: tokens.spacing.md,
  },
  avatarLarge: {
    width: 52,
    height: 52,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.primaryLight,
    borderWidth: 1.5,
    borderColor: tokens.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: tokens.spacing.md,
  },
  avatarTextLarge: {
    fontSize: tokens.typography.size.xl,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.primary,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: tokens.typography.size.lg,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textPrimary,
  },
  profileEmail: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.textSecondary,
    marginTop: tokens.spacing.xxs,
  },
  divider: {
    height: 1,
    backgroundColor: tokens.colors.surfaceBorder,
    marginVertical: tokens.spacing.md,
  },
  section: {
    marginBottom: tokens.spacing.xs,
  },
  sectionTitle: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: tokens.typography.weight.semibold,
    marginBottom: tokens.spacing.sm,
    letterSpacing: 0.5,
  },
  serverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceSubtle,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  serverLabel: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.textPrimary,
  },
  serverUrlText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textMuted,
    marginTop: tokens.spacing.xxs,
    maxWidth: 210,
  },
  badgeSwitch: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: tokens.spacing.xs,
    backgroundColor: tokens.colors.surface,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  badgeSwitchText: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.medium,
  },
  switchAccountButton: {
    backgroundColor: tokens.colors.surfaceSubtle,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    marginTop: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    marginBottom: tokens.spacing.xs,
  },
  switchAccountText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
    color: tokens.colors.textPrimary,
  },
  logoutButton: {
    backgroundColor: tokens.colors.dangerLight,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    marginTop: tokens.spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  logoutText: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.danger,
  },
  closeButton: {
    paddingVertical: tokens.spacing.sm,
    alignItems: 'center',
    marginTop: tokens.spacing.sm,
  },
  closeButtonText: {
    fontSize: tokens.typography.size.sm,
    color: tokens.colors.textMuted,
  },
});
