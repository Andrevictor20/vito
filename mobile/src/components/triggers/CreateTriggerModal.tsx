import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput as RNTextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import {
  CreateTriggerInput,
  TriggerCategory,
  TriggerFrequency,
  TRIGGER_CATEGORIES,
} from '../../types';

interface CreateTriggerModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (input: CreateTriggerInput) => Promise<any>;
}

const QUICK_EXAMPLES = [
  { text: 'Acompanhe as ações da PETR3 e avise se passar de R$ 35', cat: 'finance' },
  { text: 'Avise se voos GRU para JFK ficarem abaixo de R$ 3.000', cat: 'travel' },
  { text: 'Avise-me se houver alerta de chuva forte no sábado', cat: 'weather' },
];

const FREQUENCIES: Array<{ id: TriggerFrequency; label: string }> = [
  { id: 'daily_morning', label: 'Matinal (08h)' },
  { id: 'hourly', label: 'Horária' },
  { id: 'immediate', label: 'Imediata' },
];

export const CreateTriggerModal: React.FC<CreateTriggerModalProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const { colors, isDark } = useTheme();
  const [promptText, setPromptText] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<TriggerCategory>('finance');
  const [frequency, setFrequency] = useState<TriggerFrequency>('daily_morning');
  const [submitting, setSubmitting] = useState(false);

  const handleSave = async () => {
    if (!promptText.trim()) {
      Alert.alert('Atenção', 'Digite o que você gostaria que o Vito monitorasse.');
      return;
    }
    const trimmed = promptText.trim();
    setSubmitting(true);
    try {
      await onSubmit({
        title: trimmed.length > 45 ? trimmed.slice(0, 42) + '...' : trimmed,
        query: trimmed,
        category: selectedCategory,
        frequency,
      });
      setPromptText('');
      setAdvancedOpen(false);
      onClose();
    } catch (err: any) {
      Alert.alert('Erro ao criar radar', err?.message || 'Tente novamente em instantes.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Novo Radar"
      subtitle="O Vito pesquisa e avisa das novidades"
    >
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View
          style={[
            styles.textAreaContainer,
            {
              backgroundColor: isDark ? colors.surfaceContainerLowest : '#FAFAFA',
              borderColor: colors.outlineVariant,
            },
          ]}
        >
          <RNTextInput
            style={[styles.textArea, { color: colors.onSurface }]}
            placeholder="Ex: Avise-me se as ações da AAPL subirem mais de 3% hoje..."
            placeholderTextColor={isDark ? '#71717A' : '#A1A1AA'}
            multiline
            numberOfLines={3}
            value={promptText}
            onChangeText={setPromptText}
            textAlignVertical="top"
            accessibilityLabel="O que o Vito deve monitorar"
          />
        </View>

        <View style={styles.examplesRow}>
          {QUICK_EXAMPLES.map((ex, idx) => (
            <TouchableOpacity
              key={idx}
              style={[
                styles.exampleChip,
                {
                  backgroundColor: isDark ? colors.surfaceContainerLow : '#F4F4F5',
                  borderColor: colors.outlineVariant,
                },
              ]}
              onPress={() => setPromptText(ex.text)}
              activeOpacity={0.8}
              accessibilityLabel={`Exemplo: ${ex.text}`}
            >
              <Text style={[styles.exampleText, { color: colors.onSurface }]} numberOfLines={1}>
                {ex.text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.advancedToggle}
          onPress={() => setAdvancedOpen((v) => !v)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: advancedOpen }}
          accessibilityLabel="Opções avançadas"
        >
          <Text style={[styles.advancedToggleText, { color: colors.onSurfaceVariant }]}>
            Avançado
          </Text>
          <MaterialIcons
            name={advancedOpen ? 'expand-less' : 'expand-more'}
            size={20}
            color={colors.onSurfaceVariant}
          />
        </TouchableOpacity>

        {advancedOpen && (
          <View>
            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>CATEGORIA</Text>
            <View style={styles.grid}>
              {TRIGGER_CATEGORIES.map((cat) => {
                const active = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.catChip,
                      {
                        backgroundColor: active ? colors.primary : colors.surfaceContainerLow,
                        borderColor: colors.outlineVariant,
                      },
                    ]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.8}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Categoria ${cat.label}`}
                  >
                    <MaterialIcons
                      name={cat.icon}
                      size={15}
                      color={active ? colors.onPrimary : colors.onSurfaceVariant}
                    />
                    <Text style={[styles.catText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={[styles.groupLabel, { color: colors.textMuted }]}>FREQUÊNCIA</Text>
            <View style={styles.grid}>
              {FREQUENCIES.map((f) => {
                const active = frequency === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    style={[
                      styles.catChip,
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
                    <Text style={[styles.catText, { color: active ? colors.onPrimary : colors.onSurface }]}>
                      {f.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.cancelBtn, { borderColor: colors.outlineVariant }]}
            onPress={onClose}
            disabled={submitting}
            activeOpacity={0.8}
            accessibilityLabel="Cancelar"
            accessibilityRole="button"
          >
            <Text style={[styles.cancelText, { color: colors.onSurface }]}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: colors.primary }]}
            onPress={handleSave}
            disabled={submitting}
            activeOpacity={0.85}
            accessibilityLabel="Criar radar"
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <>
                <MaterialIcons name="add" size={18} color={colors.onPrimary} />
                <Text style={[styles.saveText, { color: colors.onPrimary }]}>Criar Radar</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  textAreaContainer: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  textArea: {
    fontSize: 14,
    minHeight: 72,
  },
  examplesRow: {
    gap: 6,
    marginBottom: 4,
  },
  exampleChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  exampleText: {
    fontSize: 12,
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
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    marginTop: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    minHeight: 44,
  },
  catText: {
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: tokens.spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
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
