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
import { parseReminderInput } from '../../utils/reminderInput';
import type { RepeatOption } from '../pending/ReminderSheet';

export type NewItemKind = 'todo' | 'pending';

export interface NewItemPayload {
  kind: NewItemKind;
  title: string;
  /** ISO datetime (due_date da tarefa ou data base). */
  dateISO?: string;
  /** YYYY-MM-DD (scheduled_date da pendência). */
  dateOnly?: string;
  priority?: 'low' | 'medium' | 'high';
  category?: string;
  remind_at?: string;
  remind_repeat?: RepeatOption;
  remind_advance_minutes?: number;
}

interface CreateTaskSheetProps {
  visible: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (payload: NewItemPayload) => void;
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

export const CreateTaskSheet: React.FC<CreateTaskSheetProps> = ({
  visible,
  saving,
  error,
  onClose,
  onSave,
}) => {
  const { colors } = useTheme();
  const [kind, setKind] = useState<NewItemKind>('todo');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [category, setCategory] = useState('geral');
  const [useReminder, setUseReminder] = useState(false);
  const [remTime, setRemTime] = useState('');
  const [repeat, setRepeat] = useState<RepeatOption>('none');
  const [advance, setAdvance] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setKind('todo');
      setTitle('');
      setDate('');
      setPriority('medium');
      setCategory('geral');
      setUseReminder(false);
      setRemTime('');
      setRepeat('none');
      setAdvance(0);
      setLocalError(null);
    }
  }, [visible]);

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

  const toISODate = (d: string): string | null => {
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(d.trim());
    if (!m) return null;
    return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  };

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setLocalError('Dê um título ao item.');
      return;
    }
    const payload: NewItemPayload = { kind, title: trimmed };

    if (date.trim()) {
      if (kind === 'todo') {
        const iso = parseReminderInput(date, '09:00');
        if (!iso) {
          setLocalError('Data inválida ou no passado (DD/MM/AAAA).');
          return;
        }
        payload.dateISO = iso;
      } else {
        const only = toISODate(date);
        if (!only) {
          setLocalError('Data inválida (DD/MM/AAAA).');
          return;
        }
        payload.dateOnly = only;
      }
    }

    if (kind === 'todo') payload.priority = priority;
    else payload.category = category;

    if (useReminder) {
      const base = kind === 'todo' ? date : date;
      if (!base.trim() && !remTime.trim()) {
        setLocalError('Para lembrar, informe data e hora.');
        return;
      }
      const iso = parseReminderInput(base.trim() || new Date().toLocaleDateString('pt-BR'), remTime);
      if (!iso) {
        setLocalError('Lembrete precisa de data futura e hora HH:MM.');
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.surfaceContainer }]}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={[styles.title, { color: colors.onSurface }]}>Novo item</Text>
            <TouchableOpacity onPress={onClose} hitSlop={tokens.hitSlop.sm} accessibilityLabel="Fechar criação">
              <MaterialIcons name="close" size={22} color={colors.onSurfaceVariant} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.typeRow}>
              {(['todo', 'pending'] as NewItemKind[]).map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.typeBtn, kind === k && { backgroundColor: colors.primary }]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setKind(k);
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: kind === k }}
                  accessibilityLabel={k === 'todo' ? 'Criar tarefa' : 'Criar pendência'}
                >
                  <Text style={[styles.typeText, { color: kind === k ? colors.onPrimary : colors.onSurfaceVariant }]}>
                    {k === 'todo' ? 'Tarefa' : 'Pendência'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={[styles.titleInput, { color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholder={kind === 'todo' ? 'O que precisa ser feito?' : 'O que guardar para depois?'}
              placeholderTextColor={colors.onSurfaceVariant}
              value={title}
              onChangeText={setTitle}
              maxLength={140}
              accessibilityLabel="Título do item"
            />

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
              {kind === 'todo' ? 'Prazo (opcional)' : 'Data (opcional)'}
            </Text>
            <TextInput
              style={[styles.input, { color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.onSurfaceVariant}
              value={date}
              onChangeText={setDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="Data do item"
            />

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>
              {kind === 'todo' ? 'Prioridade' : 'Categoria'}
            </Text>
            <View style={styles.row}>
              {(kind === 'todo' ? PRIORITIES.map((p) => ({ id: p.id, label: p.label })) : CATEGORIES.map((c) => ({ id: c, label: c }))).map((o: any) => {
                const active = kind === 'todo' ? priority === o.id : category === o.id;
                return (
                  <TouchableOpacity
                    key={o.id}
                    style={chip(active)}
                    onPress={() => {
                      hapticFeedback.selection();
                      if (kind === 'todo') setPriority(o.id);
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
                <TextInput
                  style={[styles.input, { color: colors.onSurface, borderColor: colors.outlineVariant }]}
                  placeholder="Hora HH:MM"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={remTime}
                  onChangeText={setRemTime}
                  keyboardType="numbers-and-punctuation"
                  maxLength={5}
                  accessibilityLabel="Hora do lembrete"
                />
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

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              accessibilityLabel={kind === 'todo' ? 'Criar tarefa' : 'Guardar pendência'}
            >
              <Text style={[styles.saveText, { color: colors.onPrimary }]}>
                {saving ? 'Salvando...' : kind === 'todo' ? 'Criar tarefa' : 'Guardar pendência'}
              </Text>
            </TouchableOpacity>
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
    maxHeight: '88%',
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
  typeRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 14,
    padding: 4,
    gap: 4,
    marginBottom: 8,
  },
  typeBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  typeText: {
    fontSize: 14,
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
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
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
  saveBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
