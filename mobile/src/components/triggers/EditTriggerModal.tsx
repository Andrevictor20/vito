import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { Trigger, TriggerFrequency, TriggerStatus } from '../../types';

interface EditTriggerModalProps {
  visible: boolean;
  trigger: Trigger | null;
  onClose: () => void;
  onSave: (
    id: string,
    updates: {
      title?: string;
      query?: string;
      scheduled_time?: string;
      frequency?: TriggerFrequency;
      status?: TriggerStatus;
    }
  ) => Promise<void>;
  onDelete?: (id: string) => Promise<void> | void;
}

const FREQUENCIES: Array<{ id: TriggerFrequency; label: string }> = [
  { id: 'daily_morning', label: 'Manhã (08:30)' },
  { id: 'daily_evening', label: 'Fim do dia (18h)' },
  { id: 'hourly', label: 'A cada hora' },
  { id: 'immediate', label: 'A cada 5 min' },
];

export const EditTriggerModal: React.FC<EditTriggerModalProps> = ({
  visible,
  trigger,
  onClose,
  onSave,
  onDelete,
}) => {
  const { colors, isDark } = useTheme();

  const [title, setTitle] = useState('');
  const [query, setQuery] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [frequency, setFrequency] = useState<TriggerFrequency>('daily_morning');
  const [status, setStatus] = useState<TriggerStatus>('active');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (trigger) {
      setTitle(trigger.title);
      setQuery(trigger.query);
      setScheduledTime(trigger.scheduled_time || '');
      setFrequency(trigger.frequency || 'daily_morning');
      setStatus(trigger.status || 'active');
      setAdvancedOpen(false);
      setError(null);
    }
  }, [trigger, visible]);

  if (!trigger) return null;

  const handleSave = async () => {
    if (!title.trim()) {
      setError('O título do radar é obrigatório.');
      return;
    }
    if (!query.trim()) {
      setError('A instrução de monitoramento é obrigatória.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(trigger.id, {
        title: title.trim(),
        query: query.trim(),
        scheduled_time: scheduledTime.trim(),
        frequency,
        status,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Falha ao salvar alterações.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!trigger || !onDelete) return;

    if (Platform.OS === 'web') {
      const confirmed = typeof window !== 'undefined' ? window.confirm(`Deseja parar de acompanhar "${trigger.title}"?`) : true;
      if (confirmed) {
        onDelete(trigger.id);
        onClose();
      }
      return;
    }

    Alert.alert(
      'Remover radar',
      `Deseja parar de acompanhar "${trigger.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => {
            onDelete(trigger.id);
            onClose();
          },
        },
      ]
    );
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Editar Radar"
      subtitle={trigger.title}
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {!!error && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="error-outline" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>TÍTULO</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? colors.surfaceContainerLow : '#FAFAFA',
              color: colors.onSurface,
              borderColor: colors.outlineVariant,
            },
          ]}
          value={title}
          onChangeText={setTitle}
          placeholder="Ex: Cotação Dólar PTAX"
          placeholderTextColor={colors.onSurfaceVariant}
          accessibilityLabel="Título do radar"
        />

        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>O QUE ACOMPANHAR</Text>
        <TextInput
          style={[
            styles.textArea,
            {
              backgroundColor: isDark ? colors.surfaceContainerLow : '#FAFAFA',
              color: colors.onSurface,
              borderColor: colors.outlineVariant,
            },
          ]}
          value={query}
          onChangeText={setQuery}
          multiline
          numberOfLines={3}
          placeholder="Ex: Acompanhe o dólar e me avise se passar de R$ 5,60"
          placeholderTextColor={colors.onSurfaceVariant}
          accessibilityLabel="Instrução de monitoramento"
        />

        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>FREQUÊNCIA</Text>
        <View style={styles.grid}>
          {FREQUENCIES.map((f) => {
            const active = frequency === f.id;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.chip,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => setFrequency(f.id)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Frequência ${f.label}`}
              >
                <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={[styles.groupLabel, { color: colors.textMuted }]}>STATUS</Text>
        <View style={styles.statusRow}>
          {(['active', 'paused'] as const).map((s) => {
            const active = status === s;
            return (
              <TouchableOpacity
                key={s}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                    borderColor: colors.outlineVariant,
                  },
                ]}
                onPress={() => setStatus(s)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={s === 'active' ? 'Radar ativo' : 'Radar pausado'}
              >
                <MaterialIcons
                  name={s === 'active' ? 'check-circle' : 'pause-circle-outline'}
                  size={16}
                  color={active ? colors.onPrimary : colors.onSurfaceVariant}
                />
                <Text style={[styles.chipText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                  {s === 'active' ? 'Ativo' : 'Pausado'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setAdvancedOpen((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: advancedOpen }}
          accessibilityLabel="Horário exato opcional"
        >
          <Text style={[styles.advancedToggleText, { color: colors.onSurfaceVariant }]}>
            Horário exato (opcional)
          </Text>
          <MaterialIcons
            name={advancedOpen ? 'expand-less' : 'expand-more'}
            size={20}
            color={colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {advancedOpen && (
          <View style={styles.timeRow}>
            <TextInput
              style={[
                styles.input,
                styles.timeInput,
                {
                  backgroundColor: isDark ? colors.surfaceContainerLow : '#FAFAFA',
                  color: colors.onSurface,
                  borderColor: colors.outlineVariant,
                },
              ]}
              value={scheduledTime}
              onChangeText={setScheduledTime}
              placeholder="15:30"
              placeholderTextColor={colors.onSurfaceVariant}
              maxLength={5}
              accessibilityLabel="Horário exato HH MM"
            />
            <Text style={[styles.timeHint, { color: colors.onSurfaceVariant }]}>
              Vazio = usa a frequência acima.
            </Text>
          </View>
        )}

        <View style={styles.footer}>
          {onDelete ? (
            <TouchableOpacity
              style={[styles.deleteBtn, { borderColor: '#EF4444' }]}
              onPress={handleDelete}
              disabled={saving}
              activeOpacity={0.8}
              accessibilityLabel="Remover este radar"
              accessibilityRole="button"
            >
              <MaterialIcons name="delete-outline" size={17} color="#EF4444" />
              <Text style={styles.deleteText}>Excluir</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.85}
            accessibilityLabel="Salvar alterações"
            accessibilityRole="button"
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="check" size={18} color={colors.onPrimary} />
                <Text style={[styles.saveText, { color: colors.onPrimary }]}>Salvar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 10,
    borderRadius: 12,
    marginBottom: 4,
    gap: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 44,
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    gap: 8,
  },
  statusChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    minHeight: 48,
  },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  advancedToggleText: {
    fontSize: 13,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeInput: {
    width: 110,
  },
  timeHint: {
    fontSize: 12,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: tokens.spacing.lg,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    minHeight: 48,
    justifyContent: 'center',
  },
  deleteText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
