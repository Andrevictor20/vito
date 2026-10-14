import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { tokens } from '../theme/tokens';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ProfileUserCard } from '../components/profile/ProfileUserCard';
import { ProfileSettingsGroup } from '../components/profile/ProfileSettingsGroup';
import { NotificationSettingsModal } from '../components/notifications/NotificationSettingsModal';
import { CalendarSyncSettingsModal } from '../components/profile/CalendarSyncSettingsModal';
import { AISettingsModal } from '../components/profile/AISettingsModal';

interface ProfileScreenProps {
  refreshing?: boolean;
  onRefresh?: () => void;
  onDataChanged?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  refreshing = false,
  onRefresh,
  onDataChanged,
}) => {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const [notifVisible, setNotifVisible] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [checking, setChecking] = useState(false);

  const name = user?.name || 'Andre Victor';
  const email = user?.email || 'andre@vito.ai';

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      if (!Updates.isEnabled) {
        Alert.alert(
          'Atualizações OTA',
          'O serviço OTA está desativado em desenvolvimento (Metro). Ativo em builds standalone.'
        );
        return;
      }
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        Alert.alert('Atualização Encontrada', 'Baixando em segundo plano...', [
          {
            text: 'Aplicar Agora',
            onPress: async () => {
              await Updates.fetchUpdateAsync();
              await Updates.reloadAsync();
            },
          },
        ]);
      } else {
        Alert.alert('Aplicativo Atualizado', 'Você já está na versão mais recente.');
      }
    } catch (e: any) {
      Alert.alert('Verificação de Atualização', `Falha: ${e?.message || 'conexão com Expo'}.`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.surface }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined
      }
    >
      <ProfileUserCard name={name} email={email} quotaPercentage={18.5} />

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ASSISTENTE EXECUTIVO & IA</Text>
      </View>

      <ProfileSettingsGroup
        onOpenNotifications={() => setNotifVisible(true)}
        onOpenCalendarSync={() => setSyncVisible(true)}
        onOpenAISettings={() => setAiVisible(true)}
      />

      <AISettingsModal visible={aiVisible} onClose={() => setAiVisible(false)} />
      <NotificationSettingsModal visible={notifVisible} onClose={() => setNotifVisible(false)} />
      <CalendarSyncSettingsModal
        visible={syncVisible}
        onClose={() => {
          setSyncVisible(false);
          onDataChanged?.();
        }}
        onDataChanged={onDataChanged}
      />

      <View style={styles.actionsGroup}>
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
          onPress={handleCheckUpdate}
          activeOpacity={0.8}
          disabled={checking}
          accessibilityLabel="Buscar atualizações"
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="system-update" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.onSurface }]}>
              {checking ? 'Buscando atualizações...' : 'Buscar Atualizações'}
            </Text>
          </View>
          {checking ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialIcons name="chevron-right" size={18} color={colors.outline} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}
          onPress={logout}
          activeOpacity={0.8}
          accessibilityLabel="Trocar de conta"
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="switch-account" size={18} color={colors.onSurfaceVariant} />
            <Text style={[styles.actionText, { color: colors.onSurface }]}>Trocar de Conta</Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={colors.outline} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.logoutButton]}
          onPress={logout}
          activeOpacity={0.8}
          accessibilityLabel="Encerrar sessão"
        >
          <View style={styles.actionLeft}>
            <MaterialIcons name="logout" size={18} color={colors.danger} />
            <Text style={[styles.actionText, styles.logoutText]}>Encerrar Sessão</Text>
          </View>
          <MaterialIcons name="chevron-right" size={18} color={colors.danger} />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: tokens.spacing.md, paddingBottom: 110 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: tokens.spacing.md,
    marginBottom: tokens.spacing.xs,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  actionsGroup: { marginTop: tokens.spacing.md, gap: tokens.spacing.xs + 2 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm },
  actionText: { fontSize: 13, fontWeight: '500' },
  logoutButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderRadius: 12,
  },
  logoutText: { color: '#EF4444' },
});
