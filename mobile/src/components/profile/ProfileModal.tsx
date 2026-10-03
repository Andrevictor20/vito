import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ProfileUserCard } from './ProfileUserCard';
import { ProfileNodeCard } from './ProfileNodeCard';
import { ProfileSettingsGroup } from './ProfileSettingsGroup';
import { isCloudServer } from '../../services/api';

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
  const { colors, isDark } = useTheme();
  const isCloud = isCloudServer(serverUrl);
  const name = user?.name || 'Andre Victor';
  const email = user?.email || 'andre@vito.ai';

  const handleLogout = () => {
    onClose();
    logout();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              {/* Grab Bar & Close Action */}
              <View style={styles.sheetHeader}>
                <View style={[styles.grabBar, { backgroundColor: colors.outlineVariant }]} />
                <TouchableOpacity
                  style={[styles.closeBtn, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}
                  onPress={onClose}
                  hitSlop={tokens.hitSlop.sm}
                  accessibilityLabel="Fechar perfil"
                  activeOpacity={0.7}
                >
                  <MaterialIcons name="close" size={18} color={colors.onSurface} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Executive User Card com Cota Semanal */}
                <ProfileUserCard name={name} email={email} quotaPercentage={18.5} />

                {/* Seção: Servidor & Conexão Stitch */}
                <View style={styles.sectionHeader}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SERVIDOR & CONEXÃO</Text>
                  <View style={styles.onlineBadge}>
                    <View style={styles.onlineDot} />
                    <Text style={styles.onlineText}>Online • 24ms</Text>
                  </View>
                </View>

                <ProfileNodeCard isCloud={isCloud} onToggleServer={onToggleServer} />

                {/* Seção: Assistente Executivo & IA */}
                <View style={[styles.sectionHeader, { marginTop: tokens.spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ASSISTENTE EXECUTIVO & IA</Text>
                </View>

                <ProfileSettingsGroup />

                {/* Ações da Sessão */}
                <View style={styles.actionsGroup}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                    onPress={handleLogout}
                    activeOpacity={0.8}
                  >
                    <View style={styles.actionLeft}>
                      <MaterialIcons name="switch-account" size={18} color={colors.onSurfaceVariant} />
                      <Text style={[styles.actionText, { color: colors.onSurface }]}>Trocar de Conta</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={18} color={colors.outline} />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.actionButton, styles.logoutButton]}
                    onPress={handleLogout}
                    activeOpacity={0.8}
                  >
                    <View style={styles.actionLeft}>
                      <MaterialIcons name="logout" size={18} color={colors.danger} />
                      <Text style={[styles.actionText, styles.logoutText]}>Encerrar Sessão</Text>
                    </View>
                    <MaterialIcons name="chevron-right" size={18} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
    backgroundColor: tokens.colors.bg,
    borderTopLeftRadius: tokens.radii.xl,
    borderTopRightRadius: tokens.radii.xl,
    maxHeight: '88%',
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  sheetHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: tokens.spacing.sm,
    position: 'relative',
    minHeight: 40,
  },
  grabBar: {
    width: 36,
    height: 4,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceContainerHighest,
  },
  closeBtn: {
    position: 'absolute',
    right: tokens.spacing.md,
    top: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    color: tokens.colors.outline,
    fontSize: 11,
    fontWeight: tokens.typography.weight.semibold,
    letterSpacing: 0.8,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.success,
  },
  onlineText: {
    color: tokens.colors.success,
    fontSize: 11,
    fontWeight: tokens.typography.weight.medium,
  },
  actionsGroup: {
    marginTop: tokens.spacing.md,
    gap: tokens.spacing.xs + 2,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: tokens.colors.surfaceContainer,
    padding: tokens.spacing.md,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  actionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  actionText: {
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.medium,
  },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  logoutText: {
    color: tokens.colors.danger,
  },
});
