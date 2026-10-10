import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { tokens } from '../../theme/tokens';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ProfileUserCard } from './ProfileUserCard';
import { ProfileSettingsGroup } from './ProfileSettingsGroup';
import { NotificationSettingsModal } from '../notifications/NotificationSettingsModal';
import { CalendarSyncSettingsModal } from './CalendarSyncSettingsModal';

interface ProfileModalProps {
  visible: boolean;
  onClose: () => void;
  serverUrl?: string;
  onToggleServer?: () => void;
  onDataChanged?: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  visible,
  onClose,
  serverUrl,
  onToggleServer,
  onDataChanged,
}) => {
  const { user, logout } = useAuth();
  const { colors, isDark } = useTheme();
  const [notifModalVisible, setNotifModalVisible] = useState(false);
  const [calendarSyncModalVisible, setCalendarSyncModalVisible] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const name = user?.name || 'Andre Victor';
  const email = user?.email || 'andre@vito.ai';

  const handleManualCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    try {
      if (!Updates.isEnabled) {
        Alert.alert(
          'Atualizações OTA',
          'O serviço de atualizações OTA está desativado em ambiente de desenvolvimento (Metro). Ele opera ativamente em builds standalone instalados no dispositivo.'
        );
        return;
      }
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        Alert.alert(
          'Atualização Encontrada',
          'Baixando a versão mais recente em segundo plano...',
          [
            {
              text: 'Aplicar Agora',
              onPress: async () => {
                await Updates.fetchUpdateAsync();
                await Updates.reloadAsync();
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Aplicativo Atualizado',
          'Você já está executando a versão mais recente disponível para este aplicativo instalado.'
        );
      }
    } catch (e: any) {
      console.warn('[Updates] Erro ao verificar atualização:', e);
      Alert.alert(
        'Verificação de Atualização',
        `Não foi possível verificar atualizações: ${e?.message || 'Falha de conexão com os servidores do Expo'}.`
      );
    } finally {
      setIsCheckingUpdate(false);
    }
  };

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

                {/* Seção: Assistente Executivo & IA */}
                <View style={[styles.sectionHeader, { marginTop: tokens.spacing.md }]}>
                  <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ASSISTENTE EXECUTIVO & IA</Text>
                </View>

                <ProfileSettingsGroup
                  onOpenNotifications={() => setNotifModalVisible(true)}
                  onOpenCalendarSync={() => setCalendarSyncModalVisible(true)}
                />

                {/* Modal de Configuração de Notificações M3 */}
                <NotificationSettingsModal
                  visible={notifModalVisible}
                  onClose={() => setNotifModalVisible(false)}
                />

                {/* Modal de Sincronização de Calendários M3 */}
                <CalendarSyncSettingsModal
                  visible={calendarSyncModalVisible}
                  onClose={() => {
                    setCalendarSyncModalVisible(false);
                    onDataChanged?.();
                  }}
                  onDataChanged={onDataChanged}
                />


                {/* Ações da Sessão */}
                <View style={styles.actionsGroup}>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
                    onPress={handleManualCheckUpdate}
                    activeOpacity={0.8}
                    disabled={isCheckingUpdate}
                  >
                    <View style={styles.actionLeft}>
                      <MaterialIcons name="system-update" size={18} color={colors.primary} />
                      <Text style={[styles.actionText, { color: colors.onSurface }]}>
                        {isCheckingUpdate ? 'Buscando atualizações...' : 'Buscar Atualizações'}
                      </Text>
                    </View>
                    {isCheckingUpdate ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <MaterialIcons name="chevron-right" size={18} color={colors.outline} />
                    )}
                  </TouchableOpacity>

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
