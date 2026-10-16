import React, { useState } from 'react';
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
import { tokens, MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { SelectableChip } from '../ui/SelectableChip';
import { hapticFeedback } from '../../theme/motion';
import { BookingType, CreateBookingTypeInput, Meeting } from '../../types';
import { api } from '../../services/api';

const TIME_PRESETS = [
  { label: '09h às 18h', start: '09:00', end: '18:00' },
  { label: '08h às 12h', start: '08:00', end: '12:00' },
  { label: '13h às 18h', start: '13:00', end: '18:00' },
  { label: '08h às 20h', start: '08:00', end: '20:00' },
];

const AVAILABLE_HOURS = [
  '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
  '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
  '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

interface BookingTypeModalProps {
  visible: boolean;
  editingType: BookingType | null;
  onClose: () => void;
  onSubmit: (payload: CreateBookingTypeInput) => Promise<void>;
  onMeetingCreated?: (meeting: Meeting) => void;
  bookingUsername: string;
}

const toDayKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const validityEndFor = (v: '7d' | '14d' | '30d' | 'none'): string | null => {
  if (v === 'none') return null;
  const days = v === '7d' ? 7 : v === '14d' ? 14 : 30;
  const d = new Date(Date.now() + days * 86400000);
  return toDayKey(d);
};

export const BookingTypeModal: React.FC<BookingTypeModalProps> = ({
  visible,
  editingType,
  onClose,
  onSubmit,
  onMeetingCreated,
  bookingUsername,
}) => {
  const { colors, isDark } = useTheme();

  const [newTitle, setNewTitle] = useState(editingType?.title || '');
  const [newSlug, setNewSlug] = useState(editingType?.slug || '');
  const [newDescription, setNewDescription] = useState(editingType?.description || '');
  const [newDuration, setNewDuration] = useState(editingType?.duration_minutes || 30);
  const [newBuffer, setNewBuffer] = useState(editingType?.buffer_minutes ?? 10);
  const [newStartHour, setNewStartHour] = useState(editingType?.start_hour || '09:00');
  const [newEndHour, setNewEndHour] = useState(editingType?.end_hour || '18:00');
  const [newValidity, setNewValidity] = useState<'7d' | '14d' | '30d' | 'none'>('none');
  const [newDaysMode, setNewDaysMode] = useState<'week' | 'dates'>('week');
  const [newWeekDays, setNewWeekDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newSpecificDates, setNewSpecificDates] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timePickerTarget, setTimePickerTarget] = useState<'start' | 'end' | null>(null);

  // Estados de Reunião em Grupo (Consenso)
  const [creationMode, setCreationMode] = useState<'booking' | 'meeting'>('booking');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');
  const [meetingDuration, setMeetingDuration] = useState<number>(45);
  const [meetingSlots, setMeetingSlots] = useState<{ date: string; time: string }[]>([]);

  // Sincroniza estado quando editingType muda
  React.useEffect(() => {
    if (editingType) {
      setNewTitle(editingType.title);
      setNewSlug(editingType.slug);
      setNewDescription(editingType.description || '');
      setNewDuration(editingType.duration_minutes || 30);
      setNewBuffer(editingType.buffer_minutes ?? 10);
      setNewStartHour(editingType.start_hour || '09:00');
      setNewEndHour(editingType.end_hour || '18:00');
      try {
        const dates: string[] = editingType.allowed_dates ? JSON.parse(editingType.allowed_dates) : [];
        if (Array.isArray(dates) && dates.length > 0) {
          setNewDaysMode('dates');
          setNewSpecificDates(dates);
        } else {
          setNewDaysMode('week');
          setNewSpecificDates([]);
        }
      } catch {
        setNewDaysMode('week');
        setNewSpecificDates([]);
      }
      try {
        const days: number[] = editingType.days_of_week ? JSON.parse(editingType.days_of_week) : [1, 2, 3, 4, 5];
        setNewWeekDays(Array.isArray(days) && days.length > 0 ? days : [1, 2, 3, 4, 5]);
      } catch {
        setNewWeekDays([1, 2, 3, 4, 5]);
      }
      if (editingType.valid_until) {
        const end = new Date(`${editingType.valid_until}T12:00:00`);
        const remaining = Math.ceil((end.getTime() - Date.now()) / 86400000);
        setNewValidity(remaining <= 10 ? '7d' : remaining <= 21 ? '14d' : '30d');
      } else {
        setNewValidity('none');
      }
    } else {
      setNewTitle('');
      setNewSlug('');
      setNewDescription('');
      setNewDuration(30);
      setNewBuffer(10);
      setNewStartHour('09:00');
      setNewEndHour('18:00');
      setNewValidity('none');
      setNewDaysMode('week');
      setNewWeekDays([1, 2, 3, 4, 5]);
      setNewSpecificDates([]);
      setCreationMode('booking');
      setMeetingTitle('');
      setMeetingDescription('');
      setMeetingDuration(45);
      const d1 = new Date(Date.now() + 86400000);
      const d2 = new Date(Date.now() + 2 * 86400000);
      setMeetingSlots([
        { date: toDayKey(d1), time: '19:00' },
        { date: toDayKey(d2), time: '19:00' },
      ]);
    }
  }, [editingType, visible]);

  const handleSubmitMeeting = async () => {
    if (!meetingTitle.trim() || meetingSlots.length === 0) return;
    setIsSubmitting(true);
    try {
      const slotsPayload = meetingSlots.map((s) => {
        const start = new Date(`${s.date}T${s.time}:00`);
        const end = new Date(start.getTime() + meetingDuration * 60000);
        return {
          start_at: start.toISOString(),
          end_at: end.toISOString(),
        };
      });
      const created = await api.createMeeting({
        title: meetingTitle.trim(),
        description: meetingDescription.trim() || undefined,
        duration_minutes: meetingDuration,
        mode: 'group_consensus',
        slots: slotsPayload,
      });
      hapticFeedback.success();
      onMeetingCreated?.(created);
      onClose();
    } catch (err: any) {
      hapticFeedback.medium();
    } finally {
      setIsSubmitting(false);
    }
  };

  const autoGenerateSlug = (titleText: string) => {
    setNewTitle(titleText);
    const generated = titleText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setNewSlug(generated);
  };

  const next14DayKeys = React.useMemo(() => {
    const list: { key: string; label: string; weekday: string }[] = [];
    const wdNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    for (let i = 0; i < 14; i++) {
      const d = new Date(Date.now() + i * 86400000);
      const key = toDayKey(d);
      const label = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      list.push({ key, label, weekday: wdNames[d.getDay()] });
    }
    return list;
  }, []);

  const toggleWeekDay = (day: number) => {
    hapticFeedback.selection();
    setNewWeekDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const toggleSpecificDate = (dateKey: string) => {
    hapticFeedback.selection();
    setNewSpecificDates((prev) =>
      prev.includes(dateKey) ? prev.filter((k) => k !== dateKey) : [...prev, dateKey].sort()
    );
  };

  const handleModalSubmit = async () => {
    if (!newTitle.trim() || !newSlug.trim()) {
      return;
    }
    hapticFeedback.medium();
    setIsSubmitting(true);
    try {
      const validityEnd = validityEndFor(newValidity);
      const payload: CreateBookingTypeInput = {
        title: newTitle.trim(),
        slug: newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-'),
        description: newDescription.trim() || undefined,
        duration_minutes: newDuration,
        buffer_minutes: newBuffer,
        start_hour: newStartHour,
        end_hour: newEndHour,
        days_of_week: newDaysMode === 'week'
          ? JSON.stringify(newWeekDays.length > 0 ? newWeekDays : [1, 2, 3, 4, 5])
          : editingType?.days_of_week || '[1,2,3,4,5,6,7]',
        valid_from: `${toDayKey(new Date())}T00:00:00`,
        valid_until: validityEnd ? `${validityEnd}T23:59:59` : null,
        allowed_dates: newDaysMode === 'dates' && newSpecificDates.length > 0
          ? JSON.stringify(newSpecificDates)
          : null,
      };
      await onSubmit(payload);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <BottomSheetModal
        visible={visible}
        onClose={onClose}
        title={editingType ? 'Editar Link de Agendamento' : creationMode === 'meeting' ? 'Nova Reunião em Grupo' : 'Novo Link de Agendamento'}
        subtitle={editingType ? 'Ajuste regras, horários e duração do link' : creationMode === 'meeting' ? 'Crie uma enquete de horários para votação de consenso' : 'Configure janelas e regras para convidados'}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.modalScrollContent}
        >
          {!editingType && (
            <View style={styles.modeTabsRow}>
              <TouchableOpacity
                style={[
                  styles.modeTabBtn,
                  creationMode === 'booking' && [styles.modeTabBtnActive, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.primary }],
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setCreationMode('booking');
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="link"
                  size={16}
                  color={creationMode === 'booking' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    { color: creationMode === 'booking' ? colors.onSurface : colors.textSecondary },
                  ]}
                >
                  Individual (1-on-1)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modeTabBtn,
                  creationMode === 'meeting' && [styles.modeTabBtnActive, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.primary }],
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  setCreationMode('meeting');
                }}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="how-to-vote"
                  size={16}
                  color={creationMode === 'meeting' ? colors.primary : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.modeTabText,
                    { color: creationMode === 'meeting' ? colors.onSurface : colors.textSecondary },
                  ]}
                >
                  Reunião em Grupo
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {creationMode === 'meeting' ? (
            <View style={{ gap: 14 }}>
              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>Título da Reunião *</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: colors.surfaceVariant,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                  placeholder="Ex: Alinhamento de Projeto, Planejamento"
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={meetingTitle}
                  onChangeText={setMeetingTitle}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>Pauta / Descrição (opcional)</Text>
                <TextInput
                  style={[
                    styles.formInput,
                    {
                      backgroundColor: colors.surfaceVariant,
                      color: colors.onSurface,
                      borderColor: colors.outlineVariant,
                      height: 60,
                      textAlignVertical: 'top',
                      paddingTop: 8,
                    },
                  ]}
                  placeholder="Adicione tópicos ou pauta da reunião..."
                  placeholderTextColor={colors.onSurfaceVariant}
                  value={meetingDescription}
                  onChangeText={setMeetingDescription}
                  multiline
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>Duração por Encontro</Text>
                <View style={styles.durationRow}>
                  {[15, 30, 45, 60].map((d) => (
                    <SelectableChip
                      key={d}
                      label={`${d} min`}
                      selected={meetingDuration === d}
                      onPress={() => {
                        hapticFeedback.selection();
                        setMeetingDuration(d);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={[styles.formLabel, { color: colors.onSurface, marginBottom: 4 }]}>
                  Opções de Horários Ofertados ({meetingSlots.length}) *
                </Text>
                <Text style={[styles.helperText, { color: colors.textSecondary, marginBottom: 8 }]}>
                  Os participantes votarão nestes horários na página pública para formar consenso.
                </Text>

                <View style={{ gap: 8 }}>
                  {meetingSlots.map((slot, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.slotCard,
                        {
                          backgroundColor: colors.surfaceContainerHigh,
                          borderColor: colors.outlineVariant,
                        },
                      ]}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                        <MaterialIcons name="event" size={16} color={colors.primary} />
                        <Text style={[styles.slotCardText, { color: colors.onSurface }]}>
                          {slot.date.split('-').reverse().slice(0, 2).join('/')} às {slot.time}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          hapticFeedback.selection();
                          setMeetingSlots((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        style={{ padding: 4 }}
                        accessibilityLabel="Remover horário"
                      >
                        <MaterialIcons name="close" size={16} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  ))}

                  <Text style={[styles.helperText, { color: colors.textSecondary, marginTop: 4 }]}>
                    Adicionar opções rápidas (próximos dias às 19h):
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                    {next14DayKeys.slice(0, 5).map((d) => (
                      <TouchableOpacity
                        key={d.key}
                        style={[
                          styles.addSlotChip,
                          {
                            backgroundColor: colors.surfaceContainerHighest,
                            borderColor: colors.outlineVariant,
                          },
                        ]}
                        onPress={() => {
                          hapticFeedback.selection();
                          setMeetingSlots((prev) => [...prev, { date: d.key, time: '19:00' }]);
                        }}
                      >
                        <MaterialIcons name="add" size={12} color={colors.primary} />
                        <Text style={[styles.addSlotChipText, { color: colors.onSurface }]}>
                          {d.weekday} {d.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <TouchableOpacity
                style={[
                  styles.submitModalBtn,
                  {
                    backgroundColor: colors.primary,
                    opacity: isSubmitting || !meetingTitle.trim() || meetingSlots.length === 0 ? 0.5 : 1,
                  },
                ]}
                onPress={handleSubmitMeeting}
                disabled={isSubmitting || !meetingTitle.trim() || meetingSlots.length === 0}
                activeOpacity={0.8}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.submitModalText, { color: colors.onPrimary }]}>
                    Criar Enquete de Grupo
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          ) : (
            <>
          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: colors.onSurface }]}>Título da Reunião *</Text>
            <TextInput
              style={[
                styles.formInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant,
                },
              ]}
              placeholder="Ex: Reunião de 30 min, Alinhamento"
              placeholderTextColor={colors.onSurfaceVariant}
              value={newTitle}
              onChangeText={editingType ? setNewTitle : autoGenerateSlug}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: colors.onSurface }]}>Slug do Link (URL) *</Text>
            <TextInput
              style={[
                styles.formInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant,
                },
              ]}
              placeholder="reuniao-30m"
              placeholderTextColor={colors.onSurfaceVariant}
              value={newSlug}
              onChangeText={(val) => setNewSlug(val.toLowerCase())}
              autoCapitalize="none"
            />

            <View
              style={[
                styles.linkPreviewBox,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                  borderColor: colors.outlineVariant,
                },
              ]}
            >
              <View style={styles.linkPreviewHeader}>
                <MaterialIcons name="link" size={14} color={colors.primary} />
                <Text style={[styles.linkPreviewLabel, { color: colors.onSurfaceVariant }]}>
                  Prévia do link:
                </Text>
              </View>
              <Text
                style={[styles.linkPreviewUrl, { color: colors.onSurface }]}
                numberOfLines={1}
              >
                {`https://vito.rasppi.cloud/book/${bookingUsername}/${newSlug ? newSlug.toLowerCase().replace(/[^a-z0-9-]/g, '-') : 'seu-link'}`}
              </Text>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: colors.onSurface }]}>Descrição (Opcional)</Text>
            <TextInput
              style={[
                styles.formInput,
                {
                  backgroundColor: colors.surfaceVariant,
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant,
                },
              ]}
              placeholder="Contexto da reunião ou pauta breve"
              placeholderTextColor={colors.onSurfaceVariant}
              value={newDescription}
              onChangeText={setNewDescription}
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: colors.onSurface }]}>Duração (minutos)</Text>
            <View style={styles.pillSelectorRow}>
              {[15, 30, 45, 60].map((dur) => (
                <SelectableChip
                  key={dur}
                  label={`${dur} min`}
                  selected={newDuration === dur}
                  onPress={() => setNewDuration(dur)}
                  accessibilityLabel={`Duração ${dur} minutos`}
                />
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: colors.onSurface }]}>Buffer de Respiro (minutos)</Text>
            <View style={styles.pillSelectorRow}>
              {[0, 10, 15, 20].map((buf) => (
                <SelectableChip
                  key={buf}
                  label={buf === 0 ? 'Sem buffer' : `${buf} min`}
                  selected={newBuffer === buf}
                  onPress={() => setNewBuffer(buf)}
                  accessibilityLabel={buf === 0 ? 'Sem buffer' : `Buffer ${buf} minutos`}
                />
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: colors.onSurface }]}>Horário de Atendimento</Text>
            <View style={styles.timePresetsContainer}>
              {TIME_PRESETS.map((p) => {
                const isSelected = newStartHour === p.start && newEndHour === p.end;
                return (
                  <SelectableChip
                    key={p.label}
                    label={p.label}
                    selected={isSelected}
                    onPress={() => {
                      setNewStartHour(p.start);
                      setNewEndHour(p.end);
                    }}
                    accessibilityLabel={`Horário ${p.label}`}
                  />
                );
              })}
            </View>

            <View style={styles.timeSelectorsRow}>
              <TouchableOpacity
                style={[
                  styles.timeSelectorButton,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.light();
                  setTimePickerTarget('start');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.timeSelectorLabel, { color: colors.onSurfaceVariant }]}>
                  Início
                </Text>
                <View style={styles.timeSelectorValueRow}>
                  <MaterialIcons name="access-time" size={16} color={colors.primary} />
                  <Text style={[styles.timeSelectorValue, { color: colors.onSurface }, tabularNumbers]}>
                    {newStartHour}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={18} color={colors.onSurfaceVariant} />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.timeSelectorButton,
                  {
                    backgroundColor: colors.surfaceVariant,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.light();
                  setTimePickerTarget('end');
                }}
                activeOpacity={0.8}
              >
                <Text style={[styles.timeSelectorLabel, { color: colors.onSurfaceVariant }]}>
                  Fim
                </Text>
                <View style={styles.timeSelectorValueRow}>
                  <MaterialIcons name="access-time" size={16} color={colors.primary} />
                  <Text style={[styles.timeSelectorValue, { color: colors.onSurface }, tabularNumbers]}>
                    {newEndHour}
                  </Text>
                  <MaterialIcons name="arrow-drop-down" size={18} color={colors.onSurfaceVariant} />
                </View>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: colors.onSurface }]}>Validade do Link</Text>
            <View style={styles.pillSelectorRow}>
              {([
                { id: '7d', label: '7 dias' },
                { id: '14d', label: '14 dias' },
                { id: '30d', label: '30 dias' },
                { id: 'none', label: 'Sem expiração' },
              ] as const).map((v) => (
                <SelectableChip
                  key={v.id}
                  label={v.label}
                  selected={newValidity === v.id}
                  onPress={() => setNewValidity(v.id)}
                  accessibilityLabel={`Validade ${v.label}`}
                />
              ))}
            </View>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.formLabel, { color: colors.onSurface }]}>Dias Disponíveis</Text>
            <View style={styles.pillSelectorRow}>
              <SelectableChip
                label="Dias da semana"
                selected={newDaysMode === 'week'}
                onPress={() => setNewDaysMode('week')}
                accessibilityLabel="Disponibilidade por dias da semana"
              />
              <SelectableChip
                label="Datas específicas"
                selected={newDaysMode === 'dates'}
                onPress={() => setNewDaysMode('dates')}
                accessibilityLabel="Disponibilidade em datas específicas"
              />
            </View>
            {newDaysMode === 'week' ? (
              <View style={styles.timePresetsContainer}>
                {([
                  { id: 1, label: 'Seg' },
                  { id: 2, label: 'Ter' },
                  { id: 3, label: 'Qua' },
                  { id: 4, label: 'Qui' },
                  { id: 5, label: 'Sex' },
                  { id: 6, label: 'Sáb' },
                  { id: 7, label: 'Dom' },
                ]).map((d) => (
                  <SelectableChip
                    key={d.id}
                    label={d.label}
                    selected={newWeekDays.includes(d.id)}
                    onPress={() => toggleWeekDay(d.id)}
                    accessibilityLabel={`Dia ${d.label}`}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.timePresetsContainer}>
                {next14DayKeys.map((d) => (
                  <SelectableChip
                    key={d.key}
                    label={`${d.weekday} ${d.label}`}
                    selected={newSpecificDates.includes(d.key)}
                    onPress={() => toggleSpecificDate(d.key)}
                    accessibilityLabel={`Data ${d.label}`}
                  />
                ))}
              </View>
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.submitModalBtn,
              { backgroundColor: colors.primary, opacity: isSubmitting ? 0.6 : 1 },
            ]}
            onPress={handleModalSubmit}
            disabled={isSubmitting}
            activeOpacity={0.8}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={[styles.submitModalText, { color: colors.onPrimary }]}>
                {editingType ? 'Salvar Alterações' : 'Salvar e Criar Link'}
              </Text>
            )}
          </TouchableOpacity>
          </>
          )}
        </ScrollView>
      </BottomSheetModal>

      {/* Seletor Rápido de Horário (Início ou Fim) */}
      <BottomSheetModal
        visible={timePickerTarget !== null}
        onClose={() => setTimePickerTarget(null)}
        title={timePickerTarget === 'start' ? 'Horário de Início' : 'Horário de Término'}
      >
        <ScrollView
          style={styles.pickerScrollView}
          contentContainerStyle={styles.pickerGrid}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {AVAILABLE_HOURS.map((hour) => {
            const isCurrent = (timePickerTarget === 'start' ? newStartHour : newEndHour) === hour;
            return (
              <TouchableOpacity
                key={hour}
                style={[
                  styles.hourGridItem,
                  {
                    backgroundColor: isCurrent ? colors.primary : colors.surfaceVariant,
                    borderColor: isCurrent ? colors.primary : colors.outlineVariant,
                  },
                ]}
                onPress={() => {
                  hapticFeedback.selection();
                  if (timePickerTarget === 'start') {
                    setNewStartHour(hour);
                  } else {
                    setNewEndHour(hour);
                  }
                  setTimePickerTarget(null);
                }}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.hourGridText,
                    { color: isCurrent ? colors.onPrimary : colors.onSurface },
                    isCurrent && { fontWeight: '700' },
                    tabularNumbers,
                  ]}
                >
                  {hour}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </BottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    gap: 20,
  },
  formGroup: {
    gap: 8,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.1,
  },
  formInput: {
    height: 48,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  linkPreviewBox: {
    padding: 12,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    gap: 6,
    marginTop: 8,
  },
  linkPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  linkPreviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  linkPreviewUrl: {
    fontSize: 13,
    fontWeight: '500',
  },
  pillSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timePresetsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  timeSelectorsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  timeSelectorButton: {
    flex: 1,
    height: 60,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'space-between',
  },
  timeSelectorLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  timeSelectorValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSelectorValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  submitModalBtn: {
    height: 52,
    borderRadius: MD3Shapes.large,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
  },
  submitModalText: {
    fontSize: 15,
    fontWeight: '700',
  },
  pickerScrollView: {
    maxHeight: 320,
  },
  pickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  hourGridItem: {
    width: '30%',
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourGridText: {
    fontSize: 14,
    fontWeight: '600',
  },
  helperText: {
    fontSize: 12,
    fontFamily: tokens.typography.family.regular,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  modeTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: MD3Shapes.extraSmall,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  modeTabBtnActive: {
    borderWidth: 1,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '700',
  },
  durationRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: MD3Shapes.extraSmall,
    borderWidth: 1,
  },
  slotCardText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: tokens.typography.family.medium,
  },
  addSlotChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  addSlotChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
});
