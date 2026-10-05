import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';

import { NotificationPriority } from '../../types';

interface CreateItemModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  events?: import('../../types').Event[];
  onSaveEvent?: (title: string, priority?: NotificationPriority) => void;
  onSaveTodo?: (title: string, priority: 'low' | 'medium' | 'high', eventId?: string, eventTitle?: string) => void;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  visible,
  onClose,
  selectedDate,
  events,
  onSaveEvent,
  onSaveTodo,
}) => {
  const { colors, isDark } = useTheme();
  const [tab, setTab] = useState<'event' | 'todo'>('event');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notifPriority, setNotifPriority] = useState<NotificationPriority>('default');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const formattedDate = selectedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  });

  const handleSave = () => {
    if (!title.trim()) return;
    if (tab === 'event' && onSaveEvent) {
      onSaveEvent(title.trim(), notifPriority);
    } else if (tab === 'todo' && onSaveTodo) {
      const linkedEvent = events?.find((e) => e.id === selectedEventId);
      onSaveTodo(title.trim(), priority, linkedEvent?.id, linkedEvent?.title);
    }
    setTitle('');
    setSelectedEventId(null);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant }]}>
              {/* Header com Segmented Tabs */}
              <View style={styles.header}>
                <View style={[styles.segmentedGroup, { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      tab === 'event' && [styles.segmentBtnActive, { backgroundColor: colors.surfaceContainerHighest }],
                    ]}
                    onPress={() => setTab('event')}
                  >
                    <MaterialIcons
                      name="event"
                      size={15}
                      color={tab === 'event' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        { color: tab === 'event' ? colors.onSurface : colors.textSecondary },
                        tab === 'event' && styles.segmentTextActive,
                      ]}
                    >
                      Compromisso
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.segmentBtn,
                      tab === 'todo' && [styles.segmentBtnActive, { backgroundColor: colors.surfaceContainerHighest }],
                    ]}
                    onPress={() => setTab('todo')}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={15}
                      color={tab === 'todo' ? colors.primary : colors.textSecondary}
                    />
                    <Text
                      style={[
                        styles.segmentText,
                        { color: tab === 'todo' ? colors.onSurface : colors.textSecondary },
                        tab === 'todo' && styles.segmentTextActive,
                      ]}
                    >
                      Tarefa
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={onClose} hitSlop={tokens.hitSlop.sm} accessibilityLabel="Fechar">
                  <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              </View>

              <Text style={[styles.dateLabel, { color: colors.textMuted }]}>Data selecionada: {formattedDate}</Text>

              {/* Input de Título */}
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                    color: colors.onSurface,
                  },
                ]}
                placeholder={tab === 'event' ? 'Título da reunião ou evento...' : 'Título da tarefa ou lembrete...'}
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
                autoFocus
              />

              {/* Seletor de Prioridade de Alerta (para eventos) */}
              {tab === 'event' && (
                <View style={styles.priorityRow}>
                  <Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>Alerta:</Text>
                  {(
                    [
                      { key: 'silent', label: 'Silencioso', icon: 'notifications-off' as const },
                      { key: 'default', label: 'Padrão', icon: 'notifications' as const },
                      { key: 'wakeup', label: 'Wake-up', icon: 'alarm' as const },
                    ] as const
                  ).map((opt) => {
                    const isSelected = notifPriority === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[
                          styles.priorityChip,
                          {
                            backgroundColor: isSelected
                              ? colors.primaryContainer
                              : colors.surfaceContainerLow,
                            borderColor: isSelected ? colors.primary : colors.outlineVariant,
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 4,
                          },
                        ]}
                        onPress={() => setNotifPriority(opt.key)}
                      >
                        <MaterialIcons
                          name={opt.icon}
                          size={14}
                          color={isSelected ? colors.onPrimaryContainer : colors.textSecondary}
                        />
                        <Text
                          style={[
                            styles.priorityChipText,
                            {
                              color: isSelected ? colors.onPrimaryContainer : colors.textSecondary,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Seletor de Prioridade (apenas para tarefas) */}
              {tab === 'todo' && (
                <View style={styles.priorityRow}>
                  <Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>Prioridade:</Text>
                  {(['low', 'medium', 'high'] as const).map((p) => {
                    const isSelected = priority === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[
                          styles.priorityChip,
                          {
                            backgroundColor: isSelected
                              ? colors.primaryContainer
                              : colors.surfaceContainerLow,
                            borderColor: isSelected ? colors.primary : colors.outlineVariant,
                          },
                        ]}
                        onPress={() => setPriority(p)}
                      >
                        <Text
                          style={[
                            styles.priorityChipText,
                            {
                              color: isSelected ? colors.onPrimaryContainer : colors.textSecondary,
                              fontWeight: isSelected ? '700' : '500',
                            },
                          ]}
                        >
                          {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Seletor de Vínculo com Evento (apenas para tarefas) */}
              {tab === 'todo' && events && events.length > 0 && (
                <View style={styles.eventLinkSection}>
                  <Text style={[styles.priorityLabel, { color: colors.textSecondary }]}>
                    Vincular a compromisso:
                  </Text>
                  <View style={styles.eventChipsWrap}>
                    <TouchableOpacity
                      style={[
                        styles.eventLinkChip,
                        {
                          backgroundColor: selectedEventId === null ? colors.primaryContainer : colors.surfaceContainerLow,
                          borderColor: selectedEventId === null ? colors.primary : colors.outlineVariant,
                        },
                      ]}
                      onPress={() => setSelectedEventId(null)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.eventLinkChipText,
                          { color: selectedEventId === null ? colors.onPrimaryContainer : colors.textSecondary },
                        ]}
                      >
                        Nenhum
                      </Text>
                    </TouchableOpacity>
                    {events.slice(0, 5).map((ev) => {
                      const isSelected = selectedEventId === ev.id;
                      return (
                        <TouchableOpacity
                          key={ev.id}
                          style={[
                            styles.eventLinkChip,
                            {
                              backgroundColor: isSelected ? colors.primaryContainer : colors.surfaceContainerLow,
                              borderColor: isSelected ? colors.primary : colors.outlineVariant,
                            },
                          ]}
                          onPress={() => setSelectedEventId(isSelected ? null : ev.id)}
                          activeOpacity={0.75}
                        >
                          <MaterialIcons
                            name="event"
                            size={12}
                            color={isSelected ? colors.onPrimaryContainer : colors.primary}
                          />
                          <Text
                            style={[
                              styles.eventLinkChipText,
                              { color: isSelected ? colors.onPrimaryContainer : colors.onSurface },
                            ]}
                            numberOfLines={1}
                          >
                            {ev.title}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {/* Botões de Ação */}
              <View style={styles.footerRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.saveBtn,
                    { backgroundColor: colors.primary },
                    !title.trim() && styles.saveBtnDisabled,
                  ]}
                  onPress={handleSave}
                  disabled={!title.trim()}
                >
                  <Text style={[styles.saveBtnText, { color: colors.onPrimary }]}>Salvar</Text>
                </TouchableOpacity>
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
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: tokens.radii.lg,
    padding: tokens.spacing.md,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    gap: tokens.spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  segmentedGroup: {
    flexDirection: 'row',
    backgroundColor: tokens.colors.surfaceContainerLowest,
    borderRadius: tokens.radii.full,
    padding: 3,
    gap: 4,
  },
  segmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: tokens.radii.full,
  },
  segmentBtnActive: {
    backgroundColor: tokens.colors.surfaceContainerHigh,
  },
  segmentText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
  },
  segmentTextActive: {
    color: tokens.colors.textPrimary,
    fontWeight: tokens.typography.weight.semibold,
  },
  dateLabel: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
  },
  input: {
    backgroundColor: tokens.colors.surfaceContainerLow,
    borderRadius: tokens.radii.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: 10,
    color: tokens.colors.textPrimary,
    fontSize: tokens.typography.size.sm,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityLabel: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
  },
  priorityChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: tokens.radii.full,
    backgroundColor: tokens.colors.surfaceContainerLow,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
  },
  priorityChipActive: {
    backgroundColor: tokens.colors.primaryLight,
    borderColor: tokens.colors.primary,
  },
  priorityChipText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs,
  },
  priorityChipTextActive: {
    color: tokens.colors.primary,
    fontWeight: tokens.typography.weight.semibold,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.xs,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: tokens.radii.full,
  },
  cancelBtnText: {
    color: tokens.colors.textSecondary,
    fontSize: tokens.typography.size.xs + 1,
  },
  saveBtn: {
    backgroundColor: tokens.colors.cobalt,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: tokens.radii.full,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: tokens.typography.size.xs + 1,
    fontWeight: tokens.typography.weight.semibold,
  },
  eventLinkSection: {
    marginTop: tokens.spacing.sm,
  },
  eventChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  eventLinkChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: tokens.radii.sm,
    borderWidth: 1,
    maxWidth: 180,
  },
  eventLinkChipText: {
    fontSize: 11,
    fontWeight: tokens.typography.weight.medium,
  },
});
