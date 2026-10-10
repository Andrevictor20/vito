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
  onDelete: (id: string) => void;
}

export const TriggerCard: React.FC<TriggerCardProps> = ({
  trigger,
  onToggle,
  onDelete,
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
    switch (trigger.frequency) {
      case 'hourly':
        return 'A cada hora';
      case 'daily_evening':
        return 'Diário no final do dia';
      case 'immediate':
        return 'Alerta imediato';
      case 'daily_morning':
      default:
        return 'Diário pela manhã';
    }
  };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? colors.surfaceContainerLow : '#FFFFFF',
          borderColor: isDark ? colors.outlineVariant : 'rgba(0,0,0,0.06)',
          opacity: isActive || isTriggered ? 1 : 0.72,
        },
      ]}
    >
      {/* Top Header do Card: Categoria, Status Badge & Ações */}
      <View style={styles.headerRow}>
        <View style={styles.categoryBadgeRow}>
          <View style={[styles.iconCircle, { backgroundColor: categoryBg }]}>
            <MaterialIcons
              name={categoryMeta.icon as any}
              size={18}
              color={categoryColor}
            />
          </View>
          <Text style={[styles.categoryLabel, { color: categoryColor }]}>
            {categoryMeta.label}
          </Text>
        </View>

        <View style={styles.actionsRight}>
          {isTriggered && (
            <View style={[styles.statusBadge, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
              <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
              <Text style={[styles.statusText, { color: '#EF4444' }]}>Disparado</Text>
            </View>
          )}

          {!isTriggered && (
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isActive
                    ? 'rgba(16, 185, 129, 0.12)'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: isActive ? '#10B981' : isDark ? '#71717A' : '#A1A1AA' },
                ]}
              />
              <Text
                style={[
                  styles.statusText,
                  { color: isActive ? '#10B981' : isDark ? '#A1A1AA' : '#71717A' },
                ]}
              >
                {isActive ? 'Ativo' : 'Pausado'}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeletePress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityLabel="Excluir monitoramento"
          >
            <MaterialIcons
              name="delete-outline"
              size={20}
              color={isDark ? '#71717A' : '#9CA3AF'}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Título & Detalhes da Consulta */}
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.onSurface }]}>
          {trigger.title}
        </Text>

        <Text style={[styles.queryText, { color: colors.onSurfaceVariant }]}>
          {trigger.query}
        </Text>

        {/* Card Toki Hero: Valor Atual / Achado de Inteligência */}
        {trigger.current_value ? (
          <View
            style={[
              styles.currentValueCard,
              {
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                borderColor: isDark ? colors.outlineVariant : 'rgba(0, 0, 0, 0.05)',
              },
            ]}
          >
            <View style={styles.valueRow}>
              <MaterialIcons
                name="info-outline"
                size={16}
                color={categoryColor}
              />
              <Text style={[styles.currentValueText, { color: colors.onSurface }]}>
                {trigger.current_value}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      {/* Rodapé: Frequência & M3Switch de Ativar/Desativar */}
      <View
        style={[
          styles.footerRow,
          { borderTopColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)' },
        ]}
      >
        <View style={styles.frequencyInfo}>
          <MaterialIcons
            name="schedule"
            size={15}
            color={isDark ? '#A1A1AA' : '#71717A'}
          />
          <Text style={[styles.frequencyText, { color: colors.onSurfaceVariant }]}>
            {getFrequencyLabel()}
          </Text>
        </View>

        <View style={styles.switchContainer}>
          <M3Switch
            value={isActive}
            onValueChange={() => onToggle(trigger.id)}
          />
        </View>
      </View>
    </View>
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
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  categoryLabel: {
    fontSize: tokens.typography.size.labelMedium,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  actionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginRight: 8,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  deleteButton: {
    padding: 4,
  },
  body: {
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  queryText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  currentValueCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentValueText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
  },
  frequencyInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  frequencyText: {
    fontSize: 12,
    marginLeft: 5,
  },
  switchContainer: {
    transform: [{ scale: 0.85 }],
  },
});
