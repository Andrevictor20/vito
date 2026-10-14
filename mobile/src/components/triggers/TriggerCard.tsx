import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Trigger, TRIGGER_CATEGORIES, TriggerCategory } from '../../types';
import { M3Switch } from '../ui/M3Switch';

interface TriggerCardProps {
  trigger: Trigger;
  onToggle: (id: string) => void;
  onPress: (trigger: Trigger) => void;
}

export const TriggerCard: React.FC<TriggerCardProps> = ({
  trigger,
  onToggle,
  onPress,
}) => {
  const { colors, isDark } = useTheme();

  const categoryMeta = TRIGGER_CATEGORIES.find((c) => c.id === trigger.category) || {
    id: trigger.category as TriggerCategory,
    label: 'Geral',
    icon: 'tune',
    colorLight: '#4B5563',
    colorDark: '#9CA3AF',
    bgLight: '#F3F4F6',
    bgDark: '#1F2937',
    placeholder: '',
  };

  const isActive = trigger.status === 'active';
  const categoryColor = isDark ? categoryMeta.colorDark : categoryMeta.colorLight;
  const categoryBg = isDark ? categoryMeta.bgDark : categoryMeta.bgLight;

  const getFrequencyLabel = () => {
    if (trigger.scheduled_time) {
      return `Diário às ${trigger.scheduled_time}`;
    }
    switch (trigger.frequency) {
      case 'hourly':
        return 'A cada hora';
      case 'daily_evening':
        return 'Diário às 18:00';
      case 'immediate':
        return 'Em tempo real';
      case 'daily_morning':
      default:
        return 'Diário às 08:30';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
          opacity: isActive ? 1 : 0.75,
        },
      ]}
      onPress={() => onPress(trigger)}
      activeOpacity={0.7}
      accessibilityLabel={`Radar ${trigger.title}. Toque para ver relatórios e histórico.`}
    >
      <View style={styles.contentRow}>
        {/* Ícone da Categoria com container circular tonal */}
        <View style={[styles.iconCircle, { backgroundColor: categoryBg }]}>
          <MaterialIcons name={categoryMeta.icon} size={18} color={categoryColor} />
        </View>

        {/* Informações Centrais: Título (2 linhas) + Meta (Categoria • Horário) */}
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, { color: colors.onSurface }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {trigger.title}
          </Text>
          <View style={styles.metaRow}>
            <Text
              style={[styles.categoryLabel, { color: categoryColor }]}
              numberOfLines={1}
            >
              {categoryMeta.label}
            </Text>
            <Text style={[styles.metaDot, { color: colors.onSurfaceVariant }]}>•</Text>
            <MaterialIcons name="schedule" size={11} color={colors.onSurfaceVariant} />
            <Text style={[styles.timeText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {getFrequencyLabel()}
            </Text>
          </View>
        </View>

        {/* Só o Switch: editar/excluir vivem na tela de detalhes (toque no card) */}
        <View style={styles.actionsRight}>
          <View style={styles.switchWrapper}>
            <M3Switch value={isActive} onValueChange={() => onToggle(trigger.id)} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: MD3Shapes.largeIncreased,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    minHeight: 58,
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
    marginHorizontal: 10,
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.1,
    lineHeight: 21,
    marginBottom: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metaDot: {
    fontSize: 10,
    opacity: 0.6,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  switchWrapper: {
    transform: [{ scale: 0.85 }],
  },
});
