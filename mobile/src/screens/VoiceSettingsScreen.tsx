import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { voiceActivationService } from '../services/voice/voiceActivationService';
import { VoiceSelector } from '../components/profile/VoiceSelector';
import { navigateToTab } from '../navigation/screensNav';

export const VoiceSettingsScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [selectedVoice, setSelectedVoice] = useState<'puck' | 'kore'>('kore');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((p) => (p === msg ? '' : p)), 2400);
  };

  const checkStatus = async () => {
    const def = await voiceActivationService.isVitoDefaultAssistant().catch(() => false);
    setIsDefault(def);
  };

  useEffect(() => {
    checkStatus();
    api
      .getAISettings()
      .then((s) => {
        if (s?.preferred_voice) {
          const v = s.preferred_voice.toLowerCase();
          setSelectedVoice(v.includes('kore') || v.includes('female') ? 'kore' : 'puck');
        }
      })
      .catch(() => {});
  }, []);

  const handleVoiceChange = async (voice: 'puck' | 'kore') => {
    hapticFeedback.selection();
    setSelectedVoice(voice);
    await api.updateAISettings({ preferred_voice: voice }).catch(() => {});
    showToast(`Voz atualizada: ${voice === 'kore' ? 'Feminina (Kore)' : 'Masculina (Puck)'}`);
  };

  const handleRequestRole = async () => {
    setLoading(true);
    try {
      await voiceActivationService.requestDefaultAssistantRole();
      await checkStatus();
      showToast('Assistente padrão verificado');
    } catch {
      showToast('Selecione o Vito nas configurações do Android');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = async () => {
    setLoading(true);
    try {
      await voiceActivationService.openAssistantSettings();
    } catch {
      showToast('Abrindo configurações de Assistente do Android');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={[styles.sbar, { borderBottomColor: colors.line }]}>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.surf, borderColor: colors.line }]}
          onPress={() => navigation.goBack()}
          accessibilityLabel="Voltar"
        >
          <MaterialIcons name="arrow-back" size={20} color={colors.ink} />
        </TouchableOpacity>
        <View style={styles.ttl}>
          <Text style={[styles.h1, { color: colors.ink }]}>Voz e Ativação</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>Voz neural e assistente Android</Text>
        </View>
        <TouchableOpacity
          style={[styles.rb, { backgroundColor: colors.surf, borderColor: colors.line }]}
          onPress={() => {
            navigation.goBack();
            navigateToTab('chat');
          }}
          accessibilityLabel="Testar conversa por voz"
        >
          <MaterialIcons name="mic" size={20} color={colors.ink} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <VoiceSelector value={selectedVoice} onChange={handleVoiceChange} />

        <Text style={[styles.sectionLabel, { color: colors.muted }]}>Atalho no aparelho</Text>
        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: colors.surf,
              borderColor: isDefault ? colors.acc : colors.line,
            },
          ]}
        >
          <View style={styles.statusRow}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: isDefault ? colors.greenBg : colors.bg },
              ]}
            >
              <MaterialIcons
                name={isDefault ? 'check-circle' : 'radio-button-unchecked'}
                size={22}
                color={isDefault ? colors.acc : colors.muted}
              />
            </View>
            <View style={styles.statusInfo}>
              <View style={styles.titleRow}>
                <Text style={[styles.statusTitle, { color: colors.ink }]}>
                  {isDefault ? 'Assistente padrão' : 'Assistente não configurado'}
                </Text>
                {isDefault && (
                  <View style={[styles.okBadge, { backgroundColor: colors.greenBg }]}>
                    <Text style={[styles.okBadgeText, { color: colors.acc }]}>Ativo</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.statusDesc, { color: colors.muted }]}>
                {isDefault
                  ? 'Segure o botão Liga/Desliga de qualquer tela para falar com o Vito. Sem microfone em segundo plano.'
                  : 'Ative o Vito nas configurações do Android para chamá-lo de qualquer tela.'}
              </Text>
            </View>
          </View>
        </View>

        {loading && <ActivityIndicator style={{ marginVertical: 12 }} color={colors.ink} />}

        {!isDefault && (
          <TouchableOpacity
            style={[styles.priBtn, { backgroundColor: colors.ink }]}
            onPress={handleRequestRole}
            disabled={loading}
          >
            <MaterialIcons name="sync" size={18} color={colors.bg} />
            <Text style={[styles.priBtnText, { color: colors.bg }]}>
              Ativar como assistente padrão
            </Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.secBtn, { backgroundColor: colors.surf, borderColor: colors.line }]}
          onPress={handleOpenSettings}
          disabled={loading}
        >
          <Text style={[styles.secBtnText, { color: colors.ink }]}>Configurações do Android</Text>
        </TouchableOpacity>
      </ScrollView>

      {!!toast && (
        <View style={[styles.toast, { backgroundColor: colors.ink }]}>
          <Text style={[styles.toastText, { color: colors.bg }]}>{toast}</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  sbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rb: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  ttl: { flex: 1 },
  h1: { fontSize: 22, fontWeight: '600', letterSpacing: -0.4 },
  sub: { fontSize: 12.5, marginTop: 1 },
  content: { padding: 16, paddingBottom: 60 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 22, marginBottom: 8 },
  statusCard: { borderRadius: 20, borderWidth: 1, padding: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  statusIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  statusInfo: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusTitle: { fontSize: 15, fontWeight: '600' },
  okBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  okBadgeText: { fontSize: 11, fontWeight: '600' },
  statusDesc: { fontSize: 13, marginTop: 4, lineHeight: 19 },
  priBtn: {
    height: 48,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  priBtnText: { fontSize: 14.5, fontWeight: '600' },
  secBtn: {
    height: 46,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  secBtnText: { fontSize: 14, fontWeight: '600' },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  toastText: { fontSize: 13, fontWeight: '600' },
});
