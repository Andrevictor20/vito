import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePickerNative from '@react-native-community/datetimepicker';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { hapticFeedback } from '../../theme/motion';

import { NotificationPriority } from '../../types';

interface CreateItemModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  events?: import('../../types').Event[];
  onSaveEvent?: (title: string, priority?: NotificationPriority, startISO?: string, endISO?: string) => void;
  onSaveTodo?: (title: string, priority: 'low' | 'medium' | 'high', eventId?: string, eventTitle?: string) => void;
  fixedTab?: 'event' | 'todo';
}

const pad = (n: number) => String(n).padStart(2, '0');

const atTime = (base: Date, hhmm: string): Date => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(base);
  d.setHours(h || 9, m || 0, 0, 0);
  return d;
};

export const CreateItemModal: React.FC<CreateItemModalProps> = ({
  visible,
  onClose,
  selectedDate,
  events,
  onSaveEvent,
  onSaveTodo,
  fixedTab,
}) => {
  const { colors } = useTheme();
  const [tabState, setTab] = useState<'event' | 'todo'>('event');
  const tab = fixedTab ?? tabState;
  const [title, setTitle] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [notifPriority, setNotifPriority] = useState<NotificationPriority>('default');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [timeTarget, setTimeTarget] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (visible) {
      setTitle('');
      setSelectedEventId(null);
      setStartTime('09:00');
      setEndTime('10:00');
      setTimeTarget(null);
    }
  }, [visible]);

  const formattedDate = selectedDate.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
  });

  const timeValue = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h || 9, m || 0, 0, 0);
    return d;
  };

  const handleSave = () => {
    if (!title.trim()) return;
    if (tab === 'event' && onSaveEvent) {
      const start = atTime(selectedDate, startTime).toISOString();
      let end = atTime(selectedDate, endTime).toISOString();
      if (end <= start) {
        const fixed = atTime(selectedDate, startTime);
        fixed.setHours(fixed.getHours() + 1);
        end = fixed.toISOString();
      }
      onSaveEvent(title.trim(), notifPriority, start, end);
    } else if (tab === 'todo' && onSaveTodo) {
      const linkedEvent = events?.find((e) => e.id === selectedEventId);
      onSaveTodo(title.trim(), priority, linkedEvent?.id, linkedEvent?.title);
    }
    setTitle('');
    setSelectedEventId(null);
    onClose();
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={tab === 'event' ? 'Novo compromisso' : 'Nova tarefa'}
      subtitle={`${formattedDate} · ${startTime}–${endTime}`}
    >
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            {!fixedTab && (
              <View style={styles.typeRow}>
                {(['event', 'todo'] as const).map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={[styles.typeBtn, tab === k && { backgroundColor: colors.primary }]}
                    onPress={() => {
                      hapticFeedback.selection();
                      setTab(k);
                    }}
                    activeOpacity={0.8}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: tab === k }}
                  >
                    <Text style={[styles.typeText, { color: tab === k ? colors.onPrimary : colors.onSurfaceVariant }]}>
                      {k === 'event' ? 'Compromisso' : 'Tarefa'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TextInput
              style={[styles.titleInput, { color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholder={tab === 'event' ? 'Título da reunião ou evento...' : 'Título da tarefa ou lembrete...'}
              placeholderTextColor={colors.onSurfaceVariant}
              value={title}
              onChangeText={setTitle}
              maxLength={140}
              accessibilityLabel={tab === 'event' ? 'Título do compromisso' : 'Título da tarefa'}
            />

            {tab === 'event' && (
              <>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Horário</Text>
                <View style={styles.row}>
                  {(['start', 'end'] as const).map((which) => (
                    <TouchableOpacity
                      key={which}
                      style={[styles.timeBtn, { borderColor: colors.outlineVariant }]}
                      onPress={() => {
                        hapticFeedback.selection();
                        setTimeTarget(which);
                      }}
                      activeOpacity={0.8}
                      accessibilityLabel={which === 'start' ? 'Hora de início' : 'Hora de término'}
                    >
                      <MaterialIcons name="access-time" size={16} color={colors.primary} />
                      <Text style={[styles.timeBtnText, { color: colors.onSurface }]}>
                        {which === 'start' ? `Início ${startTime}` : `Fim ${endTime}`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {timeTarget && (
                  <DateTimePickerNative
                    value={timeValue(timeTarget === 'start' ? startTime : endTime)}
                    mode="time"
                    display={Platform.OS === 'ios' ? 'spinner' : 'clock'}
                    is24Hour
                    onChange={(_, d) => {
                      if (Platform.OS === 'android') setTimeTarget(null);
                      if (d) {
                        const v = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
                        if (timeTarget === 'start') {
                          setStartTime(v);
                          if (v >= endTime) {
                            const [h, m] = v.split(':').map(Number);
                            const e = new Date();
                            e.setHours(h, m + 60, 0, 0);
                            setEndTime(`${pad(e.getHours())}:${pad(e.getMinutes())}`);
                          }
                        } else {
                          setEndTime(v);
                        }
                      }
                    }}
                  />
                )}
                {Platform.OS === 'ios' && timeTarget && (
                  <TouchableOpacity
                    style={[styles.doneBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setTimeTarget(null)}
                    accessibilityLabel="Confirmar hora"
                  >
                    <Text style={[styles.doneText, { color: colors.onPrimary }]}>OK</Text>
                  </TouchableOpacity>
                )}

                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Alerta</Text>
                <View style={styles.row}>
                  {(
                    [
                      { key: 'silent', label: 'Silencioso' },
                      { key: 'default', label: 'Padrão' },
                    ] as const
                  ).map((opt) => {
                    const active = notifPriority === opt.key;
                    return (
                      <TouchableOpacity
                        key={opt.key}
                        style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }, { borderColor: colors.outlineVariant }]}
                        onPress={() => setNotifPriority(opt.key)}
                        activeOpacity={0.8}
                        accessibilityLabel={`Alerta ${opt.label}`}
                      >
                        <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                          {opt.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {tab === 'todo' && (
              <>
                <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Prioridade</Text>
                <View style={styles.row}>
                  {(['low', 'medium', 'high'] as const).map((p) => {
                    const active = priority === p;
                    return (
                      <TouchableOpacity
                        key={p}
                        style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }, { borderColor: colors.outlineVariant }]}
                        onPress={() => setPriority(p)}
                        activeOpacity={0.8}
                        accessibilityLabel={`Prioridade ${p}`}
                      >
                        <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurfaceVariant }]}>
                          {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {events && events.length > 0 && (
                  <>
                    <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Vincular a compromisso</Text>
                    <View style={styles.row}>
                      <TouchableOpacity
                        style={[styles.chip, selectedEventId === null && { backgroundColor: colors.primary, borderColor: colors.primary }, { borderColor: colors.outlineVariant }]}
                        onPress={() => setSelectedEventId(null)}
                        activeOpacity={0.75}
                        accessibilityLabel="Sem vínculo"
                      >
                        <Text style={[styles.chipText, { color: selectedEventId === null ? colors.onPrimary : colors.onSurfaceVariant }]}>
                          Nenhum
                        </Text>
                      </TouchableOpacity>
                      {events.slice(0, 5).map((ev) => {
                        const active = selectedEventId === ev.id;
                        return (
                          <TouchableOpacity
                            key={ev.id}
                            style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }, { borderColor: colors.outlineVariant }]}
                            onPress={() => setSelectedEventId(active ? null : ev.id)}
                            activeOpacity={0.75}
                            accessibilityLabel={`Vincular a ${ev.title}`}
                          >
                            <Text
                              style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurface }]}
                              numberOfLines={1}
                            >
                              {ev.title}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </>
                )}
              </>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: title.trim() ? 1 : 0.6 }]}
              onPress={handleSave}
              disabled={!title.trim()}
              activeOpacity={0.85}
              accessibilityLabel={tab === 'event' ? 'Criar compromisso' : 'Criar tarefa'}
              accessibilityRole="button"
            >
              <Text style={[styles.saveText, { color: colors.onPrimary }]}>
                {tab === 'event' ? 'Criar compromisso' : 'Criar tarefa'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
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
  timeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
  },
  timeBtnText: {
    fontSize: 14,
    fontWeight: '700',
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
  saveBtn: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  saveText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
