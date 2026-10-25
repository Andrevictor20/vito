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
import { voiceActivationService } from '../../services/voice/voiceActivationService';

interface VoiceActivationSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export function VoiceActivationSettings({ visible, onClose }: VoiceActivationSettingsProps) {
  const { colors } = useTheme();
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
  };

  const handleRequestRole = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await voiceActivationService.requestDefaultAssistantRole();
      setMessage('Selecione o Vito na lista de assistentes do Android.');
      await checkStatus();
    } catch (e: any) {
      setMessage(e?.message || 'Falha ao solicitar permissão de assistente.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSettings = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await voiceActivationService.openAssistantSettings();
      setMessage('Ajuste o app de assistência padrão nas configurações.');
    } catch (e: any) {
      setMessage(e?.message || 'Falha ao abrir configurações do sistema.');
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
              <MaterialIcons name="assistant" size={22} color={colors.ink} />
              <Text style={[styles.title, { color: colors.ink }]}>Assistente Digital Android</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialIcons name="close" size={20} color={colors.muted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: colors.muted }]}>
            Use o Vito a qualquer momento segurando o botão Liga/Desliga ou com o gesto do canto da tela.
          </Text>

          {/* Card de Status */}
          <View
            style={[
              styles.statusCard,
              {
                backgroundColor: colors.bg,
                borderColor: isDefault ? '#10B981' : colors.line,
              },
            ]}
          >
            <View style={styles.statusHeader}>
              <View
                style={[
                  styles.statusIconBox,
                  { backgroundColor: isDefault ? 'rgba(16, 185, 129, 0.15)' : 'rgba(161, 161, 170, 0.15)' },
                ]}
              >
                <MaterialIcons
                  name={isDefault ? 'check-circle' : 'radio-button-unchecked'}
                  size={24}
                  color={isDefault ? '#10B981' : colors.muted}
                />
              </View>
              <View style={styles.statusInfo}>
                <View style={styles.badgeRow}>
                  <Text style={[styles.statusTitle, { color: colors.ink }]}>
                    {isDefault ? 'Vito é seu Assistente Padrão' : 'Assistente Não Configurado'}
                  </Text>
                  {isDefault && (
                    <View style={styles.activeBadge}>
                      <Text style={styles.activeBadgeText}>ATIVO</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.statusDesc, { color: colors.muted }]}>
                  {isDefault
                    ? 'Pronto para uso! Segure o botão Power de qualquer lugar para falar com o Vito.'
                    : 'Defina o Vito como seu aplicativo de assistência padrão no sistema Android.'}
                </Text>
              </View>
            </View>
          </View>

          {/* Seção Explicativa: Como Funciona */}
          <View style={[styles.infoBox, { backgroundColor: colors.bg, borderColor: colors.line }]}>
            <View style={styles.infoRow}>
              <MaterialIcons name="battery-charging-full" size={18} color="#10B981" />
              <Text style={[styles.infoText, { color: colors.ink }]}>
                <Text style={styles.bold}>Zero bateria em segundo plano:</Text> O Vito só acorda quando você aciona o botão, sem microfone ouvindo 24/7.
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="security" size={18} color="#3B82F6" />
              <Text style={[styles.infoText, { color: colors.ink }]}>
                <Text style={styles.bold}>Privacidade total:</Text> Sem ponto verde de microfone na barra de notificações quando em repouso.
              </Text>
            </View>
            <View style={styles.infoRow}>
              <MaterialIcons name="touch-app" size={18} color="#8B5CF6" />
              <Text style={[styles.infoText, { color: colors.ink }]}>
                <Text style={styles.bold}>Acesso instantâneo:</Text> Funciona sobre qualquer aplicativo ou com a tela bloqueada.
              </Text>
            </View>
          </View>

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.ink} size="small" />
              <Text style={[styles.loadingText, { color: colors.muted }]}>Verificando com o sistema...</Text>
            </View>
          )}

          {message && (
            <Text style={[styles.feedbackMessage, { color: isDefault ? '#10B981' : '#3B82F6' }]}>{message}</Text>
          )}

          {/* Botões de Ação */}
          <View style={styles.actionsContainer}>
            {!isDefault ? (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: colors.ink }]}
                onPress={handleRequestRole}
                disabled={loading}
              >
                <MaterialIcons name="stars" size={18} color={colors.bg} style={{ marginRight: 6 }} />
                <Text style={[styles.primaryBtnText, { color: colors.bg }]}>Definir como Assistente Padrão</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: '#10B981' }]}
                onPress={checkStatus}
                disabled={loading}
              >
                <MaterialIcons name="refresh" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>Atualizar Status</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: colors.line }]}
              onPress={handleOpenSettings}
              disabled={loading}
            >
              <Text style={[styles.secondaryBtnText, { color: colors.ink }]}>Abrir Configurações do Android</Text>
            </TouchableOpacity>
          </View>
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
    marginBottom: 18,
  },
  statusCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  statusIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  statusInfo: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  activeBadge: {
    backgroundColor: '#064E3B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  activeBadgeText: {
    color: '#6EE7B7',
    fontSize: 10,
    fontWeight: '800',
  },
  statusDesc: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  infoBox: {
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    gap: 10,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  infoText: {
    fontSize: 12.5,
    lineHeight: 17,
    flex: 1,
  },
  bold: {
    fontWeight: '700',
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: 6,
  },
  loadingText: {
    fontSize: 13,
  },
  feedbackMessage: {
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 6,
    fontWeight: '500',
  },
  actionsContainer: {
    gap: 10,
    marginTop: 8,
  },
  primaryBtn: {
    borderRadius: 20,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    fontSize: 14.5,
    fontWeight: '700',
  },
  secondaryBtn: {
    borderRadius: 20,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtnText: {
    fontSize: 13.5,
    fontWeight: '600',
  },
});
