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

interface CreateItemModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onSaveEvent?: (title: string) => void;
  onSaveTodo?: (title: string, priority: 'low' | 'medium' | 'high') => void;
}

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  visible,
  onClose,
  selectedDate,
  onSaveEvent,
  onSaveTodo,
}) => {
  const [tab, setTab] = useState<'event' | 'todo'>('event');
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  const formattedDate = selectedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  });

  const handleSave = () => {
    if (!title.trim()) return;
    if (tab === 'event' && onSaveEvent) {
      onSaveEvent(title.trim());
    } else if (tab === 'todo' && onSaveTodo) {
      onSaveTodo(title.trim(), priority);
    }
    setTitle('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              {/* Header com Segmented Tabs */}
              <View style={styles.header}>
                <View style={styles.segmentedGroup}>
                  <TouchableOpacity
                    style={[styles.segmentBtn, tab === 'event' && styles.segmentBtnActive]}
                    onPress={() => setTab('event')}
                  >
                    <MaterialIcons
                      name="event"
                      size={15}
                      color={tab === 'event' ? tokens.colors.primary : tokens.colors.textSecondary}
                    />
                    <Text style={[styles.segmentText, tab === 'event' && styles.segmentTextActive]}>
                      Compromisso
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.segmentBtn, tab === 'todo' && styles.segmentBtnActive]}
                    onPress={() => setTab('todo')}
                  >
                    <MaterialIcons
                      name="check-circle"
                      size={15}
                      color={tab === 'todo' ? tokens.colors.tertiary : tokens.colors.textSecondary}
                    />
                    <Text style={[styles.segmentText, tab === 'todo' && styles.segmentTextActive]}>
                      Tarefa
                    </Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={onClose} hitSlop={tokens.hitSlop.sm}>
                  <MaterialIcons name="close" size={18} color={tokens.colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <Text style={styles.dateLabel}>Data selecionada: {formattedDate}</Text>

              {/* Input de Título */}
              <TextInput
                style={styles.input}
                placeholder={tab === 'event' ? 'Título da reunião ou evento...' : 'Título da tarefa ou lembrete...'}
                placeholderTextColor={tokens.colors.textMuted}
                value={title}
                onChangeText={setTitle}
                autoFocus
              />

              {/* Seletor de Prioridade (apenas para tarefas) */}
              {tab === 'todo' && (
                <View style={styles.priorityRow}>
                  <Text style={styles.priorityLabel}>Prioridade:</Text>
                  {(['low', 'medium', 'high'] as const).map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.priorityChip,
                        priority === p && styles.priorityChipActive,
                      ]}
                      onPress={() => setPriority(p)}
                    >
                      <Text
                        style={[
                          styles.priorityChipText,
                          priority === p && styles.priorityChipTextActive,
                        ]}
                      >
                        {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Botões de Ação */}
              <View style={styles.footerRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.saveBtn, !title.trim() && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={!title.trim()}
                >
                  <Text style={styles.saveBtnText}>Salvar</Text>
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
});
