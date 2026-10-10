import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Trigger, TriggerFrequency, TriggerStatus } from '../../types';

interface EditTriggerModalProps {
  visible: boolean;
  trigger: Trigger | null;
  onClose: () => void;
  onSave: (
    id: string,
    updates: {
      title?: string;
      query?: string;
      scheduled_time?: string;
      frequency?: TriggerFrequency;
      status?: TriggerStatus;
    }
  ) => Promise<void>;
}

export const EditTriggerModal: React.FC<EditTriggerModalProps> = ({
  visible,
  trigger,
  onClose,
  onSave,
}) => {
  const { colors, isDark } = useTheme();

  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [frequency, setFrequency] = useState<TriggerFrequency>('daily_morning');
  const [status, setStatus] = useState<TriggerStatus>('active');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trigger) {
      setTitle(trigger.title);
      setQuery(trigger.query);
      setScheduledTime(trigger.scheduled_time || '');
      setFrequency(trigger.frequency || 'daily_morning');
      setStatus(trigger.status || 'active');
      setError(null);
    }
  }, [trigger, visible]);

  if (!trigger) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError('O título do radar é obrigatório.');
      return;
    }
    if (!query.trim()) {
      setError('A instrução de monitoramento é obrigatória.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(trigger.id, {
        title: title.trim(),
        query: query.trim(),
        scheduled_time: scheduledTime.trim(),
        frequency,
        status,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const FREQUENCIES: { id: TriggerFrequency; label: string; icon: string }[] = [
    { id: 'daily_morning', label: 'Diário pela manhã (08:30)', icon: 'wb-sunny' },
    { id: 'daily_evening', label: 'Diário no fim do dia (18:00)', icon: 'nights-stay' },
    { id: 'hourly', label: 'A cada hora', icon: 'schedule' },
    { id: 'immediate', label: 'Alerta frequente (a cada 5 min)', icon: 'bolt' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />

        <View
          style={[
            styles.container,
            {
              backgroundColor: isDark ? colors.surfaceContainer : '#FFFFFF',
              borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)' },
                ]}
              >
                <MaterialIcons name="edit" size={20} color={colors.primary} />
              </View>
              <Text style={[styles.title, { color: colors.onSurface }]}>Editar Radar</Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityLabel="Fechar modal"
            >
              <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          {error && (
            <View style={styles.errorBanner}>
              <MaterialIcons name="error-outline" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Título */}
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Título</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceContainerHigh : '#F4F4F5',
                  color: colors.onSurface,
                  borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
                },
              ]}
              value={title}
              onChangeText={setTitle}
              placeholder="Ex: Cotação Dólar PTAX"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            {/* Consulta / Instrução de Acompanhamento */}
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
              O que acompanhar na web? (Linguagem natural)
            </Text>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: isDark ? colors.surfaceContainerHigh : '#F4F4F5',
                  color: colors.onSurface,
                  borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
                },
              ]}
              value={query}
              onChangeText={setQuery}
              multiline
              numberOfLines={3}
              placeholder="Ex: Acompanhe o dólar comercial e me avise se passar de R$ 5,60"
              placeholderTextColor={colors.onSurfaceVariant}
            />

            {/* Horário Específico (HH:MM) */}
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>
              Horário Exato de Verificação (Opcional - HH:MM)
            </Text>
            <View style={styles.timeInputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.timeInput,
                  {
                    backgroundColor: isDark ? colors.surfaceContainerHigh : '#F4F4F5',
                    color: colors.onSurface,
                    borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
                  },
                ]}
                value={scheduledTime}
                onChangeText={setScheduledTime}
                placeholder="Ex: 15:30 ou 09:00"
                placeholderTextColor={colors.onSurfaceVariant}
                maxLength={5}
              />
              <Text style={[styles.timeHint, { color: colors.onSurfaceVariant }]}>
                Deixe vazio para usar a frequência padrão.
              </Text>
            </View>

            {/* Frequência Padrão */}
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Frequência</Text>
            <View style={styles.frequencyGroup}>
              {FREQUENCIES.map((f) => {
                const isSelected = frequency === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.frequencyOption,
                      isSelected
                        ? [
                            styles.frequencyOptionSelected,
                            {
                              backgroundColor: isDark
                                ? 'rgba(16, 185, 129, 0.15)'
                                : '#ECFDF5',
                              borderColor: '#10B981',
                            },
                          ]
                        : [
                            styles.frequencyOptionUnselected,
                            {
                              backgroundColor: isDark ? colors.surfaceContainerHigh : '#F4F4F5',
                              borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
                            },
                          ],
                    ]}
                    onPress={() => setFrequency(f.id)}
                  >
                    <MaterialIcons
                      name={f.icon as any}
                      size={18}
                      color={isSelected ? '#10B981' : colors.onSurfaceVariant}
                    />
                    <Text
                      style={[
                        styles.frequencyLabel,
                        {
                          color: isSelected ? (isDark ? '#34D399' : '#059669') : colors.onSurface,
                          fontWeight: isSelected ? '700' : '500',
                        },
                      ]}
                    >
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Status (Ativo / Pausado) */}
            <Text style={[styles.fieldLabel, { color: colors.onSurfaceVariant }]}>Status</Text>
            <View style={styles.statusRow}>
              <TouchableOpacity
                style={[
                  styles.statusButton,
                  status === 'active'
                    ? { backgroundColor: '#10B981', borderColor: '#10B981' }
                    : {
                        backgroundColor: isDark ? colors.surfaceContainerHigh : '#F4F4F5',
                        borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
                      },
                ]}
                onPress={() => setStatus('active')}
              >
                <MaterialIcons
                  name="check-circle"
                  size={16}
                  color={status === 'active' ? '#FFFFFF' : colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.statusButtonText,
                    { color: status === 'active' ? '#FFFFFF' : colors.onSurface },
                  ]}
                >
                  Ativo
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusButton,
                  status === 'paused'
                    ? { backgroundColor: '#71717A', borderColor: '#71717A' }
                    : {
                        backgroundColor: isDark ? colors.surfaceContainerHigh : '#F4F4F5',
                        borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
                      },
                ]}
                onPress={() => setStatus('paused')}
              >
                <MaterialIcons
                  name="pause-circle-outline"
                  size={16}
                  color={status === 'paused' ? '#FFFFFF' : colors.onSurfaceVariant}
                />
                <Text
                  style={[
                    styles.statusButtonText,
                    { color: status === 'paused' ? '#FFFFFF' : colors.onSurface },
                  ]}
                >
                  Pausado
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.cancelButton,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                },
              ]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={[styles.cancelButtonText, { color: colors.onSurface }]}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, { backgroundColor: colors.primary }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialIcons name="check" size={18} color="#FFFFFF" />
                  <Text style={styles.saveButtonText}>Salvar Alterações</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  container: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    borderRadius: MD3Shapes.extraLarge,
    borderWidth: 1,
    padding: 20,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: MD3Shapes.medium,
    marginTop: 12,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  scroll: {
    marginTop: 12,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
    letterSpacing: 0.2,
  },
  input: {
    borderWidth: 1,
    borderRadius: MD3Shapes.medium,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: MD3Shapes.medium,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 74,
    textAlignVertical: 'top',
  },
  timeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeInput: {
    width: 120,
  },
  timeHint: {
    fontSize: 12,
    flex: 1,
  },
  frequencyGroup: {
    gap: 8,
  },
  frequencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 10,
  },
  frequencyOptionSelected: {},
  frequencyOptionUnselected: {},
  frequencyLabel: {
    fontSize: 14,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  statusButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 6,
  },
  statusButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: MD3Shapes.full,
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});
