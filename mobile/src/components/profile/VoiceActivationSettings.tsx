import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import {
  voiceActivationService,
  ActivationMode,
} from '../../services/voice/voiceActivationService';

interface VoiceActivationSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export function VoiceActivationSettings({ visible, onClose }: VoiceActivationSettingsProps) {
  const { colors } = useTheme();
  const [currentMode, setCurrentMode] = useState<ActivationMode>('DISABLED');
  const [isDefault, setIsDefault] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      checkStatus();
    }
  }, [visible]);

  const checkStatus = async () => {
    const isDef = await voiceActivationService.isVitoDefaultAssistant();
    setIsDefault(isDef);
    if (isDef) {
      setCurrentMode('REPLACE_DEFAULT_ASSISTANT');
    }
  };

  const handleSelectMode = async (mode: ActivationMode) => {
    setLoading(true);
    setMessage(null);
    try {
      if (mode === 'REPLACE_DEFAULT_ASSISTANT') {
        await voiceActivationService.requestDefaultAssistantRole();
        setMessage('Abra o seletor do sistema e selecione o Vito.');
      } else {
        await voiceActivationService.setMode(mode);
        setMessage(mode === 'COEXIST_WAKE_WORD' ? 'Modo "Ei Vito" ativo em segundo plano.' : 'Ativação por voz desativada.');
      }
      setCurrentMode(mode);
      await checkStatus();
    } catch (e: any) {
      setMessage(e?.message || 'Falha ao configurar modo de voz.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.container, { backgroundColor: colors.surf, borderColor: colors.line }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <MaterialIcons name="mic" size={22} color={colors.ink} />
              <Text style={[styles.title, { color: colors.ink }]}>Ativação Global por Voz</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Escolha como prefere interagir com o Vito em qualquer tela do seu aparelho:
          </Text>

          {/* Opção 1: Modo A (Vosk Ei Vito) */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              { backgroundColor: colors.bg, borderColor: currentMode === 'COEXIST_WAKE_WORD' ? '#10B981' : colors.line },
            ]}
            onPress={() => handleSelectMode('COEXIST_WAKE_WORD')}
            activeOpacity={0.7}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.radio, currentMode === 'COEXIST_WAKE_WORD' && styles.radioActive]}>
                {currentMode === 'COEXIST_WAKE_WORD' && <View style={styles.radioDot} />}
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.ink }]}>
                  Modo 1: "Ei Vito" em 2º Plano (Vosk)
                </Text>
                <Text style={[styles.optionDesc, { color: colors.muted }]}>
                  Escuta contínua 100% offline no celular com notificação silenciosa minimizada. Mantém a IA padrão do botão Power.
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Opção 2: Modo B (Assistente Nativo) */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              { backgroundColor: colors.bg, borderColor: currentMode === 'REPLACE_DEFAULT_ASSISTANT' ? '#3B82F6' : colors.line },
            ]}
            onPress={() => handleSelectMode('REPLACE_DEFAULT_ASSISTANT')}
            activeOpacity={0.7}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.radio, currentMode === 'REPLACE_DEFAULT_ASSISTANT' && styles.radioActiveBlue]}>
                {currentMode === 'REPLACE_DEFAULT_ASSISTANT' && <View style={[styles.radioDot, { backgroundColor: '#3B82F6' }]} />}
              </View>
              <View style={styles.optionInfo}>
                <View style={styles.tagRow}>
                  <Text style={[styles.optionTitle, { color: colors.ink }]}>
                    Modo 2: Assistente Padrão do Sistema
                  </Text>
                  <View style={styles.recommendedBadge}>
                    <Text style={styles.recommendedText}>Recomendado</Text>
                  </View>
                </View>
                <Text style={[styles.optionDesc, { color: colors.muted }]}>
                  Acionado segurando o botão Liga/Desliga ou pelo gesto do canto. Zero consumo de bateria e zero notificação na barra de status.
                  {isDefault ? ' (Ativo no Android)' : ' (Toque para definir)'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Opção 3: Desativado */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              { backgroundColor: colors.bg, borderColor: currentMode === 'DISABLED' ? colors.muted : colors.line },
            ]}
            onPress={() => handleSelectMode('DISABLED')}
            activeOpacity={0.7}
          >
            <View style={styles.optionHeader}>
              <View style={[styles.radio, currentMode === 'DISABLED' && styles.radioActiveGray]}>
                {currentMode === 'DISABLED' && <View style={[styles.radioDot, { backgroundColor: colors.muted }]} />}
              </View>
              <View style={styles.optionInfo}>
                <Text style={[styles.optionTitle, { color: colors.ink }]}>Desativado</Text>
                <Text style={[styles.optionDesc, { color: colors.muted }]}>
                  Usar a voz apenas tocando no ícone de microfone dentro do aplicativo.
                </Text>
              </View>
            </View>
          </TouchableOpacity>

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.ink} size="small" />
              <Text style={[styles.loadingText, { color: colors.muted }]}>Aplicando configuração...</Text>
            </View>
          )}

          {message && (
            <Text style={[styles.feedbackMessage, { color: '#10B981' }]}>{message}</Text>
          )}

          <TouchableOpacity
            style={[styles.confirmBtn, { backgroundColor: colors.ink }]}
            onPress={onClose}
          >
            <Text style={[styles.confirmBtnText, { color: colors.bg }]}>Concluir</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    borderWidth: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    marginBottom: 20,
  },
  optionCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#71717A',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
    marginRight: 12,
  },
  radioActive: {
    borderColor: '#10B981',
  },
  radioActiveBlue: {
    borderColor: '#3B82F6',
  },
  radioActiveGray: {
    borderColor: '#A1A1AA',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10B981',
  },
  optionInfo: {
    flex: 1,
  },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  optionTitle: {
    fontSize: 14.5,
    fontWeight: '600',
    marginBottom: 4,
  },
  recommendedBadge: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  recommendedText: {
    color: '#93C5FD',
    fontSize: 10.5,
    fontWeight: '700',
  },
  optionDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 8,
  },
  loadingText: {
    fontSize: 13,
  },
  feedbackMessage: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 8,
    fontWeight: '500',
  },
  confirmBtn: {
    borderRadius: 20,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  confirmBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
});
