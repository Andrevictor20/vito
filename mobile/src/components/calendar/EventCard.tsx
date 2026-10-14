import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes, tabularNumbers } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Event } from '../../types';
import { isAllDayEvent } from '../../utils/calendarDateUtils';

interface EventCardProps {
  event: Event;
  onDelete: (id: string, allSeries?: boolean) => void;
  onPress?: (event: Event) => void;
  onRequestDelete?: (event: Event) => void;
  accentColor?: string;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onDelete,
  onPress,
  onRequestDelete,
}) => {
  const { colors, isDark } = useTheme();
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const isAllDay = isAllDayEvent(event);
  const startTime = formatTime(event.start_at);
  const endTime = event.end_at ? formatTime(event.end_at) : '';
  const timeDisplay = isAllDay ? 'Dia Inteiro' : (endTime ? `${startTime} – ${endTime}` : startTime);

  let dayNum = '';
  let monthShort = '';
  try {
    const startDate = new Date(event.start_at);
    dayNum = startDate.toLocaleDateString('pt-BR', { day: '2-digit' });
    monthShort = startDate.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  } catch {
    dayNum = '';
    monthShort = '';
  }

  // Inferir categoria e cores semânticas M3 para a tag
  const getCategory = () => {
    const text = `${event.title} ${event.description || ''}`.toLowerCase();
    const isHoliday = event.category === 'holiday' || (isAllDay && (
      text.includes('feriado') || text.includes('nossa senhora') || text.includes('aparecida') ||
      text.includes('tiradentes') || text.includes('páscoa') || text.includes('pascoa') ||
      text.includes('natal') || text.includes('ano novo') || text.includes('trabalho') ||
      text.includes('independência') || text.includes('independencia') || text.includes('finados') ||
      text.includes('república') || text.includes('republica') || text.includes('consciência') ||
      text.includes('consciencia') || text.includes('carnaval') || text.includes('corpus christi')
    ));

    if (isHoliday) {
      return {
        label: 'FERIADO',
        bg: isDark ? 'rgba(245, 158, 11, 0.18)' : 'rgba(245, 158, 11, 0.12)',
        text: isDark ? '#FBBF24' : '#F59E0B',
        border: 'rgba(245, 158, 11, 0.4)',
      };
    }

    if (event.category) {
      const catColorMap: Record<string, { label: string; color: string; container: string }> = {
        work: { label: 'TRABALHO', color: colors.accents.sky, container: colors.accents.skyContainer },
        health: { label: 'SAÚDE', color: colors.accents.mint, container: colors.accents.mintContainer },
        finance: { label: 'FINANÇAS', color: colors.accents.coral, container: colors.accents.coralContainer },
        study: { label: 'ESTUDO', color: colors.accents.indigo, container: colors.accents.indigoContainer },
        leisure: { label: 'LAZER', color: colors.accents.orange, container: colors.accents.orangeContainer },
        personal: { label: 'PESSOAL', color: colors.accents.emerald, container: colors.accents.emeraldContainer },
        general: { label: 'COMPROMISSO', color: colors.primary, container: colors.surfaceContainerHighest },
      };
      const found = catColorMap[event.category];
      if (found) {
        return {
          label: found.label,
          bg: found.container,
          text: found.color,
          border: found.color + '4D',
        };
      }
      const customColor = event.color || colors.accents.sky;
      return {
        label: event.category.toUpperCase(),
        bg: customColor + (isDark ? '26' : '1A'),
        text: customColor,
        border: customColor + (isDark ? '4D' : '33'),
      };
    }

    if (text.includes('anivers') || text.includes('niver')) {
      return { label: 'ANIVERSÁRIO', bg: colors.categoryBirthdayBg, text: colors.categoryBirthdayText, border: colors.categoryBirthdayText + '33' };
    }
    if (text.includes('churras') || text.includes('bbq')) {
      return { label: 'CHURRASCO', bg: colors.categoryBbqBg, text: colors.categoryBbqText, border: colors.categoryBbqText + '33' };
    }
    if (text.includes('festa') || text.includes('party') || text.includes('balada')) {
      return { label: 'FESTA', bg: colors.categoryPartyBg, text: colors.categoryPartyText, border: colors.categoryPartyText + '33' };
    }
    return { label: 'EVENTO', bg: colors.secondaryContainer, text: colors.onSecondaryContainer, border: colors.outlineVariant };
  };

  const category = getCategory();
  const accentBarColor = event.color || (category.text !== colors.onSecondaryContainer ? category.text : colors.primary);
  const isHolidayCard = category.label === 'FERIADO';
  const isGoogle = event.source === 'google';
  const isRecurring = event.is_recurring || !!event.recurrence;

  const handleDeletePress = () => {
    if (onRequestDelete) {
      onRequestDelete(event);
    } else {
      onDelete(event.id);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={onPress ? 0.85 : 1}
      onPress={onPress ? () => onPress(event) : undefined}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? `Abrir detalhes de ${event.title}` : event.title}
      style={[
        styles.card,
        {
          backgroundColor: colors.surfaceContainer,
          borderColor: colors.outlineVariant,
          borderWidth: 1,
          borderLeftWidth: 4,
          borderLeftColor: accentBarColor,
        },
      ]}
    >
      {/* Badge de data */}
      <View style={[styles.dateBadge, { backgroundColor: colors.surfaceContainerHighest, borderColor: colors.outlineVariant }]}>
        <Text style={[styles.dateDay, tabularNumbers, { color: isHolidayCard ? category.text : colors.onSurface }]}>
          {dayNum}
        </Text>
        <Text style={[styles.dateMonth, { color: colors.onSurfaceVariant }]}>
          {monthShort}
        </Text>
      </View>

      {/* Conteúdo principal */}
      <View style={styles.main}>
        <View style={styles.pillRow}>
          <View style={[styles.categoryBadge, { backgroundColor: category.bg, borderColor: category.border, borderWidth: 1 }]}>
            <Text style={[styles.categoryText, { color: category.text }]}>{category.label}</Text>
          </View>
          {isGoogle && (
            <View style={styles.inlineIndicator}>
              <MaterialIcons name="event" size={11} color="#EA4335" />
              <Text style={[styles.inlineIndicatorText, { color: '#EA4335' }]}>Google</Text>
            </View>
          )}
          {isRecurring && (
            <View style={styles.inlineIndicator}>
              <MaterialIcons name="repeat" size={11} color={colors.onSurfaceVariant} />
              <Text style={[styles.inlineIndicatorText, { color: colors.onSurfaceVariant }]}>Recorrente</Text>
            </View>
          )}
        </View>

        <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
          {event.title}
        </Text>

        <View style={styles.metaColumn}>
          {startTime || isAllDay ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="schedule" size={13} color={colors.onSurfaceVariant} />
              <Text style={[styles.metaText, tabularNumbers, { color: colors.onSurfaceVariant }]}>{timeDisplay}</Text>
            </View>
          ) : null}

          {event.location ? (
            <View style={styles.metaItem}>
              <MaterialIcons name="place" size={13} color={colors.onSurfaceVariant} />
              <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Coluna direita: excluir no topo, chevron centralizado — alinhados no mesmo eixo */}
      <View style={styles.rightCol}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeletePress}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Excluir compromisso"
        >
          <MaterialIcons name="close" size={15} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
        {onPress && !isHolidayCard ? (
          <View style={styles.chevron}>
            <MaterialIcons name="chevron-right" size={18} color={colors.onSurfaceVariant} />
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: MD3Shapes.largeIncreased,
    padding: tokens.spacing.sm + 4,
    marginBottom: tokens.spacing.sm,
    gap: tokens.spacing.sm + 4,
  },
  dateBadge: {
    width: 46,
    borderWidth: 1,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 6,
    flexShrink: 0,
  },
  dateDay: {
    fontSize: 17,
    fontWeight: tokens.typography.weight.bold,
    lineHeight: 20,
  },
  dateMonth: {
    fontSize: 9,
    fontWeight: tokens.typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 1,
  },
  main: {
    flex: 1,
    minWidth: 0,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  categoryBadge: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 4,
    borderRadius: MD3Shapes.full,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.8,
  },
  inlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  inlineIndicatorText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  rightCol: {
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
    flexShrink: 0,
    paddingVertical: 2,
  },
  deleteButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSurface,
    lineHeight: 21,
  },
  metaColumn: {
    marginTop: 4,
    gap: 2,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: tokens.typography.size.labelMedium,
    color: tokens.colors.textSecondary,
    fontWeight: tokens.typography.weight.medium,
    flexShrink: 1,
  },
  chevron: {
    alignSelf: 'center',
    flexShrink: 0,
  },
});
