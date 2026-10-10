import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Trigger, TRIGGER_CATEGORIES, TriggerCategory } from '../../types';
import { M3Switch } from '../ui/M3Switch';

interface TriggerCardProps {
  trigger: Trigger;
  onToggle: (id: string) => void;
  onEdit: (trigger: Trigger) => void;
  onDelete: (id: string) => void;
  onPress: (trigger: Trigger) => void;
}

export const TriggerCard: React.FC<TriggerCardProps> = ({
  trigger,
  onToggle,
  onEdit,
  onDelete,
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

  const handleDeletePress = () => {
    Alert.alert(
      'Remover radar',
      `Deseja parar de acompanhar "${trigger.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: () => onDelete(trigger.id),
        },
      ]
    );
  };

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
          backgroundColor: isDark ? colors.surfaceContainerLow : '#FFFFFF',
          borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
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
          <MaterialIcons name={categoryMeta.icon as any} size={18} color={categoryColor} />
        </View>

        {/* Informações Centrais: Título + Linha de Meta (Categoria • Horário) */}
        <View style={styles.textContainer}>
          <Text
            style={[styles.title, { color: colors.onSurface }]}
            numberOfLines={1}
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

        {/* Ações Rápidas: Editar + Excluir + Switch On/Off + Seta */}
        <View style={styles.actionsRight}>
          <TouchableOpacity
            style={styles.actionIconButton}
            onPress={(e) => {
              e.stopPropagation();
              onEdit(trigger);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Editar radar"
          >
            <MaterialIcons name="edit" size={16} color={isDark ? '#A1A1AA' : '#71717A'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionIconButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDeletePress();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Remover radar"
          >
            <MaterialIcons
              name="delete-outline"
              size={17}
              color={isDark ? '#71717A' : '#9CA3AF'}
            />
          </TouchableOpacity>

          <View style={styles.switchWrapper}>
            <M3Switch value={isActive} onValueChange={() => onToggle(trigger.id)} />
          </View>

          <MaterialIcons
            name="chevron-right"
            size={18}
            color={colors.onSurfaceVariant}
            style={styles.chevron}
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: MD3Shapes.large,
    paddingHorizontal: 12,
    paddingVertical: 10,
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
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
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
    letterSpacing: 0.3,
  },
  metaDot: {
    fontSize: 10,
    opacity: 0.6,
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIconButton: {
    padding: 3,
  },
  switchWrapper: {
    marginLeft: 2,
    transform: [{ scale: 0.85 }],
  },
  chevron: {
    marginLeft: -2,
  },
});
