import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { RadarFilterButton } from './RadarFilterButton';
import { TriggerCategory, TRIGGER_CATEGORIES } from '../../types';
import { api } from '../../services/api';

interface NaturalPromptInputProps {
  selectedCategory: TriggerCategory | 'all';
  onCategoryChange: (category: TriggerCategory | 'all') => void;
  categoryCounts: Record<string, number>;
  totalCount: number;
  filteredCount: number;
  onCreateFromPrompt: (input: {
    title: string;
    category: TriggerCategory;
    query: string;
    condition_type?: 'daily_brief' | 'price_above' | 'price_below' | 'event_upcoming' | 'change_detected';
  }) => Promise<any>;
}

export const NaturalPromptInput: React.FC<NaturalPromptInputProps> = ({
  selectedCategory,
  onCategoryChange,
  categoryCounts,
  totalCount,
  filteredCount,
  onCreateFromPrompt,
}) => {
  const { colors, isDark } = useTheme();
  const [naturalPrompt, setNaturalPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const trimmed = naturalPrompt.trim();
    if (!trimmed) return;

    setIsSubmitting(true);
    setPromptError(null);
    Keyboard.dismiss();

    try {
      const parsed = await api.parseTriggerPrompt(trimmed);
      const parsedCondition = parsed.condition_type;
      const conditionType =
        parsedCondition === 'price_above' ||
        parsedCondition === 'price_below' ||
        parsedCondition === 'event_upcoming' ||
        parsedCondition === 'change_detected'
          ? parsedCondition
          : 'daily_brief';

      await onCreateFromPrompt({
        title: parsed.suggested_title || trimmed,
        category: parsed.category,
        query: trimmed,
        condition_type: conditionType,
      });
      setNaturalPrompt('');
    } catch (err: any) {
      console.error('[NaturalPromptInput] Erro ao interpretar prompt:', err);
      setPromptError(err?.message || 'Falha ao interpretar pedido. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategoryLabel =
    selectedCategory === 'all'
      ? null
      : TRIGGER_CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? selectedCategory;

  return (
    <View style={styles.inputSection}>
      <View style={styles.inputRow}>
        <View
          style={[
            styles.inputCard,
            {
              backgroundColor: isDark ? colors.surfaceContainerLow : '#FFFFFF',
              borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.08)',
            },
          ]}
        >
          <MaterialIcons name="auto-awesome" size={20} color={colors.primary} />
          <TextInput
            style={[styles.naturalInput, { color: colors.onSurface }]}
            value={naturalPrompt}
            onChangeText={setNaturalPrompt}
            placeholder="No que quer ficar de olho?"
            placeholderTextColor={colors.onSurfaceVariant}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            editable={!isSubmitting}
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: colors.primary },
              (!naturalPrompt.trim() || isSubmitting) && { opacity: 0.5 },
            ]}
            onPress={handleSubmit}
            disabled={!naturalPrompt.trim() || isSubmitting}
            accessibilityRole="button"
            accessibilityLabel="Criar radar a partir do texto"
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <MaterialIcons name="arrow-forward" size={16} color={colors.onPrimary} />
            )}
          </TouchableOpacity>
        </View>

        <RadarFilterButton
          selected={selectedCategory}
          onChange={onCategoryChange}
          counts={categoryCounts}
          total={totalCount}
          resultCount={filteredCount}
        />
      </View>

      {!!promptError && <Text style={styles.inputErrorText}>{promptError}</Text>}

      {!!selectedCategoryLabel && (
        <View style={styles.activeFilterRow}>
          <Text style={[styles.activeFilterText, { color: colors.textMuted }]}>
            {selectedCategoryLabel} · {filteredCount} {filteredCount === 1 ? 'radar' : 'radares'}
          </Text>
          <TouchableOpacity
            onPress={() => onCategoryChange('all')}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Limpar filtro de categoria"
            accessibilityRole="button"
          >
            <Text style={[styles.activeFilterClear, { color: colors.primary }]}>Limpar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  inputSection: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '500',
  },
  activeFilterClear: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: MD3Shapes.largeIncreased,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  naturalInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 4,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputErrorText: {
    color: '#EF4444',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
});
