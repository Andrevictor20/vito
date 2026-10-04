import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Event } from '../../types';

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

  const startTime = formatTime(event.start_at);
  const endTime = event.end_at ? formatTime(event.end_at) : '';
  const timeDisplay = endTime ? `${startTime} – ${endTime}` : startTime;

  // Inferir categoria e cores semânticas M3 para a tag
  const getCategory = () => {
    if (event.category) {
      const color = event.color || '#38BDF8';
      const catMap: Record<string, string> = {
        work: 'TRABALHO',
        health: 'SAÚDE',
        finance: 'FINANÇAS',
        study: 'ESTUDO',
        leisure: 'LAZER',
        personal: 'PESSOAL',
        general: 'COMPROMISSO',
      };
      const label = catMap[event.category] || event.category.toUpperCase();
      return {
        label,
        bg: color + (isDark ? '26' : '1A'),
        text: color,
        border: color + (isDark ? '4D' : '33'),
      };
    }

    const text = `${event.title} ${event.description || ''}`.toLowerCase();
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
      {/* Top Row: Categoria + Origem + Ações */}
      <View style={styles.topRow}>
        <View style={styles.badgeGroup}>
          <View style={[styles.categoryBadge, { backgroundColor: category.bg, borderColor: category.border, borderWidth: 1 }]}>
            <Text style={[styles.categoryText, { color: category.text }]}>{category.label}</Text>
          </View>
          {event.source === 'google' && (
            <View style={[styles.sourceBadge, { backgroundColor: isDark ? '#EA433522' : '#EA433515' }]}>
              <MaterialIcons name="event" size={11} color="#EA4335" />
              <Text style={styles.sourceText}>Google</Text>
            </View>
          )}
          {(event.is_recurring || !!event.recurrence) && (
            <View style={[styles.sourceBadge, { backgroundColor: isDark ? '#1E293B' : '#E0F2FE', borderColor: colors.primary, borderWidth: 1 }]}>
              <MaterialIcons name="repeat" size={11} color={colors.primary} />
              <Text style={[styles.sourceText, { color: colors.primary, fontWeight: '700' }]}>Recorrente</Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDeletePress}
          hitSlop={tokens.hitSlop.sm}
          accessibilityLabel="Excluir compromisso"
        >
          <MaterialIcons name="close" size={16} color={colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {/* Título do Evento */}
      <Text style={[styles.title, { color: colors.onSurface }]} numberOfLines={2}>
        {event.title}
      </Text>

      {/* Metadados: Horário e Local */}
      <View style={styles.metaRow}>
        {startTime ? (
          <View style={styles.metaItem}>
            <MaterialIcons name="schedule" size={15} color={colors.onSurfaceVariant} />
            <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]}>{timeDisplay}</Text>
          </View>
        ) : null}

        {event.location ? (
          <View style={styles.metaItem}>
            <MaterialIcons name="place" size={15} color={colors.onSurfaceVariant} />
            <Text style={[styles.metaText, { color: colors.onSurfaceVariant }]} numberOfLines={1}>
              {event.location}
            </Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: tokens.colors.surfaceContainer,
    borderRadius: MD3Shapes.large,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: tokens.spacing.sm,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: tokens.spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
  },
  categoryText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.bold,
    letterSpacing: 0.5,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
  },
  sourceText: {
    fontSize: 10,
    fontWeight: tokens.typography.weight.medium,
    color: '#EA4335',
  },
  deleteButton: {
    padding: tokens.spacing.xs,
  },
  title: {
    fontSize: tokens.typography.size.titleMedium,
    fontWeight: tokens.typography.weight.bold,
    color: tokens.colors.onSurface,
    lineHeight: 22,
    marginBottom: tokens.spacing.md,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: tokens.spacing.md,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: tokens.typography.size.labelMedium,
    color: tokens.colors.textSecondary,
    fontWeight: tokens.typography.weight.medium,
  },
});
