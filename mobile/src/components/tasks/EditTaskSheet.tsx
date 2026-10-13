import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import { DateTimePicker } from './DateTimePicker';
import { getEditInitialState } from '../../utils/taskEdit';
import { toLocalISO } from '../../utils/dateTimePicker';
import type { Todo, PendingItem } from '../../types';
import type { RepeatOption } from '../pending/ReminderSheet';

export interface EditTarget {
  kind: 'todo' | 'pending';
  todo?: Todo;
  pending?: PendingItem;
}

export interface EditItemPayload {
  title: string;
  /** ISO datetime do prazo (tarefa). */
  dateISO?: string;
  /** YYYY-MM-DD (pendência). */
  dateOnly?: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  remind_at?: string;
  remind_repeat?: RepeatOption;
  remind_advance_minutes?: number;
}

interface EditTaskSheetProps {
  target: EditTarget | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (id: string, kind: 'todo' | 'pending', payload: EditItemPayload) => void;
  onDelete: (id: string, kind: 'todo' | 'pending') => void;
}

const PRIORITIES: Array<{ id: 'low' | 'medium' | 'high'; label: string }> = [
  { id: 'low', label: 'Baixa' },
  { id: 'medium', label: 'Média' },
  { id: 'high', label: 'Alta' },
];

const CATEGORIES = ['geral', 'trabalho', 'financas', 'estudos', 'saude', 'pessoal'];

const REPEATS: Array<{ id: RepeatOption; label: string }> = [
  { id: 'none', label: 'Uma vez' },
  { id: 'daily', label: 'Todo dia' },
  { id: 'weekly', label: 'Toda semana' },
];

const ADVANCES = [0, 15, 30, 60];

export const EditTaskSheet: React.FC<EditTaskSheetProps> = ({
  target,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}) => {
  const { colors } = useTheme();
  const [title, setTitle] = useState('');
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [time, setTime] = useState('09:00');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('geral');
  const [useReminder, setUseReminder] = useState(false);
  const [repeat, setRepeat] = useState<RepeatOption>('none');
  const [advance, setAdvance] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      const item = target.kind === 'todo' ? target.todo : target.pending;
      if (!item) return;
      const s = getEditInitialState(item, target.kind);
      setTitle(s.title);
      setDateISO(s.dateISO);
      setTime(s.time);
      setPriority(s.priority);
      setCategory(s.category);
      setUseReminder(s.useReminder);
      setRepeat(s.repeat);
      setAdvance(s.advance);
      setLocalError(null);
    }
  }, [target]);

  if (!target) return null;
  const itemId = target.kind === 'todo' ? target.todo?.id : target.pending?.id;
  if (!itemId) return null;

  const chip = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? colors.primary : 'transparent',
      borderColor: active ? colors.primary : colors.outlineVariant,
    },
  ];
  const chipText = (active: boolean) => [
    styles.chipText,
    { color: active ? colors.onPrimary : colors.onSurfaceVariant },
  ];

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setLocalError('Dê um título ao item.');
      return;
    }
    const payload: EditItemPayload = { title: trimmed };

    if (dateISO) {
      if (target.kind === 'todo') {
        const due = toLocalISO(dateISO, useReminder ? time : '09:00');
        if (!due) {
          setLocalError('Data inválida.');
          return;
        }
        payload.dateISO = due;
      } else {
        payload.dateOnly = dateISO;
      }
    }

    if (target.kind === 'todo') payload.priority = priority;
    else payload.category = category;

    if (useReminder) {
      if (!dateISO) {
        setLocalError('Para lembrar, escolha a data.');
        return;
      }
      const iso = toLocalISO(dateISO, time);
      if (!iso) {
        setLocalError('Hora do lembrete inválida.');
        return;
      }
      payload.remind_at = iso;
      payload.remind_repeat = repeat;
      payload.remind_advance_minutes = advance;
    }

    hapticFeedback.medium();
    onSave(itemId, target.kind, payload);
  };

  return (
    <Modal visible={!!target} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: colors.surfaceContainer }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.onSurface }]}>
              {target.kind === 'todo' ? 'Editar tarefa' : 'Editar pendência'}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={tokens.hitSlop.sm} accessibilityLabel="Fechar edição">
              <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <TextInput
              style={[styles.titleInput, { color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholder="Título"
              placeholderTextColor={colors.onSurfaceVariant}
              value={title}
              onChangeText={setTitle}
              maxLength={140}
              accessibilityLabel="Título do item"
            />

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
              {target.kind === 'todo' ? 'Prazo' : 'Data'}
            </Text>
            <DateTimePicker
              dateISO={dateISO}
              time={time}
              onChangeDate={setDateISO}
              onChangeTime={setTime}
              showTime={useReminder}
            />

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
              {target.kind === 'todo' ? 'Prioridade' : 'Categoria'}
            </Text>
            <View style={styles.row}>
              {(target.kind === 'todo'
                ? PRIORITIES.map((p) => ({ id: p.id, label: p.label }))
                : CATEGORIES.map((c) => ({ id: c, label: c }))
              ).map((o: any) => {
                const active = target.kind === 'todo' ? priority === o.id : category === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={chip(active)}
                    onPress={() => {
                      hapticFeedback.selection();
                      if (target.kind === 'todo') setPriority(o.id);
                      else setCategory(o.id);
                    }}
                    activeOpacity={0.8}
                    accessibilityLabel={`${o.label}`}
                  >
                    <Text style={chipText(active)}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={styles.remToggle}
              onPress={() => {
                hapticFeedback.selection();
                setUseReminder(!useReminder);
              }}
              activeOpacity={0.8}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: useReminder }}
              accessibilityLabel="Adicionar lembrete"
            >
              <MaterialIcons
                name={useReminder ? 'check-box' : 'check-box-outline-blank'}
                size={20}
                color={useReminder ? colors.primary : colors.onSurfaceVariant}
              />
              <Text style={[styles.remToggleText, { color: colors.onSurface }]}>Adicionar lembrete</Text>
            </TouchableOpacity>

            {useReminder && (
              <>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Repetir</Text>
                <View style={styles.row}>
                  {REPEATS.map((r) => (
                    <TouchableOpacity key={r.id} style={chip(repeat === r.id)} onPress={() => setRepeat(r.id)} activeOpacity={0.8} accessibilityLabel={`Repetir ${r.label}`}>
                      <Text style={chipText(repeat === r.id)}>{r.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Avisar antes</Text>
                <View style={styles.row}>
                  {ADVANCES.map((m) => (
                    <TouchableOpacity key={m} style={chip(advance === m)} onPress={() => setAdvance(m)} activeOpacity={0.8} accessibilityLabel={m === 0 ? 'Sem aviso prévio' : `${m} minutos antes`}>
                      <Text style={chipText(advance === m)}>{m === 0 ? 'Na hora' : `${m} min`}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {(localError || error) && (
              <Text style={[styles.errorText, { color: colors.error }]}>{localError || error}</Text>
            )}

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.deleteBtn, { borderColor: colors.error }]}
                onPress={() => {
                  hapticFeedback.medium();
                  onDelete(itemId, target.kind);
                }}
                activeOpacity={0.8}
                accessibilityLabel="Excluir item"
              >
                <Text style={[styles.deleteText, { color: colors.error }]}>Excluir</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityLabel="Salvar edição"
              >
                <Text style={[styles.saveText, { color: colors.onPrimary }]}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '92%',
  },
  scrollContent: {
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#9CA3AF',
    alignSelf: 'center',
    marginBottom: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  remToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  remToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 12,
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  deleteBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: 'center',
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
