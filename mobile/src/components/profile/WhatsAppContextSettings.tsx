import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { api } from '../../services/api';
import {
  WHATSAPP_CONTEXT_SCOPES,
  WHATSAPP_CONTEXT_WINDOW_SIZES,
  WhatsAppContextScope,
  WhatsAppContextPreview,
  WhatsAppDirectory,
} from '../../services/api/whatsappContextApi';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { WhatsAppMediaStatusBlock } from './WhatsAppMediaStatus';
import { WhatsAppContactNamesImport } from './WhatsAppContactNamesImport';

interface WhatsAppContextSettingsProps {
  visible: boolean;
  onClose: () => void;
}

export const WhatsAppContextSettings: React.FC<WhatsAppContextSettingsProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [scope, setScope] = useState<WhatsAppContextScope>('all');
  const [windowSize, setWindowSize] = useState(12);
  const [preview, setPreview] = useState<WhatsAppContextPreview | null>(null);
  const [directory, setDirectory] = useState<WhatsAppDirectory | null>(null);

  const loadPreview = useCallback(async () => {
    try {
      const data = await api.getWhatsAppContextPreview();
      if (data) {
        setPreview(data);
      }
    } catch (err: any) {
      console.warn('[WhatsAppContextSettings] Falha ao carregar a prévia do contexto:', err);
    }
    try {
      const dir = await api.getWhatsAppDirectory();
      if (dir) {
        setDirectory(dir);
      }
    } catch (err: any) {
      console.warn('[WhatsAppContextSettings] Falha ao carregar o diretório de conversas:', err);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.getWhatsAppContextSettings();
      if (data) {
        setScope(data.scope || 'all');
        setWindowSize(data.window_size || 12);
      }
    } catch (err: any) {
      console.warn('[WhatsAppContextSettings] Falha ao carregar preferências:', err);
      Alert.alert('Não foi possível carregar', 'Tente novamente em instantes.');
    } finally {
      setIsLoading(false);
      loadPreview();
    }
  }, [loadPreview]);

  useEffect(() => {
    if (visible) {
      loadSettings();
    }
  }, [visible, loadSettings]);

  const persist = async (nextScope: WhatsAppContextScope, nextWindow: number) => {
    const previousScope = scope;
    const previousWindow = windowSize;
    setScope(nextScope);
    setWindowSize(nextWindow);
    setIsSaving(true);
    try {
      await api.updateWhatsAppContextSettings(nextScope, nextWindow);
      loadPreview();
    } catch (err: any) {
      setScope(previousScope);
      setWindowSize(previousWindow);
      Alert.alert('Não foi possível salvar', err?.message || 'Tente novamente em instantes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePurge = () => {
    Alert.alert(
      'Limpar histórico do WhatsApp?',
      'Todas as mensagens arquivadas do WhatsApp serão apagadas. O Vito volta a não ter contexto de conversa.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.purgeWhatsAppContextMessages();
              loadPreview();
              Alert.alert('Histórico limpo', 'O Vito não tem mais contexto de conversas anteriores.');
            } catch (err: any) {
              Alert.alert('Não foi possível limpar', err?.message || 'Tente novamente em instantes.');
            }
          },
        },
      ],
    );
  };

  const activeScope = WHATSAPP_CONTEXT_SCOPES.find((s) => s.value === scope);

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Contexto do WhatsApp"
      subtitle="O quanto o Vito entende das suas conversas"
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ESCOPO</Text>

            {WHATSAPP_CONTEXT_SCOPES.map((option) => {
              const selected = option.value === scope;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionRow,
                    {
                      backgroundColor: selected ? colors.surfaceContainerHigh : colors.surfaceContainer,
                      borderColor: selected ? colors.primary : colors.outlineVariant,
                    },
                  ]}
                  onPress={() => persist(option.value, windowSize)}
                  activeOpacity={0.75}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={option.label}
                >
                  <View style={styles.optionTextCol}>
                    <Text style={[styles.optionTitle, { color: colors.onSurface }]}>{option.label}</Text>
                    <Text style={[styles.optionHint, { color: colors.onSurfaceVariant }]}>{option.hint}</Text>
                  </View>
                  {isSaving && selected ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <MaterialIcons
                      name={selected ? 'radio-button-checked' : 'radio-button-unchecked'}
                      size={20}
                      color={selected ? colors.primary : colors.outline}
                    />
                  )}
                </TouchableOpacity>
              );
            })}

            {scope !== 'off' && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: tokens.spacing.lg }]}>
                  TAMANHO DA JANELA
                </Text>
                <Text style={[styles.sectionHint, { color: colors.onSurfaceVariant }]}>
                  Quantas mensagens recentes o Vito usa para entender do que você está falando.
                </Text>
                <View style={styles.sizeRow}>
                  {WHATSAPP_CONTEXT_WINDOW_SIZES.map((size) => {
                    const selected = size === windowSize;
                    return (
                      <TouchableOpacity
                        key={size}
                        style={[
                          styles.sizeChip,
                          {
                            backgroundColor: selected ? colors.primary : colors.surfaceContainer,
                            borderColor: selected ? colors.primary : colors.outlineVariant,
                          },
                        ]}
                        onPress={() => persist(scope, size)}
                        activeOpacity={0.75}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`Janela de ${size} mensagens`}
                      >
                        <Text
                          style={[
                            styles.sizeChipText,
                            { color: selected ? colors.onPrimary : colors.onSurface },
                          ]}
                        >
                          {size}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {activeScope && (
              <Text style={[styles.footerHint, { color: colors.onSurfaceVariant }]}>
                Vale também para o chat do app e do desktop. No WhatsApp, o contexto entre conversas
                só é liberado nas suas conversas pessoais — em grupos com outras pessoas e em chats de
                terceiros, o Vito nunca usa mensagens de outros chats.
              </Text>
            )}

            {directory && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: tokens.spacing.lg }]}>
                  PENDÊNCIAS DE RESPOSTA
                </Text>
                {directory.pending.length === 0 ? (
                  <Text style={[styles.previewMeta, { color: colors.onSurfaceVariant }]}>
                    Nenhuma conversa esperando resposta.
                  </Text>
                ) : (
                  <View style={[styles.previewBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                    {directory.pending.map((c) => (
                      <View key={c.name} style={styles.pendingRow}>
                        <View style={styles.pendingHead}>
                          <Text style={[styles.previewLine, { color: colors.onSurface }]}>{c.name}</Text>
                          {!!c.age && (
                            <Text style={[styles.previewMeta, { color: colors.onSurfaceVariant }]}>{c.age}</Text>
                          )}
                        </View>
                        {!!c.preview && (
                          <Text style={[styles.sampleLine, { color: colors.onSurfaceVariant }]} numberOfLines={2}>
                            {c.preview}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                )}

                {directory.contacts.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: tokens.spacing.lg }]}>
                      SEUS CONTATOS
                    </Text>
                    <View style={[styles.previewBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                      {directory.contacts.map((c) => (
                        <View key={c.name} style={styles.pendingRow}>
                          <View style={styles.pendingHead}>
                            <Text style={[styles.previewLine, { color: colors.onSurface }]}>{c.name}</Text>
                            {!!c.age && (
                              <Text style={[styles.previewMeta, { color: colors.onSurfaceVariant }]}>{c.age}</Text>
                            )}
                          </View>
                          {!!c.preview && (
                            <Text style={[styles.sampleLine, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                              {c.preview}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </>
            )}

            {preview && (
              <>
                <Text style={[styles.sectionTitle, { color: colors.textMuted, marginTop: tokens.spacing.lg }]}>
                  O QUE O VITO ESTÁ VENDO AGORA
                </Text>
                <View style={[styles.previewBox, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
                  <Text style={[styles.previewLine, { color: colors.onSurface }]}>
                    {preview.archived_total} mensagem(ns) arquivada(s) · {preview.window_messages} na janela
                  </Text>
                  <Text style={[styles.previewMeta, { color: colors.onSurfaceVariant }]}>
                    Horizonte de {preview.max_age_days} dias · janela de {preview.window_size}
                  </Text>
                  {preview.chats.length > 0 && (
                    <View style={styles.chatChipsRow}>
                      {preview.chats.map((chat) => (
                        <View
                          key={chat}
                          style={[styles.chatChip, { backgroundColor: colors.surfaceContainerHigh }]}
                        >
                          <Text style={[styles.chatChipText, { color: colors.onSurface }]}>{chat}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {preview.sample.length > 0 && (
                    <View style={styles.sampleBlock}>
                      {preview.sample.map((line, index) => (
                        <Text
                          key={`${index}-${line.slice(0, 12)}`}
                          style={[styles.sampleLine, { color: colors.onSurfaceVariant }]}
                          numberOfLines={2}
                        >
                          • {line}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              </>
            )}

            <WhatsAppContactNamesImport onImported={loadPreview} />

            <WhatsAppMediaStatusBlock refreshKey={preview?.archived_total} />

            <TouchableOpacity
              style={[styles.dangerButton, { borderColor: colors.error }]}
              onPress={handlePurge}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Limpar histórico do WhatsApp"
            >
              <MaterialIcons name="delete-outline" size={18} color={colors.error} />
              <Text style={[styles.dangerText, { color: colors.error }]}>Limpar histórico</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scroll: {
    maxHeight: 520,
  },
  scrollContent: {
    paddingBottom: tokens.spacing.xl,
  },
  loader: {
    marginVertical: tokens.spacing.xl,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: tokens.spacing.sm,
  },
  sectionHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: tokens.spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    minHeight: 56,
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  optionHint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  sizeChip: {
    minWidth: 48,
    height: 44,
    borderRadius: tokens.radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeChipText: {
    fontSize: 15,
    fontWeight: '700',
  },
  footerHint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: tokens.spacing.lg,
  },
  previewBox: {
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.xs,
  },
  previewLine: {
    fontSize: 13,
    fontWeight: '700',
  },
  pendingRow: {
    marginBottom: tokens.spacing.sm,
  },
  pendingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacing.sm,
  },
  previewMeta: {
    fontSize: 11,
  },
  chatChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.spacing.xs,
    marginTop: tokens.spacing.xs,
  },
  chatChip: {
    borderRadius: tokens.radii.sm,
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
  },
  chatChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  sampleBlock: {
    marginTop: tokens.spacing.xs,
    gap: 3,
  },
  sampleLine: {
    fontSize: 11,
    lineHeight: 15,
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacing.sm,
    borderWidth: 1,
    borderRadius: tokens.radii.md,
    paddingVertical: tokens.spacing.md,
    marginTop: tokens.spacing.lg,
    minHeight: 48,
  },
  dangerText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
