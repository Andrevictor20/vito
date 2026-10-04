import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Event } from '../../types';
import { parseSafeDate } from '../../utils/calendarDateUtils';

interface EditEventModalProps {
  visible: boolean;
  onClose: () => void;
  event: Event | null;
  onSave: (id: string, data: Partial<Event> & { update_series?: boolean }) => Promise<any>;
  onDelete: (id: string, allSeries?: boolean) => Promise<void>;
}

export const EditEventModal: React.FC<EditEventModalProps> = ({
  visible,
  onClose,
  event,
  onSave,
  onDelete,
}) => {
  const { colors, isDark } = useTheme();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startHour, setStartHour] = useState('08:00');
  const [endHour, setEndHour] = useState('09:00');
  const [updateSeries, setUpdateSeries] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const isRecurring = Boolean(event?.is_recurring || event?.recurrence);

  useEffect(() => {
    if (event) {
      setTitle(event.title || '');
      setDescription(event.description || '');
      setLocation(event.location || '');
      setUpdateSeries(isRecurring);
      setDeleteDialogVisible(false);

      try {
        const dStart = parseSafeDate(event.start_at);
        const sh = String(dStart.getHours()).padStart(2, '0');
        const sm = String(dStart.getMinutes()).padStart(2, '0');
        setStartHour(`${sh}:${sm}`);

        if (event.end_at) {
          const dEnd = parseSafeDate(event.end_at);
          const eh = String(dEnd.getHours()).padStart(2, '0');
          const em = String(dEnd.getMinutes()).padStart(2, '0');
          setEndHour(`${eh}:${em}`);
        } else {
          setEndHour(`${String(dStart.getHours() + 1).padStart(2, '0')}:${sm}`);
        }
      } catch {
        setStartHour('08:00');
        setEndHour('09:00');
      }
    }
  }, [event, isRecurring]);

  if (!event) return null;

  const handleSave = async () => {
    if (!title.trim() || !event) return;
    setSaving(true);
    try {
      const baseStart = parseSafeDate(event.start_at);
      const [sh, sm] = startHour.split(':').map((v) => parseInt(v, 10) || 0);
      const newStart = new Date(baseStart);
      newStart.setHours(sh, sm, 0, 0);

      const [eh, em] = endHour.split(':').map((v) => parseInt(v, 10) || 0);
      const newEnd = new Date(baseStart);
      newEnd.setHours(eh, em, 0, 0);

      await onSave(event.id, {
        title: title.trim(),
        description: description.trim(),
        location: location.trim(),
        start_at: newStart.toISOString(),
        end_at: newEnd.toISOString(),
        update_series: isRecurring ? updateSeries : false,
      });
      onClose();
    } catch (e: any) {
      Alert.alert('Erro ao Salvar', e?.message || 'Falha ao atualizar o evento.');
    } finally {
      setSaving(false);
    }
  };

  const executeDelete = async (allSeries: boolean) => {
    if (!event) return;
    setDeleting(true);
    try {
      await onDelete(event.id, allSeries);
      setDeleteDialogVisible(false);
      onClose();
    } catch (e: any) {
      Alert.alert('Erro ao Excluir', e?.message || 'Falha ao remover o evento.');
    } finally {
      setDeleting(false);
    }
  };

  const handleDeleteInitial = () => {
    if (isRecurring) {
      setDeleteDialogVisible(true);
    } else {
      Alert.alert('Excluir Compromisso', `Deseja realmente remover '${event.title}'?`, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir', style: 'destructive', onPress: () => executeDelete(false) },
      ]);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              {/* Header do Modal */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text style={[styles.title, { color: colors.onSurface }]}>Editar Compromisso</Text>
                  {isRecurring && (
                    <View style={[styles.recurringBadge, { backgroundColor: isDark ? '#1E293B' : '#E0F2FE', borderColor: colors.primary }]}>
                      <MaterialIcons name="repeat" size={13} color={colors.primary} />
                      <Text style={[styles.recurringBadgeText, { color: colors.primary }]}>Série Recorrente</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity onPress={onClose} hitSlop={tokens.hitSlop.sm} accessibilityLabel="Fechar">
                  <MaterialIcons name="close" size={20} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Título */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Título do compromisso</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant,
                        color: colors.onSurface,
                      },
                    ]}
                    placeholder="Ex: Aula de inglês..."
                    placeholderTextColor={colors.textMuted}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>

                {/* Horários: Início e Fim */}
                <View style={styles.row}>
                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Início (HH:MM)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.surfaceContainerLow,
                          borderColor: colors.outlineVariant,
                          color: colors.onSurface,
                        },
                      ]}
                      placeholder="08:00"
                      placeholderTextColor={colors.textMuted}
                      value={startHour}
                      onChangeText={setStartHour}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>

                  <View style={[styles.fieldGroup, { flex: 1 }]}>
                    <Text style={[styles.label, { color: colors.textSecondary }]}>Término (HH:MM)</Text>
                    <TextInput
                      style={[
                        styles.input,
                        {
                          backgroundColor: colors.surfaceContainerLow,
                          borderColor: colors.outlineVariant,
                          color: colors.onSurface,
                        },
                      ]}
                      placeholder="10:00"
                      placeholderTextColor={colors.textMuted}
                      value={endHour}
                      onChangeText={setEndHour}
                      keyboardType="numbers-and-punctuation"
                    />
                  </View>
                </View>

                {/* Localização */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Local (opcional)</Text>
                  <TextInput
                    style={[
                      styles.input,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant,
                        color: colors.onSurface,
                      },
                    ]}
                    placeholder="Ex: Online / Google Meet / Sala 4"
                    placeholderTextColor={colors.textMuted}
                    value={location}
                    onChangeText={setLocation}
                  />
                </View>

                {/* Descrição */}
                <View style={styles.fieldGroup}>
                  <Text style={[styles.label, { color: colors.textSecondary }]}>Descrição ou observações</Text>
                  <TextInput
                    style={[
                      styles.input,
                      styles.textArea,
                      {
                        backgroundColor: colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant,
                        color: colors.onSurface,
                      },
                    ]}
                    placeholder="Adicione notas ou tópicos..."
                    placeholderTextColor={colors.textMuted}
                    value={description}
                    onChangeText={setDescription}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                {/* Opções de Escopo de Edição para Eventos Recorrentes */}
                {isRecurring && (
                  <View style={[styles.scopeBox, { backgroundColor: colors.surfaceContainerLow, borderColor: colors.outlineVariant }]}>
                    <Text style={[styles.scopeTitle, { color: colors.onSurface }]}>Aplicar alterações em:</Text>
                    <View style={styles.scopeOptionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.scopeChip,
                          {
                            backgroundColor: updateSeries ? colors.primaryContainer : colors.surfaceContainer,
                            borderColor: updateSeries ? colors.primary : colors.outlineVariant,
                          },
                        ]}
                        onPress={() => setUpdateSeries(true)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name="repeat"
                          size={14}
                          color={updateSeries ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.scopeChipText,
                            {
                              color: updateSeries ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                              fontWeight: updateSeries ? '700' : '500',
                            },
                          ]}
                        >
                          Toda a série
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.scopeChip,
                          {
                            backgroundColor: !updateSeries ? colors.primaryContainer : colors.surfaceContainer,
                            borderColor: !updateSeries ? colors.primary : colors.outlineVariant,
                          },
                        ]}
                        onPress={() => setUpdateSeries(false)}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons
                          name="event"
                          size={14}
                          color={!updateSeries ? colors.onPrimaryContainer : colors.onSurfaceVariant}
                        />
                        <Text
                          style={[
                            styles.scopeChipText,
                            {
                              color: !updateSeries ? colors.onPrimaryContainer : colors.onSurfaceVariant,
                              fontWeight: !updateSeries ? '700' : '500',
                            },
                          ]}
                        >
                          Apenas este
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Diálogo Interno de Exclusão para Séries Recorrentes */}
                {deleteDialogVisible && (
                  <View style={[styles.deleteDialogBox, { backgroundColor: isDark ? '#2D1515' : '#FEE2E2', borderColor: colors.error }]}>
                    <View style={styles.deleteDialogHeader}>
                      <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                      <Text style={[styles.deleteDialogTitle, { color: colors.error }]}>
                        Como deseja excluir este compromisso?
                      </Text>
                    </View>
                    <Text style={[styles.deleteDialogText, { color: isDark ? '#FECACA' : '#991B1B' }]}>
                      Este evento faz parte de uma série recorrente. Você pode remover apenas esta ocorrência ou cancelar toda a série.
                    </Text>
                    <View style={styles.deleteDialogButtons}>
                      <TouchableOpacity
                        style={[styles.deleteDialogBtn, { backgroundColor: colors.surfaceContainerHigh }]}
                        onPress={() => executeDelete(false)}
                        disabled={deleting}
                      >
                        <Text style={[styles.deleteDialogBtnText, { color: colors.onSurface }]}>Apenas este</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.deleteDialogBtn, { backgroundColor: colors.error }]}
                        onPress={() => executeDelete(true)}
                        disabled={deleting}
                      >
                        <Text style={[styles.deleteDialogBtnText, { color: '#FFFFFF', fontWeight: '700' }]}>
                          Toda a série
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}
              </ScrollView>

              {/* Footer com Ações */}
              <View style={[styles.footer, { borderTopColor: colors.outlineVariant }]}>
                <TouchableOpacity
                  style={[styles.deleteActionBtn, { borderColor: colors.outlineVariant }]}
                  onPress={handleDeleteInitial}
                  disabled={saving || deleting}
                  activeOpacity={0.7}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color={colors.error} />
                  ) : (
                    <>
                      <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                      <Text style={[styles.deleteActionText, { color: colors.error }]}>Excluir</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.footerRight}>
                  <TouchableOpacity
                    style={[styles.cancelBtn, { borderColor: colors.outlineVariant }]}
                    onPress={onClose}
                    disabled={saving || deleting}
                  >
                    <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.saveBtn, { backgroundColor: colors.primary }, !title.trim() && { opacity: 0.5 }]}
                    onPress={handleSave}
                    disabled={!title.trim() || saving || deleting}
                    activeOpacity={0.85}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color={colors.onPrimary} />
                    ) : (
                      <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Salvar</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: tokens.spacing.md,
  },
  card: {
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.md,
    paddingBottom: tokens.spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  title: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
  },
  recurringBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  recurringBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: tokens.spacing.md,
    paddingBottom: tokens.spacing.md,
    gap: tokens.spacing.sm,
  },
  fieldGroup: {
    gap: 4,
  },
  label: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: '500',
  },
  input: {
    borderRadius: MD3Shapes.medium,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    fontSize: tokens.typography.size.bodyMedium,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  scopeBox: {
    padding: tokens.spacing.sm + 2,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    marginTop: 4,
    gap: 8,
  },
  scopeTitle: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: '600',
  },
  scopeOptionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scopeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  scopeChipText: {
    fontSize: tokens.typography.size.labelSmall,
  },
  deleteDialogBox: {
    padding: tokens.spacing.md,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    marginTop: 8,
    gap: 8,
  },
  deleteDialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteDialogTitle: {
    fontSize: tokens.typography.size.labelLarge,
    fontWeight: '700',
  },
  deleteDialogText: {
    fontSize: tokens.typography.size.bodySmall,
    lineHeight: 18,
  },
  deleteDialogButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 4,
  },
  deleteDialogBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
  },
  deleteDialogBtnText: {
    fontSize: tokens.typography.size.labelMedium,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderTopWidth: 1,
  },
  deleteActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: MD3Shapes.full,
    borderWidth: 1,
  },
  deleteActionText: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: '600',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: MD3Shapes.full,
  },
  cancelBtnText: {
    fontSize: tokens.typography.size.labelMedium,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: MD3Shapes.full,
  },
  saveBtnText: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: '700',
  },
});
