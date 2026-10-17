import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { hapticFeedback } from '../../theme/motion';
import type { PendingItem } from '../../types';
import { parseReminderInput, splitReminderISO } from '../../utils/reminderInput';

export type RepeatOption = 'none' | 'daily' | 'weekly';

interface ReminderSheetProps {
  visible: boolean;
  item: PendingItem | null;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (reminder: { remind_at: string; remind_repeat: RepeatOption; remind_advance_minutes: number }) => void;
  onClear: () => void;
}

const REPEATS: Array<{ id: RepeatOption; label: string }> = [
  { id: 'none', label: 'Uma vez' },
  { id: 'daily', label: 'Todo dia' },
  { id: 'weekly', label: 'Toda semana' },
];

const ADVANCES = [0, 15, 30, 60];

export const ReminderSheet: React.FC<ReminderSheetProps> = ({
  visible,
  item,
  saving,
  error,
  onClose,
  onSave,
  onClear,
}) => {
  const { colors } = useTheme();
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState<RepeatOption>('none');
  const [advance, setAdvance] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && item) {
      const parts = splitReminderISO(item.remind_at);
      setDate(parts.date);
      setTime(parts.time);
      setRepeat(item.remind_repeat && item.remind_repeat !== 'none' ? item.remind_repeat : 'none');
      setAdvance(item.remind_advance_minutes || 0);
      setLocalError(null);
    }
  }, [visible, item]);

  const handleSave = () => {
    const iso = parseReminderInput(date, time);
    if (!iso) {
      setLocalError('Use data futura no formato DD/MM/AAAA e hora HH:MM.');
      return;
    }
    hapticFeedback.medium();
    onSave({ remind_at: iso, remind_repeat: repeat, remind_advance_minutes: advance });
  };

  const chip = (active: boolean) => [
    styles.chip,
    {
      backgroundColor: active ? colors.primary : 'transparent',
      borderColor: active ? colors.primary : colors.outlineVariant,
    },
  ];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Lembrete"
      subtitle={item?.title}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.body}
      >

          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Data e hora</Text>
          <View style={styles.row}>
            <TextInput
              style={[styles.input, { color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholder="DD/MM/AAAA"
              placeholderTextColor={colors.onSurfaceVariant}
              value={date}
              onChangeText={setDate}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              accessibilityLabel="Data do lembrete"
            />
            <TextInput
              style={[styles.input, styles.timeInput, { color: colors.onSurface, borderColor: colors.outlineVariant }]}
              placeholder="HH:MM"
              placeholderTextColor={colors.onSurfaceVariant}
              value={time}
              onChangeText={setTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
              accessibilityLabel="Hora do lembrete"
            />
          </View>

          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Repetir</Text>
          <View style={styles.row}>
            {REPEATS.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={chip(repeat === r.id)}
                onPress={() => {
                  hapticFeedback.selection();
                  setRepeat(r.id);
                }}
                activeOpacity={0.8}
                accessibilityRole="radio"
                accessibilityState={{ selected: repeat === r.id }}
                accessibilityLabel={`Repetir ${r.label}`}
              >
                <Text style={[styles.chipText, { color: repeat === r.id ? colors.onPrimary : colors.onSurfaceVariant }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.onSurfaceVariant }]}>Avisar antes</Text>
          <View style={styles.row}>
            {ADVANCES.map((m) => (
              <TouchableOpacity
                key={m}
                style={chip(advance === m)}
                onPress={() => {
                  hapticFeedback.selection();
                  setAdvance(m);
                }}
                activeOpacity={0.8}
                accessibilityLabel={m === 0 ? 'Sem aviso prévio' : `Avisar ${m} minutos antes`}
              >
                <Text style={[styles.chipText, { color: advance === m ? colors.onPrimary : colors.onSurfaceVariant }]}>
                  {m === 0 ? 'Na hora' : `${m} min`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {Boolean(localError || error) && (
            <Text style={[styles.errorText, { color: colors.error }]}>{localError || error}</Text>
          )}

          <View style={styles.actions}>
            {item?.remind_at && (
              <TouchableOpacity
                style={[styles.clearBtn, { borderColor: colors.outlineVariant }]}
                onPress={onClear}
                disabled={saving}
                activeOpacity={0.8}
                accessibilityLabel="Remover lembrete"
              >
                <Text style={[styles.clearText, { color: colors.error }]}>Remover</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.85}
              accessibilityLabel="Salvar lembrete"
            >
              <Text style={[styles.saveText, { color: colors.onPrimary }]}>
                {saving ? 'Salvando...' : 'Salvar lembrete'}
              </Text>
            </TouchableOpacity>
          </View>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  body: {
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  timeInput: {
    maxWidth: 110,
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
  errorText: {
    fontSize: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  clearBtn: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  clearText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    borderRadius: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
