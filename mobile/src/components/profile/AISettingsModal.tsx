import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
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
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { M3Switch } from '../ui/M3Switch';
import { PersonaStyleSelector } from './PersonaStyleSelector';
import { UserMemoriesModal } from './UserMemoriesModal';
import { styles } from './AISettingsModal.styles';

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
  const [personaStyle, setPersonaStyle] = useState('balanced');
  const [memoriesVisible, setMemoriesVisible] = useState(false);

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
        if (data.persona_style) {
          setPersonaStyle(data.persona_style);
        }
      }
    } catch (err: any) {
      console.warn('[AISettingsModal] Falha ao carregar configurações de IA:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectPersonaStyle = async (style: string) => {
    setPersonaStyle(style);
    await persistUpdate({ persona_style: style } as any);
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
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Autonomia do Vito"
      subtitle="Controle a iniciativa e o comportamento do assistente"
    >
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
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionTitle, { color: colors.onSurfaceVariant }]}>
                  MODO DE OPERAÇÃO
                </Text>
                {isSaving && (
                  <View style={styles.savingBadge}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={[styles.savingText, { color: colors.primary }]}>Salvando...</Text>
                  </View>
                )}
              </View>

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

              {/* Estilos Conversacionais */}
              <PersonaStyleSelector
                value={personaStyle}
                onChange={handleSelectPersonaStyle}
              />

              {/* Acesso a Memórias de Longo Prazo */}
              <TouchableOpacity
                style={[
                  styles.memoriesButton,
                  { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant },
                ]}
                onPress={() => setMemoriesVisible(true)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                  <MaterialIcons name="psychology" size={24} color={colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.optionTitle, { color: colors.onSurface }]}>
                      O que o Vito sabe sobre mim
                    </Text>
                    <Text style={[styles.optionDesc, { color: colors.onSurfaceVariant }]}>
                      Consulte e gerencie memórias, episódios e fatos aprendidos.
                    </Text>
                  </View>
                </View>
                <MaterialIcons name="chevron-right" size={20} color={colors.outline} />
              </TouchableOpacity>

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

      <UserMemoriesModal
        visible={memoriesVisible}
        onClose={() => setMemoriesVisible(false)}
      />
    </BottomSheetModal>
  );
};
