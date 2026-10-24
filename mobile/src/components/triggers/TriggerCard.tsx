import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Trigger, TRIGGER_CATEGORIES, TriggerCategory } from '../../types';
import { VitoSwitch } from '../ui/VitoSwitch';

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
    icon: 'tune' as const,
    colorLight: colors.blue,
    colorDark: colors.blue,
    bgLight: colors.blueBg,
    bgDark: 'rgba(43, 127, 212, 0.18)',
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

  const getLastInfo = () => {
    if (trigger.current_value && trigger.target_value) {
      return `R$ ${trigger.current_value} hoje · alvo R$ ${trigger.target_value}`;
    }
    if (trigger.last_run_status) {
      return trigger.last_run_status;
    }
    if (trigger.last_checked_at) {
      try {
        const d = new Date(trigger.last_checked_at);
        const time = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        return `Última checagem hoje às ${time}`;
      } catch {
        // fallback
      }
    }
    return 'O Vito está vigiando ativamente este radar';
  };

  const hasSparkline =
    trigger.condition_type === 'price_below' ||
    trigger.condition_type === 'price_above' ||
    trigger.category === 'travel' ||
    trigger.category === 'finance' ||
    trigger.category === 'shopping' ||
    Boolean(trigger.current_value);

  return (
    <TouchableOpacity
      style={[
        styles.rcard,
        {
          backgroundColor: colors.bg,
          borderColor: colors.line,
        },
        !isActive && styles.rcardOff,
      ]}
      onPress={() => onPress(trigger)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`Radar ${trigger.title}. ${isActive ? 'Ativo' : 'Pausado'}. Toque para ver detalhes.`}
    >
      {/* Topo do card: Chip + Título & Meta + Switch customizado */}
      <View style={styles.rtop}>
        <View style={[styles.chip, { backgroundColor: categoryBg }]}>
          <MaterialIcons name={categoryMeta.icon} size={20} color={categoryColor} />
        </View>

        <View style={styles.textContainer}>
          <Text
            style={[
              styles.title,
              { color: colors.ink, fontFamily: tokens.typography.family.semibold },
            ]}
            numberOfLines={2}
          >
            {trigger.title}
          </Text>
          <View style={styles.meta}>
            <Text style={[styles.catText, { color: categoryColor }]} numberOfLines={1}>
              {categoryMeta.label}
            </Text>
            <Text style={[styles.metaText, { color: colors.muted }]} numberOfLines={1}>
              {' · '}
              {getFrequencyLabel()}
            </Text>
          </View>
        </View>

        <VitoSwitch value={isActive} onValueChange={() => onToggle(trigger.id)} />
      </View>

      {/* Divisória tracejada com última atualização e sparkline SVG */}
      <View style={[styles.lastRow, { borderTopColor: colors.line }]}>
        <View style={[styles.lastDot, { backgroundColor: categoryColor }]} />
        <Text style={[styles.lastText, { color: colors.ink }]} numberOfLines={1}>
          {getLastInfo()}
        </Text>

        {hasSparkline && (
          <View style={styles.sparkWrapper}>
            <Svg width={44} height={22} viewBox="0 0 44 22" fill="none">
              <Path
                d="M2 4l9 3 8 6 8-2 7 6 8 1"
                stroke={categoryColor}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  rcard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    shadowColor: 'rgba(20,25,22,0.04)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 1,
  },
  rcardOff: {
    opacity: 0.55,
  },
  rtop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  chip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15.5,
    lineHeight: 20,
    marginBottom: 2,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  catText: {
    fontSize: 12.5,
    fontFamily: tokens.typography.family.medium,
  },
  metaText: {
    fontSize: 12.5,
    fontFamily: tokens.typography.family.regular,
  },
  lastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderStyle: 'dashed',
  },
  lastDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lastText: {
    flex: 1,
    fontSize: 13,
    fontFamily: tokens.typography.family.regular,
  },
  sparkWrapper: {
    marginLeft: 'auto',
  },
});
