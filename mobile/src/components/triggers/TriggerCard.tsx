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
  const isTriggered = trigger.status === 'triggered';

  const categoryColor = isDark ? categoryMeta.colorDark : categoryMeta.colorLight;
  const categoryBg = isDark ? categoryMeta.bgDark : categoryMeta.bgLight;

  const handleDeletePress = () => {
    Alert.alert(
      'Excluir disparador',
      `Deseja realmente remover o monitoramento de "${trigger.title}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
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
        return 'Alerta frequente';
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
      activeOpacity={0.85}
      accessibilityLabel={`Disparador ${trigger.title}. Toque para ver relatórios.`}
    >
      {/* Top Header do Card: Categoria, Horário & Ações */}
      <View style={styles.headerRow}>
        <View style={styles.categoryBadgeRow}>
          <View style={[styles.iconCircle, { backgroundColor: categoryBg }]}>
            <MaterialIcons name={categoryMeta.icon as any} size={16} color={categoryColor} />
          </View>
          <Text style={[styles.categoryLabel, { color: categoryColor }]}>
            {categoryMeta.label}
          </Text>
          <View
            style={[
              styles.timePill,
              { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
            ]}
          >
            <MaterialIcons name="schedule" size={12} color={colors.onSurfaceVariant} />
            <Text style={[styles.timePillText, { color: colors.onSurfaceVariant }]}>
              {getFrequencyLabel()}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRight}>
          <TouchableOpacity
            style={styles.actionIconButton}
            onPress={(e) => {
              e.stopPropagation();
              onEdit(trigger);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Editar disparador"
          >
            <MaterialIcons name="edit" size={18} color={isDark ? '#A1A1AA' : '#71717A'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionIconButton}
            onPress={(e) => {
              e.stopPropagation();
              handleDeletePress();
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Excluir disparador"
          >
            <MaterialIcons
              name="delete-outline"
              size={18}
              color={isDark ? '#71717A' : '#9CA3AF'}
            />
          </TouchableOpacity>

          <View style={styles.switchWrapper}>
            <M3Switch value={isActive} onValueChange={() => onToggle(trigger.id)} />
          </View>
        </View>
      </View>

      {/* Título & Detalhes da Consulta */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{trigger.title}</Text>
        <Text
          style={[styles.queryText, { color: colors.onSurfaceVariant }]}
          numberOfLines={2}
        >
          {trigger.query}
        </Text>
      </View>

      {/* Footer Minimalista: Atalho para Relatórios */}
      <View
        style={[
          styles.footerRow,
          { borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' },
        ]}
      >
        <View style={styles.reportHintRow}>
          <MaterialIcons name="history" size={15} color={colors.primary} />
          <Text style={[styles.reportHintText, { color: colors.primary }]}>
            Ver relatórios e histórico
          </Text>
        </View>
        <MaterialIcons name="chevron-right" size={18} color={colors.onSurfaceVariant} />
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: MD3Shapes.largeIncreased,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
    gap: 4,
  },
  timePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionIconButton: {
    padding: 4,
  },
  switchWrapper: {
    marginLeft: 2,
  },
  body: {
    gap: 4,
    marginBottom: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  queryText: {
    fontSize: 13,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  reportHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reportHintText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
