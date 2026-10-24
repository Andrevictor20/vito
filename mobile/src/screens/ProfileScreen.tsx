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
import { ProfileConnectionsGrid } from '../components/profile/ProfileConnectionsGrid';
import { ProfileAutonomyCard } from '../components/profile/ProfileAutonomyCard';
import { CalendarSyncSettingsModal } from '../components/profile/CalendarSyncSettingsModal';
import { AISettingsModal } from '../components/profile/AISettingsModal';
import { PhoneEditModal } from '../components/profile/PhoneEditModal';
import { ContactsSyncModal } from '../components/profile/ContactsSyncModal';
import { ConnectedDevicesModal } from '../components/profile/ConnectedDevicesModal';
import { WhatsAppConnectModal } from '../components/profile/WhatsAppConnectModal';
import { GmailConnectModal } from '../components/profile/GmailConnectModal';
import { VoiceActivationSettings } from '../components/profile/VoiceActivationSettings';
import { api } from '../services/api';
import { calendarSyncService } from '../services/calendarSyncService';
import { hapticFeedback } from '../theme/motion';
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
  const { colors, themeMode, setThemeMode } = useTheme();

  // Modais
  const [syncVisible, setSyncVisible] = useState(false);
  const [aiVisible, setAiVisible] = useState(false);
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [contactsVisible, setContactsVisible] = useState(false);
  const [voiceVisible, setVoiceVisible] = useState(false);
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

  const name = user?.name?.trim() || 'Usuário';
  const email = user?.email?.trim() || 'Sem e-mail cadastrado';
  const appVersion = (appJson as { expo?: { version?: string; android?: { versionCode?: number } } })?.expo?.version ?? '1.0.0';

  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('autonomous');
  const [calendarsActive, setCalendarsActive] = useState<number | null>(null);
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);

  const loadStatuses = useCallback(async () => {
    try {
      const s = await api.getAISettings();
      if (s?.autonomy_mode) setAutonomyMode(s.autonomy_mode);
    } catch {
      // Mantém default
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

  const handleUpdateAutonomy = async (mode: AutonomyMode) => {
    setAutonomyMode(mode);
    try {
      await api.updateAISettings({ autonomy_mode: mode });
    } catch (e) {
      console.warn('[Profile] Erro ao atualizar autonomia:', e);
    }
  };

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
      style={[styles.scroll, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} /> : undefined
      }
    >
      {/* Card de Usuário (.pf) */}
      <ProfileUserCard
        name={name}
        email={email}
        phone={userPhone}
        onEditPhone={() => setPhoneVisible(true)}
      />

      {/* Seção Conexões (.lbl + .cn) */}
      <Text style={[styles.lbl, { color: colors.muted }]}>CONEXÕES</Text>
      <ProfileConnectionsGrid
        onPressCalendar={() => setSyncVisible(true)}
        onPressGmail={() => setGmailVisible(true)}
        onPressWhatsApp={() => setWhatsAppVisible(true)}
        calendarActive={Boolean(calendarsActive && calendarsActive > 0)}
        gmailActive={Boolean(gmailStatus?.connected)}
        whatsAppActive={whatsAppStatus === 'connected'}
      />

      {/* Seção Autonomia do Vito (.lbl + .aut) */}
      <Text style={[styles.lbl, { color: colors.muted }]}>AUTONOMIA DO VITO</Text>
      <ProfileAutonomyCard
        mode={autonomyMode}
        onSelectMode={handleUpdateAutonomy}
      />

      {/* Seção Preferências (.lbl + .lst) */}
      <Text style={[styles.lbl, { color: colors.muted }]}>PREFERÊNCIAS</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        {/* Linha Tema com Segmented Control */}
        <View style={styles.li}>
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <MaterialIcons name="wb-sunny" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.liTitle, { color: colors.ink }]}>Tema</Text>
          <View style={[styles.themeSeg, { backgroundColor: colors.bg, borderColor: colors.line }]}>
            {(['light', 'dark', 'system'] as const).map((mode) => {
              const active = themeMode === mode;
              const labels = { light: 'Claro', dark: 'Escuro', system: 'Sistema' };
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.themeBtn, active && [styles.themeBtnActive, { backgroundColor: colors.ink }]]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setThemeMode(mode);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.themeBtnText, { color: active ? colors.bg : colors.ink }]}>
                    {labels[mode]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Agenda de Contatos */}
        <TouchableOpacity
          style={styles.li}
          onPress={() => setContactsVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <MaterialIcons name="contacts" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.liTitle, { color: colors.ink }]}>Agenda de contatos</Text>
          <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Memória do Vito */}
        <TouchableOpacity
          style={styles.li}
          onPress={() => setAiVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <MaterialIcons name="psychology" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.liTitle, { color: colors.ink }]}>Memória do Vito</Text>
          <Text style={[styles.liMeta, { color: colors.muted }]}>Ver e editar</Text>
          <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        {/* Ativação por Voz (Ei Vito / Assistente Nativo) */}
        <TouchableOpacity
          style={styles.li}
          onPress={() => setVoiceVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <MaterialIcons name="mic" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.liTitle, { color: colors.ink }]}>Ativação por voz</Text>
          <Text style={[styles.liMeta, { color: colors.muted }]}>Modos e hotword</Text>
          <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Seção Sistema (.lbl + .lst) */}
      <Text style={[styles.lbl, { color: colors.muted }]}>SISTEMA</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        <TouchableOpacity
          style={styles.li}
          onPress={() => setDevicesVisible(true)}
          activeOpacity={0.7}
        >
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <MaterialIcons name="devices" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.liTitle, { color: colors.ink }]}>Dispositivos conectados</Text>
          <Text style={[styles.liMeta, { color: colors.muted }]}>
            {sessionsCount !== null ? `${sessionsCount} ${sessionsCount === 1 ? 'ativo' : 'ativos'}` : '1 ativo'}
          </Text>
          <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        <TouchableOpacity
          style={styles.li}
          onPress={handleCheckUpdate}
          disabled={checking}
          activeOpacity={0.7}
        >
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <MaterialIcons name="refresh" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.liTitle, { color: colors.ink }]}>Atualizações</Text>
          {checking ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Text style={[styles.liMeta, { color: colors.muted }]}>Atualizado</Text>
          )}
          <MaterialIcons name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>

      {/* Botões de Ação (.out) */}
      <View style={styles.out}>
        <TouchableOpacity
          style={[styles.outBtn, { borderColor: colors.line }]}
          onPress={logout}
          activeOpacity={0.7}
        >
          <Text style={[styles.outBtnText, { color: colors.ink }]}>Trocar de conta</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outBtn, styles.outBtnDanger, { borderColor: colors.red }]}
          onPress={logout}
          activeOpacity={0.7}
        >
          <Text style={[styles.outBtnText, { color: colors.red }]}>Encerrar sessão</Text>
        </TouchableOpacity>
      </View>

      {/* Versão (.ver) */}
      <Text style={[styles.ver, { color: colors.muted }]}>
        Vito · build OTA {appVersion}
      </Text>

      {/* Modais */}
      <AISettingsModal
        visible={aiVisible}
        onClose={() => setAiVisible(false)}
        onSettingsUpdated={(s) => {
          if (s?.autonomy_mode) setAutonomyMode(s.autonomy_mode);
        }}
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
      <VoiceActivationSettings
        visible={voiceVisible}
        onClose={() => setVoiceVisible(false)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: tokens.spacing.md, paddingBottom: 120 },
  lbl: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 22,
    marginBottom: 8,
    marginHorizontal: 2,
  },
  lst: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  li: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  liIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liTitle: {
    flex: 1,
    fontSize: 14.5,
    fontWeight: '500',
    fontFamily: tokens.typography.family.medium,
  },
  liMeta: {
    fontSize: 13,
    marginRight: 2,
  },
  divider: {
    height: 1,
    marginLeft: 60,
  },
  themeSeg: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 2,
    width: 190,
  },
  themeBtn: {
    flex: 1,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  themeBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  themeBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
  },
  out: { flexDirection: 'row', gap: 10, marginTop: 22 },
  outBtn: { flex: 1, height: 46, borderRadius: 23, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  outBtnDanger: { backgroundColor: 'transparent' },
  outBtnText: { fontSize: 14, fontWeight: '600', fontFamily: tokens.typography.family.medium },
  ver: { textAlign: 'center', fontSize: 12, marginTop: 16 },
});
