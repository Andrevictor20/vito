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

  // Evita duplicar se a query for idêntica ao título
  const hasDistinctQuery =
    Boolean(trigger.query) &&
    trigger.query.trim().toLowerCase() !== trigger.title.trim().toLowerCase();

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
      accessibilityLabel={`Radar ${trigger.title}. Toque para ver relatórios e histórico.`}
    >
      {/* Top Header do Card: Categoria (Esquerda) & Ações (Direita) */}
      <View style={styles.headerRow}>
        <View style={styles.categoryBadgeRow}>
          <View style={[styles.iconCircle, { backgroundColor: categoryBg }]}>
            <MaterialIcons name={categoryMeta.icon as any} size={15} color={categoryColor} />
          </View>
          <Text
            style={[styles.categoryLabel, { color: categoryColor }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {categoryMeta.label}
          </Text>
        </View>

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
            <MaterialIcons name="edit" size={17} color={isDark ? '#A1A1AA' : '#71717A'} />
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
              size={18}
              color={isDark ? '#71717A' : '#9CA3AF'}
            />
          </TouchableOpacity>

          <View style={styles.switchWrapper}>
            <M3Switch value={isActive} onValueChange={() => onToggle(trigger.id)} />
          </View>
        </View>
      </View>

      {/* Linha de Metadados: Horário / Frequência isolada (nunca colide com ações) */}
      <View style={styles.metaRow}>
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

      {/* Título & Detalhes da Consulta */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.onSurface }]}>{trigger.title}</Text>
        {hasDistinctQuery && (
          <Text
            style={[styles.queryText, { color: colors.onSurfaceVariant }]}
            numberOfLines={2}
          >
            {trigger.query}
          </Text>
        )}
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
            Ver histórico e novidades
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
    marginBottom: 8,
  },
  categoryBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 1,
    maxWidth: '65%',
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
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
    gap: 6,
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
