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
import DateTimePickerNative from '@react-native-community/datetimepicker';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { hapticFeedback } from '../../theme/motion';
import type { Todo } from '../../types';
import type { RepeatOption } from '../pending/ReminderSheet';
import { toLocalISO, todayISO, addDaysISO } from '../../utils/dateTimePicker';

export interface TaskPayload {
  title: string;
  /** ISO datetime do prazo (ou undefined = sem data). */
  dateISO?: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  remind_at?: string;
  remind_repeat?: RepeatOption;
  remind_advance_minutes?: number;
}

interface TaskSheetProps {
  visible: boolean;
  /** null = criação; Todo = edição. */
  editingTodo?: Todo | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: TaskPayload) => void;
  onDelete?: (id: string) => void;
}

const PRIORITIES: Array<{ id: 'low' | 'medium' | 'high'; label: string }> = [
  { id: 'high', label: 'Alta' },
  { id: 'medium', label: 'Média' },
  { id: 'low', label: 'Baixa' },
];

const CATEGORIES = ['geral', 'trabalho', 'financas', 'estudos', 'saude', 'pessoal'];

const REPEATS: Array<{ id: RepeatOption; label: string }> = [
  { id: 'none', label: 'Uma vez' },
  { id: 'daily', label: 'Todo dia' },
  { id: 'weekly', label: 'Toda semana' },
];

const ADVANCES = [0, 15, 30, 60];

const pad = (n: number) => String(n).padStart(2, '0');

function fmtPreview(dateISO: string | null, time: string): string {
  if (!dateISO) return 'Sem data';
  const [y, m, d] = dateISO.split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  const label = dt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  return `${label} · ${time}`;
}

/** Sheet único de tarefa (criar + editar): data/hora nativas, prioridade, categoria e lembrete. */
export const TaskSheet: React.FC<TaskSheetProps> = ({
  visible,
  editingTodo,
  saving,
  error,
  onClose,
  onSave,
  onDelete,
}) => {
  const { colors } = useTheme();
  const isEdit = !!editingTodo;
  const [title, setTitle] = useState('');
  const [dateISO, setDateISO] = useState<string | null>(null);
  const [time, setTime] = useState('09:00');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('geral');
  const [useReminder, setUseReminder] = useState(false);
  const [repeat, setRepeat] = useState<RepeatOption>('none');
  const [advance, setAdvance] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      if (editingTodo) {
        setTitle(editingTodo.title || '');
        setDateISO(editingTodo.due_date ? editingTodo.due_date.split('T')[0] : null);
        const rt = editingTodo.remind_at ? editingTodo.remind_at.split('T')[1]?.slice(0, 5) : null;
        setTime(rt && /^\d{2}:\d{2}$/.test(rt) ? rt : '09:00');
        setPriority(editingTodo.priority || 'medium');
        setCategory(editingTodo.category || 'geral');
        setUseReminder(!!editingTodo.remind_at);
        setRepeat(editingTodo.remind_repeat || 'none');
        setAdvance(editingTodo.remind_advance_minutes || 0);
      } else {
        setTitle('');
        setDateISO(null);
        setTime('09:00');
        setPriority('medium');
        setCategory('geral');
        setUseReminder(false);
        setRepeat('none');
        setAdvance(0);
      }
      setShowDatePicker(false);
      setShowTimePicker(false);
      setLocalError(null);
    }
  }, [visible, editingTodo]);

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

  const dateValue = React.useMemo(() => {
    if (!dateISO) return new Date();
    const [y, m, d] = dateISO.split('-').map(Number);
    return new Date(y || 2026, (m || 1) - 1, d || 1, 12, 0, 0);
  }, [dateISO]);

  const timeValue = React.useMemo(() => {
    const [h, mi] = time.split(':').map(Number);
    const d = new Date();
    d.setHours(h || 9, mi || 0, 0, 0);
    return d;
  }, [time]);

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setLocalError('Dê um título à tarefa.');
      return;
    }
    const payload: TaskPayload = { title: trimmed, priority, category };
    if (dateISO) {
      const due = toLocalISO(dateISO, time);
      if (!due) {
        setLocalError('Data inválida.');
        return;
      }
      payload.dateISO = due;
    }
    if (useReminder) {
      if (!dateISO) {
        setLocalError('Para lembrar, escolha a data.');
        return;
      }
      const iso = toLocalISO(dateISO, time);
      if (!iso || new Date(iso).getTime() <= Date.now()) {
        setLocalError('Lembrete precisa de data e hora futuras.');
        return;
      }
      payload.remind_at = iso;
      payload.remind_repeat = repeat;
      payload.remind_advance_minutes = advance;
    }
    hapticFeedback.medium();
    onSave(payload);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior="padding"
        keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
        style={styles.overlay}
      >
        <View style={[styles.sheet, { backgroundColor: colors.surfaceContainer }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.title, { color: colors.onSurface }]}>
                {isEdit ? 'Editar tarefa' : 'Nova tarefa'}
              </Text>
              <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>
                {fmtPreview(dateISO, time)}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.closeBtn, { backgroundColor: colors.surfaceContainerHighest }]}
              onPress={onClose}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
            >
              <MaterialIcons name="close" size={18} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <TextInput
              style={[styles.titleInput, { color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholder="O que precisa ser feito?"
              placeholderTextColor={colors.onSurfaceVariant}
              value={title}
              onChangeText={setTitle}
              maxLength={140}
              accessibilityLabel="Título da tarefa"
            />

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Data</Text>
            <View style={styles.row}>
              <TouchableOpacity
                style={chip(dateISO === todayISO())}
                onPress={() => { hapticFeedback.selection(); setDateISO(todayISO()); }}
                activeOpacity={0.8}
                accessibilityLabel="Hoje"
              >
                <Text style={chipText(dateISO === todayISO())}>Hoje</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={chip(dateISO === addDaysISO(todayISO(), 1))}
                onPress={() => { hapticFeedback.selection(); setDateISO(addDaysISO(todayISO(), 1)); }}
                activeOpacity={0.8}
                accessibilityLabel="Amanhã"
              >
                <Text style={chipText(dateISO === addDaysISO(todayISO(), 1))}>Amanhã</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={chip(false)}
                onPress={() => { hapticFeedback.selection(); setShowDatePicker(true); }}
                activeOpacity={0.8}
                accessibilityLabel="Escolher data"
              >
                <Text style={chipText(false)}>Escolher…</Text>
              </TouchableOpacity>
              {dateISO && (
                <TouchableOpacity
                  style={chip(false)}
                  onPress={() => { hapticFeedback.selection(); setDateISO(null); setUseReminder(false); }}
                  activeOpacity={0.8}
                  accessibilityLabel="Remover data"
                >
                  <Text style={chipText(false)}>Limpar</Text>
                </TouchableOpacity>
              )}
            </View>

            {showDatePicker && Platform.OS === 'android' && (
              <DateTimePickerNative
                value={dateValue}
                mode="date"
                display="calendar"
                minimumDate={new Date()}
                onChange={(_, d) => {
                  setShowDatePicker(false);
                  if (d) setDateISO(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                }}
              />
            )}
            {showDatePicker && Platform.OS === 'ios' && (
              <View style={[styles.iosPicker, { borderColor: colors.outlineVariant }]}>
                <DateTimePickerNative
                  value={dateValue}
                  mode="date"
                  display="inline"
                  minimumDate={new Date()}
                  onChange={(_, d) => {
                    if (d) setDateISO(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
                  }}
                />
                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setShowDatePicker(false)}
                  accessibilityLabel="Confirmar data"
                >
                  <Text style={[styles.doneText, { color: colors.onPrimary }]}>OK</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Hora · {time}</Text>
            <View style={styles.row}>
              {['08:00', '09:00', '12:00', '14:00', '18:00'].map((h) => (
                <TouchableOpacity
                  key={h}
                  style={chip(time === h)}
                  onPress={() => { hapticFeedback.selection(); setTime(h); }}
                  activeOpacity={0.8}
                  accessibilityLabel={`Hora ${h}`}
                >
                  <Text style={chipText(time === h)}>{h}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={chip(false)}
                onPress={() => { hapticFeedback.selection(); setShowTimePicker(true); }}
                activeOpacity={0.8}
                accessibilityLabel="Outra hora"
              >
                <Text style={chipText(false)}>Outra…</Text>
              </TouchableOpacity>
            </View>
            {showTimePicker && (
              <DateTimePickerNative
                value={timeValue}
                mode="time"
                display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                is24Hour
                onChange={(_, d) => {
                  if (Platform.OS === 'android') setShowTimePicker(false);
                  if (d) setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
                }}
              />
            )}
            {Platform.OS === 'ios' && showTimePicker && (
              <TouchableOpacity
                style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                onPress={() => setShowTimePicker(false)}
                accessibilityLabel="Confirmar hora"
              >
                <Text style={[styles.doneText, { color: colors.onPrimary }]}>OK</Text>
              </TouchableOpacity>
            )}

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Prioridade</Text>
            <View style={styles.row}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={chip(priority === p.id)}
                  onPress={() => { hapticFeedback.selection(); setPriority(p.id); }}
                  activeOpacity={0.8}
                  accessibilityLabel={`Prioridade ${p.label}`}
                  accessibilityState={{ selected: priority === p.id }}
                >
                  <Text style={chipText(priority === p.id)}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Categoria</Text>
            <View style={styles.row}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={chip(category === c)}
                  onPress={() => { hapticFeedback.selection(); setCategory(c); }}
                  activeOpacity={0.8}
                  accessibilityLabel={`Categoria ${c}`}
                  accessibilityState={{ selected: category === c }}
                >
                  <Text style={chipText(category === c)}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.remToggle}
              onPress={() => { hapticFeedback.selection(); setUseReminder(!useReminder); }}
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
              <Text style={[styles.remToggleText, { color: colors.onSurface }]}>Lembrar-me</Text>
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
                    <TouchableOpacity key={m} style={chip(advance === m)} onPress={() => setAdvance(m)} activeOpacity={0.8} accessibilityLabel={m === 0 ? 'Na hora' : `${m} minutos antes`}>
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
              {isEdit && onDelete && editingTodo && (
                <TouchableOpacity
                  style={[styles.deleteBtn, { borderColor: colors.error }]}
                  onPress={() => onDelete(editingTodo.id)}
                  disabled={saving}
                  activeOpacity={0.85}
                  accessibilityLabel="Excluir tarefa"
                  accessibilityRole="button"
                >
                  <MaterialIcons name="delete-outline" size={18} color={colors.error} />
                  <Text style={[styles.deleteText, { color: colors.error }]}>Excluir</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.85}
                accessibilityLabel={isEdit ? 'Salvar tarefa' : 'Criar tarefa'}
                accessibilityRole="button"
              >
                <Text style={[styles.saveText, { color: colors.onPrimary }]}>
                  {saving ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar tarefa'}
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
  scrollContent: {
    paddingBottom: 24,
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: tokens.spacing.md,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: '90%',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 6,
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
  iosPicker: {
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  doneBtn: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  doneText: {
    fontSize: 14,
    fontWeight: '700',
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
    marginTop: 16,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  deleteText: {
    fontSize: 14,
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
