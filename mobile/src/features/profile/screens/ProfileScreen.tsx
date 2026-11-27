import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { ProtoUiIcon } from '../../../icons/ProtoUiIcons';
import * as Updates from 'expo-updates';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../../context/AuthContext';
import { useTheme } from '../../../context/ThemeContext';
import { hapticFeedback } from '../../../theme/motion';
import { StaggerItem } from '../../../theme/vitoMotion';
import { api } from '../../../services/api';
import { calendarSyncService } from '../../calendar/services/calendarApi';
import { useProfileAiModel } from '../hooks/useProfileAiModel';
import { navigateToScreen, navigateToStore } from '../../../navigation/screensNav';
import { ProfileUserCard } from '../components/ProfileUserCard';
import { AiSection } from '../components/AiSection';
import { PhoneEditModal } from '../components/PhoneEditModal';
import { ConnectedDevicesModal } from '../components/ConnectedDevicesModal';
import { ModelPickerSheet } from '../components/ai/ModelPickerSheet';
import { VitoSheet } from '../../../components/ui/VitoSheet';
import { profileStyles as styles } from './ProfileScreen.styles';
import appJson from '../../../../app.json';

interface ProfileScreenProps {
  refreshing?: boolean;
  onRefresh?: () => void;
  onDataChanged?: () => void;
  showBackHeader?: boolean;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  refreshing = false,
  onRefresh,
  onDataChanged,
  showBackHeader = false,
}) => {
  const { user, logout } = useAuth();
  const { colors, themeMode, setThemeMode } = useTheme();
  const navigation = useNavigation();
  const aiModel = useProfileAiModel();

  const [phoneVisible, setPhoneVisible] = useState(false);
  const [devicesVisible, setDevicesVisible] = useState(false);
  const [logoutSheetOpen, setLogoutSheetOpen] = useState(false);
  const [userPhone, setUserPhone] = useState(user?.phone || '');
  const [connectedAppsCount, setConnectedAppsCount] = useState(0);
  const [autonomyLabel, setAutonomyLabel] = useState('Modo Assistido · Equilibrado');
  const [voiceLabel, setVoiceLabel] = useState('Voz Feminina');
  const [memorySummary, setMemorySummary] = useState('');
  const [sessionsCount, setSessionsCount] = useState<number | null>(null);
  const [planLabel, setPlanLabel] = useState('Plano gratuito · 7 dias grátis');
  const [planCta, setPlanCta] = useState('Assinar');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (user?.phone) setUserPhone(user.phone);
  }, [user?.phone]);

  const loadStatuses = useCallback(async () => {
    const [aiSet, cals, sess, wa, gm, mem, sub] = await Promise.all([
      api.getAISettings().catch(() => null),
      calendarSyncService.listIntegrations().catch(() => []),
      api.getSessions().catch(() => null),
      api.getWhatsAppStatus().catch(() => null),
      api.getGmailStatus().catch(() => null),
      api.request<{ themes?: unknown[]; facts?: unknown[] }>('/api/v1/memories', { method: 'GET' }).catch(() => null),
      api.store.getSubscription().catch(() => null),
    ]);

    if (aiSet) {
      const modeName =
        aiSet.autonomy_mode === 'proactive' || aiSet.autonomy_mode === 'autonomous'
          ? 'Modo Proativo'
          : 'Modo Assistido';
      const toneMap: Record<string, string> = {
        balanced: 'Equilibrado',
        direct: 'Direto',
        warm: 'Caloroso',
        professional: 'Profissional',
        relaxed: 'Descontraído',
      };
      const tone = toneMap[aiSet.persona_style || 'balanced'] || 'Equilibrado';
      const foc = aiSet.auto_focus_blocks === true ? ' · Foco ativo' : '';
      setAutonomyLabel(`${modeName} · ${tone}${foc}`);
      if (aiSet.preferred_voice) {
        setVoiceLabel(aiSet.preferred_voice.toLowerCase().includes('kore') ? 'Voz Feminina' : 'Voz Masculina');
      }
    }

    let conns = 0;
    if (Array.isArray(cals) && cals.some((c) => c.status === 'active')) conns++;
    if (wa?.status === 'connected') conns++;
    if (gm?.connected) conns++;
    setConnectedAppsCount(conns);
    if (wa?.phone && !userPhone) setUserPhone(wa.phone);
    if (sess?.sessions) setSessionsCount(sess.sessions.length);

    if (mem && (Array.isArray(mem.themes) || Array.isArray(mem.facts))) {
      setMemorySummary(`${mem.themes?.length || 0} temas · ${mem.facts?.length || 0} fatos`);
    }

    if (sub && sub.plan !== 'free') {
      setPlanLabel(`Vito ${sub.plan === 'ultra' ? 'Ultra' : 'Pro'} ativo`);
      setPlanCta('Gerenciar');
    } else {
      setPlanLabel('Plano gratuito · 7 dias grátis');
      setPlanCta('Assinar');
    }
  }, [userPhone]);

  useEffect(() => {
    loadStatuses();
    aiModel.refreshAiState();
  }, [loadStatuses, aiModel.refreshAiState]);

  const handleCheckUpdate = async () => {
    setChecking(true);
    try {
      if (!Updates.isEnabled) {
        Alert.alert('Atualizações OTA', 'Ativo apenas em builds standalone.');
        return;
      }
      const res = await Updates.checkForUpdateAsync();
      if (res.isAvailable) {
        await Updates.fetchUpdateAsync();
        await Updates.reloadAsync();
      } else {
        Alert.alert('Aplicativo Atualizado', 'Você já está na versão mais recente.');
      }
    } catch {
      Alert.alert('Atualizações', 'Não foi possível verificar atualizações agora.');
    } finally {
      setChecking(false);
    }
  };

  const name = user?.name?.trim() || 'Usuário';
  const email = user?.email?.trim() || 'Sem e-mail cadastrado';
  const appVersion = (appJson as { expo?: { version?: string } })?.expo?.version ?? '1.0.0';
  const canGoBack = showBackHeader || navigation.canGoBack();

  const body = (
    <ScrollView
      style={[styles.scroll, { backgroundColor: colors.bg }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.ink} />
        ) : undefined
      }
    >
      <StaggerItem index={0}>
        <ProfileUserCard
          name={name}
          email={email}
          phone={userPhone}
          onEditPhone={() => setPhoneVisible(true)}
        />
      </StaggerItem>

      {/* Integrações -> #s-int */}
      <StaggerItem index={1} style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.hairline, marginTop: 12 }]}>
        <TouchableOpacity
          style={styles.li}
          onPress={() => navigateToScreen('integrations')}
          activeOpacity={0.75}
        >
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="extension" size={18} color={colors.blue} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.liTitle, { color: colors.ink }]}>Integrações</Text>
            <Text style={[styles.liMeta, { color: colors.muted }]}>
              {connectedAppsCount} conectadas · {Math.max(0, 7 - connectedAppsCount)} disponíveis
            </Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>
      </StaggerItem>

      {/* Comportamento & autonomia -> #s-behavior */}
      <StaggerItem index={2}>
      <Text style={[styles.lbl, { color: colors.muted }]}>Comportamento & autonomia</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
        <TouchableOpacity
          style={styles.li}
          onPress={() => navigateToScreen('behavior')}
          activeOpacity={0.75}
        >
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="tune" size={18} color={colors.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.liTitle, { color: colors.ink }]}>Autonomia e comportamento</Text>
            <Text style={[styles.liMeta, { color: colors.muted }]}>{autonomyLabel}</Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>
      </StaggerItem>

      {/* Inteligência artificial -> #s-ai + ModelPickerSheet */}
      <StaggerItem index={3}>
        <AiSection
          providers={aiModel.providers}
          defaultModelName={aiModel.defaultModelName}
          onPressProviders={() => navigateToScreen('aiProviders')}
          onPressDefaultModel={() => aiModel.setPickerVisible(true)}
        />
      </StaggerItem>

      {/* Preferências (Tema inline + Memória #s-memory + Voz #s-voice-cfg) */}
      <StaggerItem index={4}>
      <Text style={[styles.lbl, { color: colors.muted }]}>Preferências</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.hairline }]}>
        <View style={styles.li}>
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="wb-sunny" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.liTitle, { color: colors.ink }]}>Tema</Text>
          <View style={[styles.themeSeg, { backgroundColor: colors.bg }]}>
            {(['light', 'dark', 'system'] as const).map((mode) => {
              const active = themeMode === mode;
              const labels = { light: 'Claro', dark: 'Escuro', system: 'Sistema' };
              return (
                <TouchableOpacity
                  key={mode}
                  style={[styles.themeBtn, active && [styles.themeBtnActive, { backgroundColor: colors.ink }]]}
                  onPress={(e) => {
                    hapticFeedback.selection();
                    const { pageX, pageY } = e.nativeEvent;
                    setThemeMode(
                      mode,
                      typeof pageX === 'number' && typeof pageY === 'number'
                        ? { x: pageX, y: pageY }
                        : undefined
                    );
                  }}
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

        <TouchableOpacity style={styles.li} onPress={() => navigateToScreen('memory', { from: 'profile' })}>
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="psychology" size={18} color={colors.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.liTitle, { color: colors.ink }]}>Memória do Vito</Text>
            <Text style={[styles.liMeta, { color: colors.muted }]}>
              {memorySummary ? `${memorySummary} · Ver e editar` : 'Ver e editar'}
            </Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        <TouchableOpacity style={styles.li} onPress={() => navigateToScreen('voiceSettings')}>
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="record-voice-over" size={18} color={colors.ink} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.liTitle, { color: colors.ink }]}>Voz e Ativação</Text>
            <Text style={[styles.liMeta, { color: colors.muted }]}>{voiceLabel}</Text>
          </View>
          <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>
      </StaggerItem>

      {/* Sistema */}
      <StaggerItem index={5}>
      <Text style={[styles.lbl, { color: colors.muted }]}>Sistema</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        <TouchableOpacity style={styles.li} onPress={() => setDevicesVisible(true)}>
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="devices" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.liTitle, { color: colors.ink }]}>Dispositivos conectados</Text>
          <Text style={[styles.liMeta, { color: colors.muted }]}>
            {sessionsCount !== null ? `${sessionsCount} ${sessionsCount === 1 ? 'ativo' : 'ativos'}` : '1 ativo'}
          </Text>
          <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>

        <View style={[styles.divider, { backgroundColor: colors.line }]} />

        <TouchableOpacity style={styles.li} onPress={handleCheckUpdate} disabled={checking}>
          <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
            <ProtoUiIcon name="refresh" size={18} color={colors.ink} />
          </View>
          <Text style={[styles.liTitle, { color: colors.ink }]}>Atualizações</Text>
          {checking ? (
            <ActivityIndicator size="small" color={colors.ink} />
          ) : (
            <Text style={[styles.liMeta, { color: colors.muted }]}>Atualizado</Text>
          )}
          <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
        </TouchableOpacity>
      </View>
      </StaggerItem>

      {/* Conta e assinatura -> #s-store */}
      <StaggerItem index={6}>
      <Text style={[styles.lbl, { color: colors.muted }]}>Conta e assinatura</Text>
      <View style={[styles.lst, { backgroundColor: colors.surf, borderColor: colors.line }]}>
        {[
          { page: 'pro' as const, icon: 'workspace-premium' as const, title: 'Planos Pro e Ultra', sub: planLabel, right: planCta },
          { page: 'priv' as const, icon: 'verified-user' as const, title: 'Privacidade e dados', sub: 'Permissões, IA e exclusão de conta' },
          { page: 'notif' as const, icon: 'notifications-none' as const, title: 'Notificações', sub: 'Escolha o que receber' },
          { page: 'help' as const, icon: 'help-outline' as const, title: 'Ajuda e suporte', sub: 'FAQ, contato e denúncias' },
          { page: 'about' as const, icon: 'info-outline' as const, title: 'Sobre o Vito', sub: `Versão ${appVersion} · termos e licenças` },
        ].map((item, idx) => (
          <React.Fragment key={item.page}>
            {idx > 0 && <View style={[styles.divider, { backgroundColor: colors.line }]} />}
            <TouchableOpacity style={styles.li} onPress={() => navigateToStore(item.page)}>
              <View style={[styles.liIconBox, { backgroundColor: colors.bg }]}>
                <ProtoUiIcon name={item.icon} size={18} color={colors.ink} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.liTitle, { color: colors.ink }]}>{item.title}</Text>
                <Text style={[styles.liMeta, { color: colors.muted }]}>{item.sub}</Text>
              </View>
              {item.right && <Text style={[styles.liMeta, { color: colors.ink, fontWeight: '600' }]}>{item.right}</Text>}
              <ProtoUiIcon name="chevron-right" size={18} color={colors.muted} />
            </TouchableOpacity>
          </React.Fragment>
        ))}
      </View>
      </StaggerItem>

      {/* Rodapé: Trocar / Sair / Excluir conta + OTA */}
      <StaggerItem index={7}>
      <View style={styles.out}>
        <TouchableOpacity style={[styles.outBtn, { borderColor: colors.line }]} onPress={logout}>
          <Text style={[styles.outBtnText, { color: colors.ink }]}>Trocar de conta</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.outBtn, styles.outBtnDanger, { borderColor: colors.red }]}
          onPress={() => setLogoutSheetOpen(true)}
        >
          <Text style={[styles.outBtnText, { color: colors.red }]}>Encerrar sessão</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.delBtn, { borderColor: colors.red }]}
        onPress={() => navigateToStore('priv')}
      >
        <Text style={[styles.delBtnText, { color: colors.red }]}>Excluir conta</Text>
      </TouchableOpacity>

      <Text style={[styles.ver, { color: colors.muted }]}>
        Vito {appVersion} · build OTA 01a1663
      </Text>
      </StaggerItem>

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
      <ConnectedDevicesModal
        visible={devicesVisible}
        onClose={() => setDevicesVisible(false)}
        onSessionsChanged={(count) => setSessionsCount(count)}
      />
      <ModelPickerSheet
        visible={aiModel.pickerVisible}
        onClose={() => aiModel.setPickerVisible(false)}
        scopeLabel="Padrão do Vito"
        allowInherit={false}
        selectedModel={aiModel.defaultModel}
        selectedEffort={aiModel.defaultEffort}
        groups={aiModel.modelGroups}
        onSelectModel={aiModel.selectDefaultModel}
        onSelectEffort={aiModel.selectDefaultEffort}
        onManageProviders={() => {
          aiModel.setPickerVisible(false);
          navigateToScreen('aiProviders');
        }}
      />
      <VitoSheet
        visible={logoutSheetOpen}
        onClose={() => setLogoutSheetOpen(false)}
        title="Encerrar sessão?"
        subtitle="Suas conversas continuam salvas neste aparelho."
      >
        <View style={{ paddingHorizontal: 20, paddingBottom: 24, gap: 10 }}>
          <TouchableOpacity
            style={[styles.delBtn, { backgroundColor: colors.red, borderColor: colors.red }]}
            onPress={() => {
              setLogoutSheetOpen(false);
              logout();
            }}
          >
            <Text style={[styles.delBtnText, { color: '#fff' }]}>Encerrar sessão</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.outBtn, { borderColor: colors.line }]}
            onPress={() => setLogoutSheetOpen(false)}
          >
            <Text style={[styles.outBtnText, { color: colors.ink }]}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </VitoSheet>
    </ScrollView>
  );

  if (!canGoBack) return body;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.sbar}>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.bg, borderColor: colors.hairline }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Voltar"
        >
          <ProtoUiIcon name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sbarTitle, { color: colors.ink }]}>Perfil</Text>
          <Text style={[styles.sbarSub, { color: colors.muted }]}>Conta, autonomia e integrações</Text>
        </View>
      </View>
      {body}
    </SafeAreaView>
  );
};
