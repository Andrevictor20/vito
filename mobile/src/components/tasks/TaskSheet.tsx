import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePickerNative from '@react-native-community/datetimepicker';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
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

const WEEKDAYS_PT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

/** Mini-calendário padrão (números do mês): fallback web/sem módulo nativo. */
const MiniCalendar: React.FC<{
  value: string | null;
  onSelect: (iso: string) => void;
}> = ({ value, onSelect }) => {
  const { colors } = useTheme();
  const today = todayISO();
  const init = value ?? today;
  const [py, pm] = init.split('-').map(Number);
  const [viewY, setViewY] = useState(py);
  const [viewM, setViewM] = useState(pm);
  const firstWeekday = new Date(viewY, viewM - 1, 1).getDay();
  const daysInMonth = new Date(viewY, viewM, 0).getDate();
  const monthLabel = new Date(viewY, viewM - 1, 1)
    .toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
    .replace(/^./, (c) => c.toUpperCase());
  const atMinMonth =
    viewY < Number(today.slice(0, 4)) ||
    (viewY === Number(today.slice(0, 4)) && viewM <= Number(today.slice(5, 7)));
  const shiftMonth = (delta: number) => {
    let y = viewY;
    let m = viewM + delta;
    while (m < 1) { m += 12; y -= 1; }
    while (m > 12) { m -= 12; y += 1; }
    setViewY(y);
    setViewM(m);
  };
  const cells: Array<number | null> = [
    ...Array<number | null>(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  return (
    <View style={[styles.miniCal, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
      <View style={styles.miniCalHeader}>
        <TouchableOpacity
          onPress={() => shiftMonth(-1)}
          disabled={atMinMonth}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Mês anterior"
          accessibilityRole="button"
          style={{ opacity: atMinMonth ? 0.3 : 1 }}
        >
          <MaterialIcons name="chevron-left" size={22} color={colors.onSurface} />
        </TouchableOpacity>
        <Text style={[styles.miniCalTitle, { color: colors.onSurface }]}>{monthLabel}</Text>
        <TouchableOpacity
          onPress={() => shiftMonth(1)}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Próximo mês"
          accessibilityRole="button"
        >
          <MaterialIcons name="chevron-right" size={22} color={colors.onSurface} />
        </TouchableOpacity>
      </View>
      <View style={styles.miniCalWeekRow}>
        {WEEKDAYS_PT.map((w, i) => (
          <Text key={i} style={[styles.miniCalWeekday, { color: colors.textMuted }]}>{w}</Text>
        ))}
      </View>
      <View style={styles.miniCalGrid}>
        {cells.map((d, i) => {
          if (d === null) return <View key={`b-${i}`} style={styles.miniCalCell} />;
          const iso = `${viewY}-${pad(viewM)}-${pad(d)}`;
          const selected = value === iso;
          const past = iso < today;
          return (
            <TouchableOpacity
              key={iso}
              disabled={past}
              onPress={() => { hapticFeedback.selection(); onSelect(iso); }}
              activeOpacity={0.8}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel={`Dia ${d}`}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled: past }}
              style={[
                styles.miniCalCell,
                selected && { backgroundColor: colors.primary, borderRadius: 9999 },
              ]}
            >
              <Text
                style={[
                  styles.miniCalDay,
                  { color: selected ? colors.onPrimary : colors.onSurface, opacity: past ? 0.3 : 1 },
                ]}
              >
                {d}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

/** Mini-seletor de hora (HH/MM por números): fallback web/sem módulo nativo. */
const MiniTimePicker: React.FC<{
  value: string;
  onChange: (t: string) => void;
}> = ({ value, onChange }) => {
  const { colors } = useTheme();
  const [hh, mm] = value.split(':');
  const hours = Array.from({ length: 24 }, (_, i) => pad(i));
  const minutes = Array.from({ length: 12 }, (_, i) => pad(i * 5));
  const col = (opts: string[], selected: string, onPick: (v: string) => void, label: string) => (
    <View style={styles.miniTimeCol}>
      <Text style={[styles.miniTimeColLabel, { color: colors.textMuted }]}>{label}</Text>
      <ScrollView style={styles.miniTimeList} showsVerticalScrollIndicator={false}>
        {opts.map((o) => {
          const active = o === selected;
          return (
            <TouchableOpacity
              key={o}
              onPress={() => { hapticFeedback.selection(); onPick(o); }}
              activeOpacity={0.8}
              accessibilityLabel={`${label} ${o}`}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[
                styles.miniTimeOpt,
                active && { backgroundColor: colors.primary, borderRadius: 10 },
              ]}
            >
              <Text style={[styles.miniTimeOptText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                {o}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
  return (
    <View style={[styles.miniTime, { borderColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
      {col(hours, hh, (h) => onChange(`${h}:${mm}`), 'Hora')}
      <Text style={[styles.miniTimeSep, { color: colors.onSurface }]}>:</Text>
      {col(minutes, minutes.includes(mm) ? mm : pad(Math.round(Number(mm) / 5) * 5 % 60), (m) => onChange(`${hh}:${m}`), 'Min')}
    </View>
  );
};

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
  /** Altura adaptativa do campo de título (cresce com o texto até o teto). */
  const [titleHeight, setTitleHeight] = useState(48);
  const TITLE_MAX_HEIGHT = 160;
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
  // Painel do seletor padrão (calendário/relogio): no Android abre o dialog
  // nativo direto; no iOS/web expande o mini-seletor embutido.
  const [dateExpanded, setDateExpanded] = useState(false);
  const [timeExpanded, setTimeExpanded] = useState(false);

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
      setTitleHeight(48);
      // Recolhidos por padrão a cada abertura.
      setDateExpanded(false);
      setTimeExpanded(false);
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
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={isEdit ? 'Editar tarefa' : 'Nova tarefa'}
      subtitle={fmtPreview(dateISO, time)}
    >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <TextInput
              style={[styles.titleInput, { color: colors.onSurface, borderColor: colors.outlineVariant, height: Math.max(48, Math.min(titleHeight, TITLE_MAX_HEIGHT)) }]}
              placeholder="O que precisa ser feito?"
              placeholderTextColor={colors.onSurfaceVariant}
              value={title}
              onChangeText={setTitle}
              multiline
              scrollEnabled={titleHeight >= TITLE_MAX_HEIGHT}
              onContentSizeChange={(e) => setTitleHeight(e.nativeEvent.contentSize.height)}
              textAlignVertical="top"
              maxLength={500}
              accessibilityLabel="Título da tarefa"
            />

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Data</Text>
            <TouchableOpacity
              style={[styles.dateToggle, { borderColor: colors.outlineVariant }]}
              onPress={() => {
                hapticFeedback.selection();
                // Android: dialog padrão de calendário direto; iOS/web: painel embutido.
                if (Platform.OS === 'android') setShowDatePicker(true);
                else setDateExpanded((v) => !v);
              }}
              activeOpacity={0.7}
              accessibilityLabel={dateExpanded ? 'Recolher calendário' : 'Escolher data no calendário'}
              accessibilityRole="button"
              accessibilityState={{ expanded: dateExpanded }}
            >
              <MaterialIcons name="calendar-month" size={18} color={colors.primary} />
              <Text style={[styles.dateToggleText, { color: colors.onSurface }]}>
                {dateISO ? fmtPreview(dateISO, time) : 'Escolher data…'}
              </Text>
              <MaterialIcons
                name={dateExpanded ? 'expand-less' : 'expand-more'}
                size={20}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            {/* Atalhos rápidos (1 toque) */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipStrip}
            >
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
            </ScrollView>

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
            {dateExpanded && Platform.OS === 'web' && (
              <MiniCalendar
                value={dateISO}
                onSelect={(iso) => { setDateISO(iso); setDateExpanded(false); }}
              />
            )}
            {dateExpanded && Platform.OS === 'ios' && (
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
                  onPress={() => setDateExpanded(false)}
                  accessibilityLabel="Confirmar data"
                >
                  <Text style={[styles.doneText, { color: colors.onPrimary }]}>OK</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Hora</Text>
            <TouchableOpacity
              style={[styles.dateToggle, { borderColor: colors.outlineVariant }]}
              onPress={() => {
                hapticFeedback.selection();
                // Android: relógio padrão direto; iOS/web: mini-seletor embutido.
                if (Platform.OS === 'android') setShowTimePicker(true);
                else setTimeExpanded((v) => !v);
              }}
              activeOpacity={0.7}
              accessibilityLabel="Escolher hora e minuto"
              accessibilityRole="button"
              accessibilityState={{ expanded: timeExpanded }}
            >
              <MaterialIcons name="schedule" size={18} color={colors.primary} />
              <Text style={[styles.dateToggleText, { color: colors.onSurface }]}>
                {time}
              </Text>
              <MaterialIcons
                name={timeExpanded && Platform.OS !== 'android' ? 'expand-less' : 'expand-more'}
                size={20}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>
            {showTimePicker && Platform.OS === 'android' && (
              <DateTimePickerNative
                value={timeValue}
                mode="time"
                display="clock"
                is24Hour
                onChange={(_, d) => {
                  setShowTimePicker(false);
                  if (d) setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
                }}
              />
            )}
            {timeExpanded && Platform.OS === 'web' && (
              <MiniTimePicker value={time} onChange={(t) => setTime(t)} />
            )}
            {timeExpanded && Platform.OS === 'ios' && (
              <View style={[styles.iosPicker, { borderColor: colors.outlineVariant }]}>
                <DateTimePickerNative
                  value={timeValue}
                  mode="time"
                  display="spinner"
                  is24Hour
                  onChange={(_, d) => {
                    if (d) setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
                  }}
                />
                <TouchableOpacity
                  style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                  onPress={() => setTimeExpanded(false)}
                  accessibilityLabel="Confirmar hora"
                >
                  <Text style={[styles.doneText, { color: colors.onPrimary }]}>OK</Text>
                </TouchableOpacity>
              </View>
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

            {Boolean(localError || error) && (
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
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
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
  chipStrip: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingRight: 20,
    alignItems: 'center',
  },
  dateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 2,
  },
  dateToggleText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
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
  miniCal: {
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 8,
    padding: 12,
  },
  miniCalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  miniCalTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  miniCalWeekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  miniCalWeekday: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
  },
  miniCalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  miniCalCell: {
    width: '14.28%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCalDay: {
    fontSize: 14,
    fontWeight: '600',
  },
  miniTime: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 14,
    marginTop: 8,
    padding: 12,
    gap: 8,
  },
  miniTimeCol: {
    flex: 1,
    alignItems: 'stretch',
  },
  miniTimeColLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  miniTimeList: {
    maxHeight: 180,
  },
  miniTimeOpt: {
    paddingVertical: 9,
    alignItems: 'center',
  },
  miniTimeOptText: {
    fontSize: 15,
    fontWeight: '600',
  },
  miniTimeSep: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 24,
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
