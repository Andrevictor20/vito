import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import { AutonomyMode, AISettings } from '../../types';
import { M3Switch } from '../ui/M3Switch';

interface AISettingsModalProps {
  visible: boolean;
  onClose: () => void;
  onSettingsUpdated?: (settings: AISettings) => void;
}

export const AISettingsModal: React.FC<AISettingsModalProps> = ({
  visible,
  onClose,
  onSettingsUpdated,
}) => {
  const { colors, isDark } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [autonomyMode, setAutonomyMode] = useState<AutonomyMode>('assisted');
  const [autoFocusBlocks, setAutoFocusBlocks] = useState(false);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible]);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAISettings();
      if (data) {
        setAutonomyMode(data.autonomy_mode || 'assisted');
        setAutoFocusBlocks(Boolean(data.auto_focus_blocks));
      }
    } catch (err: any) {
      console.warn('[AISettingsModal] Falha ao carregar configurações de IA:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectMode = async (mode: AutonomyMode) => {
    if (mode === autonomyMode) return;
    setAutonomyMode(mode);
    await persistUpdate({ autonomy_mode: mode });
  };

  const handleToggleFocusBlocks = async (value: boolean) => {
    setAutoFocusBlocks(value);
    await persistUpdate({ auto_focus_blocks: value });
  };

  const persistUpdate = async (patch: {
    autonomy_mode?: AutonomyMode;
    auto_focus_blocks?: boolean;
  }) => {
    setIsSaving(true);
    try {
      const updated = await api.updateAISettings(patch);
      onSettingsUpdated?.(updated);
    } catch (err: any) {
      console.warn('[AISettingsModal] Erro ao salvar configurações de IA:', err);
      Alert.alert(
        'Falha ao Salvar',
        'Não foi possível atualizar as preferências de autonomia. Verifique sua conexão e tente novamente.'
      );
      // Recarrega valores atuais do servidor em caso de erro
      loadSettings();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View
          style={[
            styles.modalContainer,
            { backgroundColor: colors.surface, borderColor: colors.outlineVariant },
          ]}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIconBox, { backgroundColor: colors.surfaceContainerHigh }]}>
                <MaterialIcons name="psychology" size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={[styles.title, { color: colors.onSurface }]}>
                  Autonomia do Vito
                </Text>
                <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
                  Controle a iniciativa e o comportamento do assistente
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.closeBtn, { backgroundColor: colors.surfaceContainerHigh }]}
              accessibilityLabel="Fechar configurações de IA"
            >
              <MaterialIcons name="close" size={20} color={colors.onSurface} />
            </TouchableOpacity>
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.onSurfaceVariant }]}>
                Carregando preferências de IA...
              </Text>
            </View>
          ) : (
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Status Banner */}
              <View
                style={[
                  styles.statusBanner,
                  {
                    backgroundColor: colors.surfaceContainer,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.bannerRow}>
                  <MaterialIcons
                    name={autonomyMode === 'proactive' ? 'bolt' : 'verified-user'}
                    size={18}
                    color={colors.primary}
                  />
                  <Text style={[styles.bannerTitle, { color: colors.onSurface }]}>
                    Nível Atual: {autonomyMode === 'proactive' ? 'Modo Proativo' : 'Modo Assistido'}
                  </Text>
                  {isSaving && (
                    <View style={styles.savingBadge}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.savingText, { color: colors.primary }]}>Salvando</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.bannerDesc, { color: colors.onSurfaceVariant }]}>
                  {autonomyMode === 'proactive'
                    ? 'O Vito resolve conflitos, sugere blocos de foco e reorganiza a rotina com autonomia executiva.'
                    : 'O Vito atua como secretário estrito, solicitando sua aprovação antes de qualquer alteração na agenda.'}
                </Text>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
                MODO DE OPERAÇÃO
              </Text>

              {/* OPÇÃO 1: MODO ASSISTIDO */}
              <TouchableOpacity
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: colors.surfaceContainer,
                    borderColor:
                      autonomyMode === 'assisted' ? colors.primary : colors.outlineVariant,
                    borderWidth: autonomyMode === 'assisted' ? 2 : 1,
                  },
                ]}
                onPress={() => handleSelectMode('assisted')}
                activeOpacity={0.7}
              >
                <View style={styles.modeCardHeader}>
                  <View style={styles.modeCardHeaderLeft}>
                    <View
                      style={[
                        styles.modeIconBox,
                        {
                          backgroundColor:
                            autonomyMode === 'assisted'
                              ? colors.primary + '18'
                              : colors.surfaceContainerHigh,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name="handshake"
                        size={22}
                        color={autonomyMode === 'assisted' ? colors.primary : colors.onSurfaceVariant}
                      />
                    </View>
                    <View>
                      <View style={styles.titleBadgeRow}>
                        <Text style={[styles.modeTitle, { color: colors.onSurface }]}>
                          Modo Assistido
                        </Text>
                        <View
                          style={[
                            styles.pillBadge,
                            { backgroundColor: colors.surfaceContainerHighest },
                          ]}
                        >
                          <Text style={[styles.pillBadgeText, { color: colors.onSurfaceVariant }]}>
                            Recomendado
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.modeSub, { color: colors.onSurfaceVariant }]}>
                        Confirmação estrita passo a passo
                      </Text>
                    </View>
                  </View>

                  <MaterialIcons
                    name={
                      autonomyMode === 'assisted'
                        ? 'radio-button-checked'
                        : 'radio-button-unchecked'
                    }
                    size={22}
                    color={autonomyMode === 'assisted' ? colors.primary : colors.outline}
                  />
                </View>

                <Text style={[styles.modeDescription, { color: colors.onSurfaceVariant }]}>
                  O Vito sugere reorganizações e sempre aguarda sua autorização explícita antes de
                  marcar, reagendar ou cancelar compromissos e tarefas.
                </Text>

                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="check" size={14} color={colors.primary} />
                    <Text style={[styles.featureText, { color: colors.onSurfaceVariant }]}>
                      Total controle e previsibilidade sobre sua agenda
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="check" size={14} color={colors.primary} />
                    <Text style={[styles.featureText, { color: colors.onSurfaceVariant }]}>
                      Perfeito para quem prefere validar cada decisão
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* OPÇÃO 2: MODO PROATIVO */}
              <TouchableOpacity
                style={[
                  styles.modeCard,
                  {
                    backgroundColor: colors.surfaceContainer,
                    borderColor:
                      autonomyMode === 'proactive' ? colors.primary : colors.outlineVariant,
                    borderWidth: autonomyMode === 'proactive' ? 2 : 1,
                  },
                ]}
                onPress={() => handleSelectMode('proactive')}
                activeOpacity={0.7}
              >
                <View style={styles.modeCardHeader}>
                  <View style={styles.modeCardHeaderLeft}>
                    <View
                      style={[
                        styles.modeIconBox,
                        {
                          backgroundColor:
                            autonomyMode === 'proactive'
                              ? colors.primary + '18'
                              : colors.surfaceContainerHigh,
                        },
                      ]}
                    >
                      <MaterialIcons
                        name="auto-awesome"
                        size={22}
                        color={autonomyMode === 'proactive' ? colors.primary : colors.onSurfaceVariant}
                      />
                    </View>
                    <View>
                      <View style={styles.titleBadgeRow}>
                        <Text style={[styles.modeTitle, { color: colors.onSurface }]}>
                          Modo Proativo
                        </Text>
                        <View
                          style={[
                            styles.pillBadge,
                            { backgroundColor: colors.primary + '20' },
                          ]}
                        >
                          <Text style={[styles.pillBadgeText, { color: colors.primary }]}>
                            Executivo
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.modeSub, { color: colors.onSurfaceVariant }]}>
                        Resolução autônoma & otimização contínua
                      </Text>
                    </View>
                  </View>

                  <MaterialIcons
                    name={
                      autonomyMode === 'proactive'
                        ? 'radio-button-checked'
                        : 'radio-button-unchecked'
                    }
                    size={22}
                    color={autonomyMode === 'proactive' ? colors.primary : colors.outline}
                  />
                </View>

                <Text style={[styles.modeDescription, { color: colors.onSurfaceVariant }]}>
                  O Vito toma a iniciativa de um secretário executivo sênior: resolve conflitos de
                  horários menores, reorganiza pendências e antecipa necessidades sem atrito.
                </Text>

                <View style={styles.featuresList}>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="check" size={14} color={colors.primary} />
                    <Text style={[styles.featureText, { color: colors.onSurfaceVariant }]}>
                      Menor esforço cognitivo no dia a dia
                    </Text>
                  </View>
                  <View style={styles.featureItem}>
                    <MaterialIcons name="check" size={14} color={colors.primary} />
                    <Text style={[styles.featureText, { color: colors.onSurfaceVariant }]}>
                      Resolução ágil de sobreposições e reorganização
                    </Text>
                  </View>
                </View>
              </TouchableOpacity>

              <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
                RECURSOS PROATIVOS
              </Text>

              {/* CARD: BLOCOS DE FOCO AUTOMÁTICOS */}
              <View
                style={[
                  styles.optionCard,
                  {
                    backgroundColor: colors.surfaceContainer,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.optionRow}>
                  <View style={styles.optionLeft}>
                    <View
                      style={[
                        styles.optionIconBox,
                        { backgroundColor: colors.surfaceContainerHigh },
                      ]}
                    >
                      <MaterialIcons name="timer" size={20} color={colors.primary} />
                    </View>
                    <View style={styles.optionTexts}>
                      <Text style={[styles.optionTitle, { color: colors.onSurface }]}>
                        Blocos de Foco Automáticos
                      </Text>
                      <Text style={[styles.optionDesc, { color: colors.onSurfaceVariant }]}>
                        Detecta janelas vagas na agenda e sugere ou reserva blocos ininterruptos para trabalho profundo (Deep Work).
                      </Text>
                    </View>
                  </View>
                  <M3Switch
                    value={autoFocusBlocks}
                    onValueChange={handleToggleFocusBlocks}
                    disabled={isSaving}
                  />
                </View>
              </View>

              {/* Nota de rodapé de segurança e privacidade */}
              <View style={styles.footerNote}>
                <MaterialIcons name="security" size={14} color={colors.outline} />
                <Text style={[styles.footerNoteText, { color: colors.outline }]}>
                  Mesmo no Modo Proativo, exclusões permanentes ou ações críticas continuam exigindo
                  sua confirmação deliberada.
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    minHeight: '60%',
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  headerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 11,
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
    paddingBottom: 40,
  },
  statusBanner: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerTitle: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savingText: {
    fontSize: 11,
    fontWeight: '600',
  },
  bannerDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  modeCard: {
    padding: 16,
    borderRadius: 16,
    gap: 10,
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  modeCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  modeIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  pillBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  pillBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  modeSub: {
    fontSize: 11,
    marginTop: 2,
  },
  modeDescription: {
    fontSize: 12,
    lineHeight: 18,
  },
  featuresList: {
    gap: 6,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  featureText: {
    fontSize: 11,
  },
  optionCard: {
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  optionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTexts: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 13,
    fontWeight: '600',
  },
  optionDesc: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 6,
    marginTop: 4,
  },
  footerNoteText: {
    fontSize: 11,
    lineHeight: 15,
    flex: 1,
  },
});
