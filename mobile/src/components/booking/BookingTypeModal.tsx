import React, { useState, useEffect, useMemo } from 'react';
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
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { SelectableChip } from '../ui/SelectableChip';
import { hapticFeedback } from '../../theme/motion';
import { BookingType, CreateBookingTypeInput, Meeting, Event } from '../../types';
import { api } from '../../services/api';
import { MeetingPollForm } from './MeetingPollForm';
import {
  SelectedMeetingSlot,
  slotBRTToISO,
  slotsFromMeetingDetails,
} from '../../utils/meetingPollUtils';

const TIME_PRESETS = [
  { label: '09h às 18h', start: '09:00', end: '18:00' },
  { label: '08h às 12h', start: '08:00', end: '12:00' },
  { label: '13h às 18h', start: '13:00', end: '18:00' },
  { label: '08h às 20h', start: '08:00', end: '20:00' },
];

const AVAILABLE_HOURS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00',
];

interface BookingTypeModalProps {
  visible: boolean;
  editingType: BookingType | null;
  editingMeeting?: Meeting | null;
  onClose: () => void;
  onSubmit: (payload: CreateBookingTypeInput) => Promise<void>;
  onMeetingCreated?: (meeting: Meeting) => void;
  onMeetingUpdated?: (meeting: Meeting) => void;
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
  editingMeeting,
  onClose,
  onSubmit,
  onMeetingCreated,
  onMeetingUpdated,
  bookingUsername,
}) => {
  const { colors } = useTheme();

  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDuration, setNewDuration] = useState(30);
  const [newBuffer, setNewBuffer] = useState(10);
  const [newStartHour, setNewStartHour] = useState('09:00');
  const [newEndHour, setNewEndHour] = useState('18:00');
  const [newValidity, setNewValidity] = useState<'7d' | '14d' | '30d' | 'none'>('none');
  const [newDaysMode, setNewDaysMode] = useState<'week' | 'dates'>('week');
  const [newWeekDays, setNewWeekDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [newSpecificDates, setNewSpecificDates] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [inlineTimeTarget, setInlineTimeTarget] = useState<'start' | 'end' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [creationMode, setCreationMode] = useState<'booking' | 'meeting'>('booking');
  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDescription, setMeetingDescription] = useState('');
  const [meetingDuration, setMeetingDuration] = useState<number>(30);
  const [meetingSlots, setMeetingSlots] = useState<SelectedMeetingSlot[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (visible) {
      api.getEvents().then(setCalendarEvents).catch(() => {});
    }
  }, [visible]);

  useEffect(() => {
    if (editingMeeting) {
      setCreationMode('meeting');
      setMeetingTitle(editingMeeting.title || '');
      setMeetingDescription(editingMeeting.description || '');
      setMeetingDuration(editingMeeting.duration_minutes || 30);
      const parsedSlots = slotsFromMeetingDetails(editingMeeting.slots);
      if (parsedSlots.length > 0) {
        setMeetingSlots(parsedSlots);
      } else {
        const d1 = new Date(Date.now() + 86400000);
        setMeetingSlots([{ date: toDayKey(d1), time: '18:00' }]);
      }
      return;
    }

    if (editingType) {
      setCreationMode('booking');
      setNewTitle(editingType.title);
      setNewSlug(editingType.slug);
      setNewDescription(editingType.description || '');
      setNewDuration(editingType.duration_minutes || 30);
      setNewBuffer(editingType.buffer_minutes ?? 10);
      setNewStartHour(editingType.start_hour || '09:00');
      setNewEndHour(editingType.end_hour || '18:00');
      setShowAdvanced(Boolean(editingType.description || editingType.valid_until));
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
      return;
    }

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
    setShowAdvanced(false);
    setInlineTimeTarget(null);
    setCreationMode('booking');
    setMeetingTitle('');
    setMeetingDescription('');
    setMeetingDuration(30);
    const d1 = new Date(Date.now() + 86400000);
    const d2 = new Date(Date.now() + 2 * 86400000);
    setMeetingSlots([
      { date: toDayKey(d1), time: '18:00' },
      { date: toDayKey(d2), time: '18:00' },
    ]);
  }, [editingType, editingMeeting, visible]);

  const autoGenerateSlug = (titleText: string) => {
    setNewTitle(titleText);
    const generated = titleText
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    setNewSlug(generated || 'reuniao');
  };

  const next14DayKeys = useMemo(() => {
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

  const handleSubmitMeeting = async () => {
    if (!meetingTitle.trim() || meetingSlots.length === 0) return;
    setIsSubmitting(true);
    try {
      const slotsPayload = meetingSlots.map((s) =>
        slotBRTToISO(s.date, s.time, meetingDuration)
      );

      if (editingMeeting) {
        const updated = await api.updateMeeting(editingMeeting.id, {
          title: meetingTitle.trim(),
          description: meetingDescription.trim() || undefined,
          duration_minutes: meetingDuration,
          slots: slotsPayload,
        });
        hapticFeedback.success();
        onMeetingUpdated?.(updated);
      } else {
        const created = await api.createMeeting({
          title: meetingTitle.trim(),
          description: meetingDescription.trim() || undefined,
          duration_minutes: meetingDuration,
          mode: 'group_consensus',
          slots: slotsPayload,
        });
        hapticFeedback.success();
        onMeetingCreated?.(created);
      }
      onClose();
    } catch {
      hapticFeedback.medium();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalSubmit = async () => {
    const cleanTitle = newTitle.trim();
    const cleanSlug = (newSlug.trim() || 'reuniao').toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!cleanTitle) return;

    hapticFeedback.medium();
    setIsSubmitting(true);
    try {
      const validityEnd = validityEndFor(newValidity);
      const payload: CreateBookingTypeInput = {
        title: cleanTitle,
        slug: cleanSlug,
        description: newDescription.trim() || undefined,
        duration_minutes: newDuration,
        buffer_minutes: newBuffer,
        start_hour: newStartHour,
        end_hour: newEndHour,
        days_of_week:
          newDaysMode === 'week'
            ? JSON.stringify(newWeekDays.length > 0 ? newWeekDays : [1, 2, 3, 4, 5])
            : editingType?.days_of_week || '[1,2,3,4,5,6,7]',
        valid_from: `${toDayKey(new Date())}T00:00:00`,
        valid_until: validityEnd ? `${validityEnd}T23:59:59` : null,
        allowed_dates:
          newDaysMode === 'dates' && newSpecificDates.length > 0
            ? JSON.stringify(newSpecificDates)
            : null,
      };
      await onSubmit(payload);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const modalTitle = editingMeeting
    ? 'Editar Reunião em Grupo'
    : editingType
      ? 'Editar Link Individual'
      : creationMode === 'meeting'
        ? 'Nova Reunião em Grupo'
        : 'Novo Link de Agendamento';

  const modalSubtitle = editingMeeting
    ? 'Ajuste título, duração ou adicione novos horários na enquete'
    : editingType
      ? 'Ajuste disponibilidade e duração do link'
      : creationMode === 'meeting'
        ? 'Toque nos horários para criar uma votação rápida de grupo'
        : 'Defina sua janela de atendimento em poucos toques';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={modalTitle}
      subtitle={modalSubtitle}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.modalScrollContent}
      >
        {!editingType && !editingMeeting && (
          <View style={[styles.segmentedContainer, { backgroundColor: colors.surfaceContainerHigh }]}>
            <TouchableOpacity
              style={[
                styles.segmentedTab,
                creationMode === 'booking' && [
                  styles.segmentedTabActive,
                  { backgroundColor: colors.surface },
                ],
              ]}
              onPress={() => {
                hapticFeedback.selection();
                setCreationMode('booking');
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="person-outline"
                size={16}
                color={creationMode === 'booking' ? colors.primary : colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.segmentedTabText,
                  { color: creationMode === 'booking' ? colors.onSurface : colors.onSurfaceVariant },
                ]}
              >
                Individual (1-on-1)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.segmentedTab,
                creationMode === 'meeting' && [
                  styles.segmentedTabActive,
                  { backgroundColor: colors.surface },
                ],
              ]}
              onPress={() => {
                hapticFeedback.selection();
                setCreationMode('meeting');
              }}
              activeOpacity={0.8}
            >
              <MaterialIcons
                name="groups"
                size={17}
                color={creationMode === 'meeting' ? colors.primary : colors.onSurfaceVariant}
              />
              <Text
                style={[
                  styles.segmentedTabText,
                  { color: creationMode === 'meeting' ? colors.onSurface : colors.onSurfaceVariant },
                ]}
              >
                Grupo (Votação)
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {creationMode === 'meeting' ? (
          <MeetingPollForm
            title={meetingTitle}
            onChangeTitle={setMeetingTitle}
            description={meetingDescription}
            onChangeDescription={setMeetingDescription}
            duration={meetingDuration}
            onChangeDuration={setMeetingDuration}
            slots={meetingSlots}
            onChangeSlots={setMeetingSlots}
            calendarEvents={calendarEvents}
            isSubmitting={isSubmitting}
            isEditing={Boolean(editingMeeting)}
            onSubmit={handleSubmitMeeting}
          />
        ) : (
          <View style={styles.formContainer}>
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
                placeholder="Ex: Conversa de 30 min, Mentoria, Alinhamento"
                placeholderTextColor={colors.onSurfaceVariant}
                value={newTitle}
                onChangeText={editingType ? setNewTitle : autoGenerateSlug}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.onSurface }]}>
                Duração
              </Text>
              <View style={styles.pillSelectorRow}>
                {[15, 30, 45, 60].map((dur) => (
                  <SelectableChip
                    key={dur}
                    label={`${dur} min`}
                    selected={newDuration === dur}
                    onPress={() => setNewDuration(dur)}
                  />
                ))}
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.rowBetween}>
                <Text style={[styles.formLabel, { color: colors.onSurface }]}>
                  Disponibilidade
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    hapticFeedback.selection();
                    setNewDaysMode(newDaysMode === 'week' ? 'dates' : 'week');
                  }}
                >
                  <Text style={[styles.modeSwitchLink, { color: colors.primary }]}>
                    {newDaysMode === 'week' ? 'Usar datas específicas' : 'Usar dias da semana'}
                  </Text>
                </TouchableOpacity>
              </View>

              {newDaysMode === 'week' ? (
                <View style={styles.pillSelectorRow}>
                  {[
                    { id: 1, label: 'Seg' },
                    { id: 2, label: 'Ter' },
                    { id: 3, label: 'Qua' },
                    { id: 4, label: 'Qui' },
                    { id: 5, label: 'Sex' },
                    { id: 6, label: 'Sáb' },
                    { id: 7, label: 'Dom' },
                  ].map((d) => (
                    <SelectableChip
                      key={d.id}
                      label={d.label}
                      selected={newWeekDays.includes(d.id)}
                      onPress={() => toggleWeekDay(d.id)}
                    />
                  ))}
                </View>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                >
                  {next14DayKeys.map((d) => (
                    <SelectableChip
                      key={d.key}
                      label={`${d.weekday} ${d.label}`}
                      selected={newSpecificDates.includes(d.key)}
                      onPress={() => toggleSpecificDate(d.key)}
                    />
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.formLabel, { color: colors.onSurface }]}>
                Janela de Atendimento
              </Text>
              <View style={styles.pillSelectorRow}>
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
                        setInlineTimeTarget(null);
                      }}
                    />
                  );
                })}
              </View>

              <View style={styles.timeSelectorsRow}>
                <TouchableOpacity
                  style={[
                    styles.timeSelectorButton,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor:
                        inlineTimeTarget === 'start' ? colors.primary : colors.outlineVariant,
                    },
                  ]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setInlineTimeTarget(inlineTimeTarget === 'start' ? null : 'start');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timeSelectorLabel, { color: colors.onSurfaceVariant }]}>
                    Das
                  </Text>
                  <Text style={[styles.timeSelectorValue, { color: colors.onSurface }, tabularNumbers]}>
                    {newStartHour}
                  </Text>
                  <MaterialIcons
                    name={inlineTimeTarget === 'start' ? 'expand-less' : 'expand-more'}
                    size={18}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.timeSelectorButton,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor:
                        inlineTimeTarget === 'end' ? colors.primary : colors.outlineVariant,
                    },
                  ]}
                  onPress={() => {
                    hapticFeedback.selection();
                    setInlineTimeTarget(inlineTimeTarget === 'end' ? null : 'end');
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.timeSelectorLabel, { color: colors.onSurfaceVariant }]}>
                    Até
                  </Text>
                  <Text style={[styles.timeSelectorValue, { color: colors.onSurface }, tabularNumbers]}>
                    {newEndHour}
                  </Text>
                  <MaterialIcons
                    name={inlineTimeTarget === 'end' ? 'expand-less' : 'expand-more'}
                    size={18}
                    color={colors.onSurfaceVariant}
                  />
                </TouchableOpacity>
              </View>

              {inlineTimeTarget && (
                <View
                  style={[
                    styles.inlineHoursBox,
                    {
                      backgroundColor: colors.surfaceContainerHigh,
                      borderColor: colors.outlineVariant,
                    },
                  ]}
                >
                  {AVAILABLE_HOURS.map((h) => {
                    const isSelected =
                      (inlineTimeTarget === 'start' ? newStartHour : newEndHour) === h;
                    return (
                      <TouchableOpacity
                        key={h}
                        style={[
                          styles.inlineHourPill,
                          {
                            backgroundColor: isSelected ? colors.primary : colors.surface,
                            borderColor: isSelected ? colors.primary : colors.outlineVariant,
                          },
                        ]}
                        onPress={() => {
                          hapticFeedback.selection();
                          if (inlineTimeTarget === 'start') {
                            setNewStartHour(h);
                          } else {
                            setNewEndHour(h);
                          }
                          setInlineTimeTarget(null);
                        }}
                      >
                        <Text
                          style={[
                            styles.inlineHourText,
                            { color: isSelected ? colors.onPrimary : colors.onSurface },
                            tabularNumbers,
                          ]}
                        >
                          {h}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.advancedToggle,
                { borderColor: colors.outlineVariant },
              ]}
              onPress={() => {
                hapticFeedback.selection();
                setShowAdvanced(!showAdvanced);
              }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialIcons name="tune" size={16} color={colors.onSurfaceVariant} />
                <Text style={[styles.advancedToggleText, { color: colors.onSurfaceVariant }]}>
                  Opções avançadas (descrição, intervalo, link e expiração)
                </Text>
              </View>
              <MaterialIcons
                name={showAdvanced ? 'expand-less' : 'expand-more'}
                size={18}
                color={colors.onSurfaceVariant}
              />
            </TouchableOpacity>

            {showAdvanced && (
              <View
                style={[
                  styles.advancedBox,
                  {
                    backgroundColor: colors.surfaceContainerHigh,
                    borderColor: colors.outlineVariant,
                  },
                ]}
              >
                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.onSurface }]}>
                    Descrição (Opcional)
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        backgroundColor: colors.surface,
                        color: colors.onSurface,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    placeholder="Contexto ou instruções para o convidado"
                    placeholderTextColor={colors.onSurfaceVariant}
                    value={newDescription}
                    onChangeText={setNewDescription}
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.onSurface }]}>
                    Intervalo de Respiro (Buffer)
                  </Text>
                  <View style={styles.pillSelectorRow}>
                    {[0, 10, 15, 20].map((buf) => (
                      <SelectableChip
                        key={buf}
                        label={buf === 0 ? 'Sem intervalo' : `${buf} min`}
                        selected={newBuffer === buf}
                        onPress={() => setNewBuffer(buf)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.onSurface }]}>
                    Expiração do Link
                  </Text>
                  <View style={styles.pillSelectorRow}>
                    {(
                      [
                        { id: 'none', label: 'Sem expiração' },
                        { id: '7d', label: '7 dias' },
                        { id: '14d', label: '14 dias' },
                        { id: '30d', label: '30 dias' },
                      ] as const
                    ).map((v) => (
                      <SelectableChip
                        key={v.id}
                        label={v.label}
                        selected={newValidity === v.id}
                        onPress={() => setNewValidity(v.id)}
                      />
                    ))}
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={[styles.formLabel, { color: colors.onSurface }]}>
                    Final do Link Personalizado (Slug)
                  </Text>
                  <TextInput
                    style={[
                      styles.formInput,
                      {
                        backgroundColor: colors.surface,
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
                  <Text style={[styles.slugPreviewText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                    vito.rasppi.cloud/book/{bookingUsername}/{newSlug || 'reuniao'}
                  </Text>
                </View>
              </View>
            )}

            <TouchableOpacity
              style={[
                styles.submitModalBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: isSubmitting || !newTitle.trim() ? 0.5 : 1,
                },
              ]}
              onPress={handleModalSubmit}
              disabled={isSubmitting || !newTitle.trim()}
              activeOpacity={0.8}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <Text style={[styles.submitModalText, { color: colors.onPrimary }]}>
                  {editingType ? 'Salvar Alterações' : 'Criar Link de Agendamento'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalScrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 16,
  },
  segmentedContainer: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 14,
  },
  segmentedTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segmentedTabActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentedTabText: {
    fontSize: 13,
    fontWeight: '700',
  },
  formContainer: {
    gap: 16,
  },
  formGroup: {
    gap: 6,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeSwitchLink: {
    fontSize: 12,
    fontWeight: '700',
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
  pillSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  timeSelectorsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  timeSelectorButton: {
    flex: 1,
    height: 44,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timeSelectorLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  timeSelectorValue: {
    fontSize: 14,
    fontWeight: '800',
  },
  inlineHoursBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 12,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
    marginTop: 4,
  },
  inlineHourPill: {
    width: '22.5%',
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inlineHourText: {
    fontSize: 13,
    fontWeight: '700',
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: MD3Shapes.medium,
    borderWidth: 1,
  },
  advancedToggleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  advancedBox: {
    padding: 14,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
    gap: 14,
  },
  slugPreviewText: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  submitModalBtn: {
    height: 50,
    borderRadius: MD3Shapes.large,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  submitModalText: {
    fontSize: 15,
    fontWeight: '700',
  },
});

