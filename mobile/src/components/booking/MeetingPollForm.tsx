import React, { useState, useMemo } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { SelectableChip } from '../ui/SelectableChip';
import { hapticFeedback } from '../../theme/motion';
import { Event } from '../../types';
import { checkSlotAvailability } from '../../utils/slotAvailability';
import {
  SelectedMeetingSlot,
  toggleMeetingSlotSelection,
} from '../../utils/meetingPollUtils';

const QUICK_HOURS = [
  '08:00', '09:00', '10:00', '11:00',
  '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00', '21:00',
];

const PT_WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const toDayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

interface MeetingPollFormProps {
  title: string;
  onChangeTitle: (val: string) => void;
  description: string;
  onChangeDescription: (val: string) => void;
  duration: number;
  onChangeDuration: (val: number) => void;
  slots: SelectedMeetingSlot[];
  onChangeSlots: (slots: SelectedMeetingSlot[]) => void;
  calendarEvents: Event[];
  isSubmitting: boolean;
  isEditing: boolean;
  onSubmit: () => void;
}

export const MeetingPollForm: React.FC<MeetingPollFormProps> = ({
  title,
  onChangeTitle,
  description,
  onChangeDescription,
  duration,
  onChangeDuration,
  slots,
  onChangeSlots,
  calendarEvents,
  isSubmitting,
  isEditing,
  onSubmit,
}) => {
  const { colors } = useTheme();

  const next14Days = useMemo(() => {
    const list: { key: string; label: string; weekday: string }[] = [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const key = toDayKey(d);
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({ key, label, weekday: PT_WEEKDAYS[d.getDay()] });
    }
    return list;
  }, []);

  const [activeDate, setActiveDate] = useState<string>(
    () => slots[0]?.date || next14Days[1]?.key || next14Days[0]?.key
  );

  const countByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of slots) {
      map[s.date] = (map[s.date] || 0) + 1;
    }
    return map;
  }, [slots]);

  const handleToggleHour = (hour: string) => {
    hapticFeedback.selection();
    const updated = toggleMeetingSlotSelection(slots, activeDate, hour);
    onChangeSlots(updated);
  };

  const handleRemoveSlot = (date: string, time: string) => {
    hapticFeedback.selection();
    onChangeSlots(slots.filter((s) => !(s.date === date && s.time === time)));
  };

  const formatDateBadge = (dateKey: string) => {
    const found = next14Days.find((d) => d.key === dateKey);
    if (found) return `${found.weekday} ${found.label}`;
    const parts = dateKey.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
    return dateKey;
  };

  return (
    <View style={styles.container}>
      {/* 1. Título e Descrição */}
      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.onSurface }]}>
          Título da Reunião *
        </Text>
        <TextInput
          style={[
            styles.formInput,
            {
              backgroundColor: colors.surfaceContainerHigh,
              color: colors.onSurface,
              borderColor: colors.outlineVariant,
            },
          ]}
          placeholder="Ex: Reunião de Design, Planejamento da Sprint"
          placeholderTextColor={colors.onSurfaceVariant}
          value={title}
          onChangeText={onChangeTitle}
        />
      </View>

      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.onSurface }]}>
          Pauta ou Contexto (opcional)
        </Text>
        <TextInput
          style={[
            styles.formInput,
            {
              backgroundColor: colors.surfaceContainerHigh,
              color: colors.onSurface,
              borderColor: colors.outlineVariant,
            },
          ]}
          placeholder="Resumo rápido do que será discutido"
          placeholderTextColor={colors.onSurfaceVariant}
          value={description}
          onChangeText={onChangeDescription}
        />
      </View>

      {/* 2. Duração */}
      <View style={styles.formGroup}>
        <Text style={[styles.formLabel, { color: colors.onSurface }]}>
          Duração da Reunião
        </Text>
        <View style={styles.chipsRow}>
          {[15, 30, 45, 60].map((d) => (
            <SelectableChip
              key={d}
              label={`${d} min`}
              selected={duration === d}
              onPress={() => {
                hapticFeedback.selection();
                onChangeDuration(d);
              }}
            />
          ))}
        </View>
      </View>

      {/* 3. Seletor Direto Tap-to-Toggle (Estilo LettuceMeet / Cal.com) */}
      <View
        style={[
          styles.pickerCard,
          {
            backgroundColor: colors.surfaceContainerHigh,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.pickerHeaderRow}>
          <Text style={[styles.formLabel, { color: colors.onSurface }]}>
            Escolha os Dias e Horários para Votação
          </Text>
          <View style={[styles.counterPill, { backgroundColor: colors.primary }]}>
            <Text style={[styles.counterPillText, { color: colors.onPrimary }, tabularNumbers]}>
              {slots.length} {slots.length === 1 ? 'opção' : 'opções'}
            </Text>
          </View>
        </View>

        <Text style={[styles.helperText, { color: colors.onSurfaceVariant }]}>
          1. Selecione o dia na barra abaixo e toque nos horários para marcar ou desmarcar:
        </Text>

        {/* Barra Horizontal de Dias */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.daysScroller}
        >
          {next14Days.map((d) => {
            const isSelectedDay = activeDate === d.key;
            const daySlotCount = countByDate[d.key] || 0;
            return (
              <TouchableOpacity
                key={d.key}
                style={[
                  styles.dayCard,
                  {
                    backgroundColor: isSelectedDay ? colors.primary : colors.surface,
                    borderColor: isSelectedDay
                      ? colors.primary
                      : daySlotCount > 0
                        ? colors.onSurfaceVariant
                        : colors.outlineVariant,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setActiveDate(d.key);
                }}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.dayWeekday,
                    { color: isSelectedDay ? colors.onPrimary : colors.onSurfaceVariant },
                  ]}
                >
                  {d.weekday}
                </Text>
                <Text
                  style={[
                    styles.dayDate,
                    { color: isSelectedDay ? colors.onPrimary : colors.onSurface },
                    tabularNumbers,
                  ]}
                >
                  {d.label}
                </Text>
                {daySlotCount > 0 && (
                  <View
                    style={[
                      styles.dayCountDot,
                      {
                        backgroundColor: isSelectedDay ? colors.onPrimary : colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayCountDotText,
                        { color: isSelectedDay ? colors.primary : colors.onPrimary },
                      ]}
                    >
                      {daySlotCount}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Grade de Horários do Dia Ativo (Tap-to-Toggle com checagem de agenda) */}
        <View style={styles.hoursGrid}>
          {QUICK_HOURS.map((hour) => {
            const isSlotSelected = slots.some(
              (s) => s.date === activeDate && s.time === hour
            );
            const availability = checkSlotAvailability(
              { date: activeDate, time: hour, durationMinutes: duration },
              calendarEvents
            );
            const hasConflict = !availability.available;

            return (
              <TouchableOpacity
                key={hour}
                style={[
                  styles.hourPill,
                  {
                    backgroundColor: isSlotSelected ? colors.primary : colors.surface,
                    borderColor: isSlotSelected
                      ? colors.primary
                      : hasConflict
                        ? 'rgba(239, 68, 68, 0.45)'
                        : colors.outlineVariant,
                  },
                ]}
                onPress={() => handleToggleHour(hour)}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.hourPillText,
                    {
                      color: isSlotSelected
                        ? colors.onPrimary
                        : hasConflict
                          ? colors.error
                          : colors.onSurface,
                    },
                    tabularNumbers,
                  ]}
                >
                  {hour}
                </Text>
                {isSlotSelected ? (
                  <MaterialIcons name="check" size={13} color={colors.onPrimary} />
                ) : hasConflict ? (
                  <MaterialIcons name="event-busy" size={12} color={colors.error} />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Resumo de Pílulas Selecionadas */}
        {slots.length > 0 && (
          <View style={[styles.selectedSummaryBox, { borderTopColor: colors.outlineVariant }]}>
            <Text style={[styles.selectedSummaryTitle, { color: colors.onSurfaceVariant }]}>
              Horários incluídos na enquete:
            </Text>
            <View style={styles.selectedChipsWrap}>
              {slots.map((s) => (
                <TouchableOpacity
                  key={`${s.date}_${s.time}`}
                  style={[
                    styles.selectedSlotChip,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  onPress={() => handleRemoveSlot(s.date, s.time)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.selectedSlotChipText, { color: colors.onSurface }, tabularNumbers]}>
                    {formatDateBadge(s.date)} • {s.time}
                  </Text>
                  <MaterialIcons name="close" size={14} color={colors.onSurfaceVariant} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Botão Primário */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          {
            backgroundColor: colors.primary,
            opacity: isSubmitting || !title.trim() || slots.length === 0 ? 0.5 : 1,
          },
        ]}
        onPress={onSubmit}
        disabled={isSubmitting || !title.trim() || slots.length === 0}
        activeOpacity={0.8}
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" color={colors.onPrimary} />
        ) : (
          <Text style={[styles.submitBtnText, { color: colors.onPrimary }]}>
            {isEditing ? 'Salvar Alterações da Reunião' : `Criar Enquete (${slots.length} horários)`}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  formInput: {
    height: 46,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 14,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerCard: {
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 12,
  },
  pickerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  counterPill: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 99,
  },
  counterPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 16,
  },
  daysScroller: {
    gap: 8,
    paddingVertical: 2,
  },
  dayCard: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayWeekday: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  dayDate: {
    fontSize: 13,
    fontWeight: '800',
  },
  dayCountDot: {
    marginTop: 2,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 99,
  },
  dayCountDotText: {
    fontSize: 10,
    fontWeight: '800',
  },
  hoursGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hourPill: {
    width: '22.8%',
    height: 38,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  hourPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectedSummaryBox: {
    borderTopWidth: 1,
    paddingTop: 10,
    gap: 8,
  },
  selectedSummaryTitle: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectedChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  selectedSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  selectedSlotChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  submitBtn: {
    height: 50,
    borderRadius: MD3Shapes.large,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
