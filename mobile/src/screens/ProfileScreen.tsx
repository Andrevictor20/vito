import React, { useState, useEffect, useCallback } from 'react';
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
import { CalendarSyncSettingsModal } from '../components/profile/CalendarSyncSettingsModal';
import { AISettingsModal } from '../components/profile/AISettingsModal';
import { PhoneEditModal } from '../components/profile/PhoneEditModal';
import { ContactsSyncModal } from '../components/profile/ContactsSyncModal';
import { ConnectedDevicesModal } from '../components/profile/ConnectedDevicesModal';
import { WhatsAppConnectModal } from '../components/profile/WhatsAppConnectModal';
import { GmailConnectModal } from '../components/profile/GmailConnectModal';
import { IntegrationsModal } from '../components/profile/IntegrationsModal';
import { api } from '../services/api';
import { calendarSyncService } from '../services/calendarSyncService';
import type { AutonomyMode } from '../types';
import appJson from '../../app.json';

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
  const [integrationsVisible, setIntegrationsVisible] = useState(false);
  const [syncVisible, setSyncVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [devicesVisible, setDevicesVisible] = useState(false);
  const [whatsAppVisible, setWhatsAppVisible] = useState(false);
  const [whatsAppStatus, setWhatsAppStatus] = useState<'disconnected' | 'connecting' | 'connected' | null>(null);
  const [gmailVisible, setGmailVisible] = useState(false);
  const [gmailStatus, setGmailStatus] = useState<{ connected: boolean; email?: string } | null>(null);
  const [userPhone, setUserPhone] = useState(user?.phone || '');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (user?.phone) setUserPhone(user.phone);
  }, [user?.phone]);


  const name = user?.name || 'Andre Victor';
  const email = user?.email || 'andre@vito.ai';
  const appVersion = (appJson as { expo?: { version?: string; android?: { versionCode?: number } } })?.expo?.version ?? '';
  const appBuild = (appJson as { expo?: { version?: string; android?: { versionCode?: number } } })?.expo?.android?.versionCode;

  // Statuses vivos das linhas (mesmas fontes dos modais).
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('assisted');
  const [calendarsActive, setCalendarsActive] = useState<number | null>(null);
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);

  const integrationsActiveCount =
    (whatsAppStatus === 'connected' ? 1 : 0) + (gmailStatus?.connected ? 1 : 0);

  const loadStatuses = useCallback(async () => {
    try {
      const s = await api.getAISettings();
      if (s?.autonomy_mode) setAutonomyMode(s.autonomy_mode);
    } catch {
      // Mantém default assistido; modal mostra o erro ao abrir.
    }
    try {
      const list = await calendarSyncService.listIntegrations();
      setCalendarsActive((list || []).filter((i) => i.status === 'active').length);
    } catch {
      setCalendarsActive(null);
    }
    try {
      const sess = await api.getSessions();
      setSessionsCount(sess?.sessions?.length ?? 1);
    } catch {
      setSessionsCount(null);
    }
    try {
      const wa = await api.getWhatsAppStatus();
      setWhatsAppStatus(wa?.status || 'disconnected');
      if (wa?.phone && !userPhone) {
        setUserPhone(wa.phone);
      }
    } catch {
      setWhatsAppStatus('disconnected');
    }
    try {
      const gm = await api.getGmailStatus();
      setGmailStatus(gm);
    } catch {
      setGmailStatus({ connected: false });
    }
  }, [userPhone]);

  useEffect(() => {
    loadStatuses();
  }, [loadStatuses]);

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
      <ProfileUserCard
        name={name}
        email={email}
        phone={userPhone}
        onEditPhone={() => setPhoneVisible(true)}
        quotaPercentage={18.5}
      />

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ASSISTENTE EXECUTIVO & IA</Text>
      </View>

      <ProfileSettingsGroup
        onOpenCalendarSync={() => setSyncVisible(true)}
        onOpenAISettings={() => setAiVisible(true)}
        onOpenContactsSync={() => setContactsVisible(true)}
        onOpenIntegrations={() => setIntegrationsVisible(true)}
        autonomyMode={autonomyMode}
        calendarsActive={calendarsActive}
        integrationsActiveCount={integrationsActiveCount}
      />

      <AISettingsModal
        visible={aiVisible}
        onClose={() => setAiVisible(false)}
        onSettingsUpdated={(s) => {
          if (s?.autonomy_mode) setAutonomyMode(s.autonomy_mode);
        }}
      />
      <IntegrationsModal
        visible={integrationsVisible}
        onClose={() => setIntegrationsVisible(false)}
        whatsAppStatus={whatsAppStatus}
        gmailStatus={gmailStatus}
        onOpenWhatsApp={() => setWhatsAppVisible(true)}
        onOpenGmail={() => setGmailVisible(true)}
      />
      <CalendarSyncSettingsModal
        visible={syncVisible}
        onClose={() => {
          setSyncVisible(false);
          loadStatuses();
          onDataChanged?.();
        }}
        onDataChanged={() => {
          loadStatuses();
          onDataChanged?.();
        }}
      />
      <PhoneEditModal
        visible={phoneVisible}
        currentPhone={userPhone}
        userName={name}
        userEmail={email}
        onClose={() => setPhoneVisible(false)}
        onPhoneUpdated={(newPhone) => {
          setUserPhone(newPhone);
          onDataChanged?.();
        }}
      />
      <ContactsSyncModal
        visible={contactsVisible}
        onClose={() => setContactsVisible(false)}
      />
      <ConnectedDevicesModal
        visible={devicesVisible}
        onClose={() => setDevicesVisible(false)}
        onSessionsChanged={(count) => setSessionsCount(count)}
      />
      <WhatsAppConnectModal
        visible={whatsAppVisible}
        onClose={() => {
          setWhatsAppVisible(false);
          loadStatuses();
        }}
        defaultPhone={userPhone}
        onStatusChanged={() => {
          loadStatuses();
          onDataChanged?.();
        }}
      />
      <GmailConnectModal
        visible={gmailVisible}
        onClose={() => {
          setGmailVisible(false);
          loadStatuses();
        }}
        onStatusChanged={() => {
          loadStatuses();
          onDataChanged?.();
        }}
      />

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>SISTEMA & SESSÃO</Text>
      </View>

      <View style={[styles.groupCard, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
        <TouchableOpacity
          style={styles.groupItem}
          onPress={() => setDevicesVisible(true)}
          activeOpacity={0.8}
          accessibilityLabel="Dispositivos conectados"
          accessibilityRole="button"
        >
          <View style={styles.actionLeft}>
            <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
              <MaterialIcons name="devices" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.actionText, { color: colors.onSurface }]}>Dispositivos Conectados</Text>
          </View>
          <View style={styles.itemRight}>
            {sessionsCount !== null && (
              <Text style={[styles.statusText, { color: colors.onSurfaceVariant }]}>
                {sessionsCount} {sessionsCount === 1 ? 'ativo' : 'ativos'}
              </Text>
            )}
            <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
          </View>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

        <TouchableOpacity
          style={styles.groupItem}
          onPress={handleCheckUpdate}
          activeOpacity={0.8}
          disabled={checking}
          accessibilityLabel="Buscar atualizações"
          accessibilityRole="button"
        >
          <View style={styles.actionLeft}>
            <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
              <MaterialIcons name="refresh" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.actionText, { color: colors.onSurface }]}>Buscar Atualizações</Text>
          </View>
          <View style={styles.itemRight}>
            {checking ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Text style={[styles.statusText, { color: colors.onSurfaceVariant }]}>Atualizado</Text>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </>
            )}
          </View>
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

        <TouchableOpacity
          style={styles.groupItem}
          onPress={logout}
          activeOpacity={0.8}
          accessibilityLabel="Trocar de conta"
          accessibilityRole="button"
        >
          <View style={styles.actionLeft}>
            <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
              <MaterialIcons name="switch-account" size={18} color={colors.primary} />
            </View>
            <Text style={[styles.actionText, { color: colors.onSurface }]}>Trocar de Conta</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.outlineVariant }]} />

        <TouchableOpacity
          style={styles.groupItem}
          onPress={logout}
          activeOpacity={0.8}
          accessibilityLabel="Encerrar sessão"
          accessibilityRole="button"
        >
          <View style={styles.actionLeft}>
            <View style={[styles.itemIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
              <MaterialIcons name="logout" size={18} color={colors.danger} />
            </View>
            <Text style={[styles.actionText, styles.logoutText]}>Encerrar Sessão</Text>
          </View>
          <MaterialIcons name="chevron-right" size={20} color={colors.danger} />
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
  groupCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  groupItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: tokens.spacing.md,
  },
  divider: {
    height: 1,
    marginHorizontal: tokens.spacing.md,
  },
  itemIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLeft: { flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm, flex: 1 },
  itemTextCol: { flex: 1 },
  itemSub: { fontSize: 12, marginTop: 1 },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0, marginLeft: 8 },
  statusText: { fontSize: 13, fontWeight: '600' },
  actionText: { fontSize: 15, fontWeight: '700', letterSpacing: -0.1 },
  logoutText: { color: '#EF4444' },
});
