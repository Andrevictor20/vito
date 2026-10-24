import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
  ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { VitoMascot } from '../common/VitoMascot';
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

const EXAMPLES = [
  { label: 'Preço de voo', prompt: 'Avisar quando o voo para o Rio baixar de R$ 600' },
  { label: 'Edital', prompt: 'Novos editais de concurso na minha área' },
  { label: 'Fatura', prompt: 'Lembrar da fatura do cartão todo mês' },
  { label: 'Notícias de IA', prompt: 'Resumo diário de notícias sobre IA' },
];

export const NaturalPromptInput: React.FC<NaturalPromptInputProps> = ({
  selectedCategory,
  onCategoryChange,
  categoryCounts,
  totalCount,
  filteredCount,
  onCreateFromPrompt,
}) => {
  const { colors } = useTheme();
  const [naturalPrompt, setNaturalPrompt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [promptError, setPromptError] = useState<string | null>(null);

  const handleSubmit = async (overridePrompt?: string) => {
    const text = (overridePrompt ?? naturalPrompt).trim();
    if (!text) return;

    setIsSubmitting(true);
    setPromptError(null);
    Keyboard.dismiss();

    try {
      const parsed = await api.parseTriggerPrompt(text);
      const parsedCondition = parsed.condition_type;
      const conditionType =
        parsedCondition === 'price_above' ||
        parsedCondition === 'price_below' ||
        parsedCondition === 'event_upcoming' ||
        parsedCondition === 'change_detected'
          ? parsedCondition
          : 'daily_brief';

      await onCreateFromPrompt({
        title: parsed.suggested_title || text,
        category: parsed.category,
        query: text,
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

  const handleSelectExample = (prompt: string) => {
    setNaturalPrompt(prompt);
  };

  const selectedCategoryLabel =
    selectedCategory === 'all'
      ? null
      : TRIGGER_CATEGORIES.find((c) => c.id === selectedCategory)?.label ?? selectedCategory;

  const hasText = !!naturalPrompt.trim();

  return (
    <View style={styles.container}>
      {/* Barra de input .ask2 */}
      <View
        style={[
          styles.ask2,
          {
            backgroundColor: colors.bg,
            borderColor: colors.line,
          },
        ]}
      >
        <View style={styles.mascotWrapper}>
          <VitoMascot size={26} state={isSubmitting ? 'thinking' : 'idle'} animated={true} />
        </View>

        <TextInput
          style={[styles.input, { color: colors.ink }]}
          value={naturalPrompt}
          onChangeText={setNaturalPrompt}
          placeholder="No que quer ficar de olho?"
          placeholderTextColor={colors.muted}
          onSubmitEditing={() => handleSubmit()}
          returnKeyType="send"
          editable={!isSubmitting}
        />

        <TouchableOpacity
          style={[
            styles.sendButton,
            {
              backgroundColor: hasText ? colors.ink : colors.line,
            },
          ]}
          onPress={() => handleSubmit()}
          disabled={!hasText || isSubmitting}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Criar radar"
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={hasText ? colors.bg : colors.muted} />
          ) : (
            <MaterialIcons
              name="arrow-upward"
              size={18}
              color={hasText ? colors.bg : colors.muted}
            />
          )}
        </TouchableOpacity>

        <RadarFilterButton
          selected={selectedCategory}
          onChange={onCategoryChange}
          counts={categoryCounts}
          total={totalCount}
          resultCount={filteredCount}
        />
      </View>

      {/* Chips de exemplos .ex */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.exContainer}
      >
        {EXAMPLES.map((ex, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.exChip,
              {
                backgroundColor: colors.bg,
                borderColor: colors.line,
              },
            ]}
            onPress={() => handleSelectExample(ex.prompt)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Exemplo: ${ex.label}`}
          >
            <Text style={[styles.exChipText, { color: colors.ink }]}>{ex.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {!!promptError && <Text style={[styles.inputErrorText, { color: colors.red }]}>{promptError}</Text>}

      {!!selectedCategoryLabel && (
        <View style={styles.activeFilterRow}>
          <Text style={[styles.activeFilterText, { color: colors.muted }]}>
            {selectedCategoryLabel} · {filteredCount} {filteredCount === 1 ? 'radar' : 'radares'}
          </Text>
          <TouchableOpacity
            onPress={() => onCategoryChange('all')}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Limpar filtro de categoria"
            accessibilityRole="button"
          >
            <Text style={[styles.activeFilterClear, { color: colors.acc }]}>Limpar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  ask2: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 5,
    gap: 8,
    shadowColor: 'rgba(20,25,22,0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  mascotWrapper: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: tokens.typography.family.regular,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
    paddingBottom: 2,
  },
  exChip: {
    borderWidth: 1,
    borderRadius: 16,
    height: 32,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exChipText: {
    fontFamily: tokens.typography.family.medium,
    fontSize: 13,
  },
  activeFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingTop: 8,
  },
  activeFilterText: {
    fontSize: 12,
    fontFamily: tokens.typography.family.medium,
  },
  activeFilterClear: {
    fontSize: 12,
    fontFamily: tokens.typography.family.bold,
  },
  inputErrorText: {
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 4,
    fontFamily: tokens.typography.family.regular,
  },
});
