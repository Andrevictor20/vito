import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { hapticFeedback } from '../theme/motion';
import { api } from '../services/api';
import { navigateToScreen } from '../navigation/screensNav';
import type { AutonomyMode } from '../types';

const PERSONAS = [
  { id: 'balanced', label: 'Equilibrado', sub: 'Claro, cordial e objetivo (padrão)' },
  { id: 'direct', label: 'Direto', sub: 'Respostas concisas sem saudações redundantes' },
  { id: 'warm', label: 'Caloroso', sub: 'Empático, acolhedor e atencioso' },
  { id: 'professional', label: 'Profissional', sub: 'Formal, executivo e estruturado' },
  { id: 'relaxed', label: 'Descontraído', sub: 'Casual, bem-humorado e flexível' },
];

export const BehaviorScreen: React.FC = () => {
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [autMode, setAutMode] = useState<'assisted' | 'proactive'>('assisted');
  const [focusBlocks, setFocusBlocks] = useState(true);
  const [personaStyle, setPersonaStyle] = useState('balanced');
  const [voiceLabel, setVoiceLabel] = useState('Feminina');
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((p) => (p === msg ? '' : p)), 2200);
  };

  useEffect(() => {
    api
      .getAISettings()
      .then((s) => {
        if (s?.autonomy_mode === 'autonomous') setAutMode('proactive');
        else if (s?.autonomy_mode) setAutMode('assisted');
        if (typeof s?.auto_focus_blocks === 'boolean') setFocusBlocks(s.auto_focus_blocks);
        if (s?.persona_style) setPersonaStyle(s.persona_style);
        if (s?.preferred_voice) {
          setVoiceLabel(s.preferred_voice.toLowerCase().includes('kore') ? 'Feminina' : 'Masculina');
        }
      })
      .catch(() => {});
  }, []);

  const handleAutonomy = async (next: 'assisted' | 'proactive') => {
    hapticFeedback.selection();
    setAutMode(next);
    const mode: AutonomyMode = next === 'proactive' ? 'autonomous' : 'assisted';
    await api.updateAISettings({ autonomy_mode: mode }).catch(() => {});
    showToast(next === 'proactive' ? 'Modo Proativo ativado' : 'Modo Assistido ativado');
  };

  const handleFocusToggle = async (val: boolean) => {
    hapticFeedback.selection();
    setFocusBlocks(val);
    await api.updateAISettings({ auto_focus_blocks: val }).catch(() => {});
    showToast(val ? 'Blocos de foco ativados' : 'Blocos de foco desativados');
  };

  const handlePersona = async (id: string) => {
    hapticFeedback.selection();
    setPersonaStyle(id);
    await api.updateAISettings({ persona_style: id }).catch(() => {});
    const p = PERSONAS.find((x) => x.id === id);
    if (p) showToast(`Estilo: ${p.label}`);
  };

  const currentPersona = PERSONAS.find((p) => p.id === personaStyle) || PERSONAS[0];

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
          <Text style={[styles.h1, { color: colors.ink }]}>Autonomia do Vito</Text>
          <Text style={[styles.sub, { color: colors.muted }]}>Controle a iniciativa e o comportamento</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.seg, { backgroundColor: colors.surf }]}>
          {[
            { id: 'assisted' as const, label: 'Assistido' },
            { id: 'proactive' as const, label: 'Proativo' },
          ].map((opt) => {
            const active = autMode === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.segBtn, active && { backgroundColor: colors.ink }]}
                onPress={() => handleAutonomy(opt.id)}
              >
                <Text style={[styles.segText, { color: active ? colors.bg : colors.ink }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.desc, { color: colors.muted }]}>
          {autMode === 'assisted'
            ? 'O Vito sugere e espera seu OK antes de agir.'
            : 'O Vito resolve conflitos e reorganiza a agenda sozinho.'}
        </Text>

        <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          <View style={styles.row}>
            <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
              <MaterialIcons name="timer" size={19} color={colors.ink} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Blocos de foco</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>
                Reserva janelas livres para trabalho profundo
              </Text>
            </View>
            <Switch
              value={focusBlocks}
              onValueChange={handleFocusToggle}
              trackColor={{ false: colors.line, true: colors.acc }}
              thumbColor="#ffffff"
            />
          </View>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.ink }]}>Tom das respostas</Text>
        <View style={styles.chipsWrap}>
          {PERSONAS.map((p) => {
            const active = p.id === currentPersona.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.ink : colors.surf,
                    borderColor: active ? colors.ink : colors.line,
                  },
                ]}
                onPress={() => handlePersona(p.id)}
              >
                <Text style={[styles.chipText, { color: active ? colors.bg : colors.ink }]}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={[styles.desc, { color: colors.muted }]}>{currentPersona.sub}</Text>

        <View style={[styles.card, { backgroundColor: colors.surf, borderColor: colors.line, marginTop: 18 }]}>
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigateToScreen('voiceSettings')}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
              <MaterialIcons name="record-voice-over" size={19} color={colors.ink} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Voz</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>{voiceLabel}</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
          </TouchableOpacity>

          <View style={[styles.divider, { backgroundColor: colors.line }]} />

          <TouchableOpacity
            style={styles.row}
            onPress={() => navigateToScreen('memory', { from: 'behavior' })}
          >
            <View style={[styles.iconBox, { backgroundColor: colors.bg }]}>
              <MaterialIcons name="psychology" size={19} color={colors.ink} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.ink }]}>Memória</Text>
              <Text style={[styles.rowSub, { color: colors.muted }]}>O que o Vito sabe sobre mim</Text>
            </View>
            <MaterialIcons name="chevron-right" size={20} color={colors.muted} />
          </TouchableOpacity>
        </View>
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
  seg: { flexDirection: 'row', borderRadius: 14, padding: 3 },
  segBtn: { flex: 1, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  segText: { fontSize: 13.5, fontWeight: '600' },
  desc: { fontSize: 13, marginTop: 10, marginBottom: 16, lineHeight: 19 },
  card: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  iconBox: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  rowTitle: { fontSize: 14.5, fontWeight: '600' },
  rowSub: { fontSize: 12.5, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 62 },
  sectionLabel: { fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 10 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  toast: { position: 'absolute', bottom: 24, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  toastText: { fontSize: 13, fontWeight: '600' },
});
