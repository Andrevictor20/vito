import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Event } from '../../types';

interface EventCardProps {
  event: Event;
  onDelete: (id: string) => void;
  accentColor?: string;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onDelete,
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

  // Inferir categoria M3 para a tag
  const getCategory = () => {
    const text = `${event.title} ${event.description || ''}`.toLowerCase();
    if (text.includes('anivers') || text.includes('niver')) {
      return { label: 'ANIVERSÁRIO', bg: colors.categoryBirthdayBg, text: colors.categoryBirthdayText };
    }
    if (text.includes('churras') || text.includes('bbq')) {
      return { label: 'CHURRASCO', bg: colors.categoryBbqBg, text: colors.categoryBbqText };
    }
    if (text.includes('festa') || text.includes('party') || text.includes('balada')) {
      return { label: 'FESTA', bg: colors.categoryPartyBg, text: colors.categoryPartyText };
    }
    return { label: 'EVENTO', bg: colors.secondaryContainer, text: colors.onSecondaryContainer };
  };

  const category = getCategory();

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceContainer, borderColor: colors.outlineVariant, borderWidth: 1 }]}>
      {/* Top Row: Categoria + Ações */}
      <View style={styles.topRow}>
        <View style={[styles.categoryBadge, { backgroundColor: category.bg }]}>
          <Text style={[styles.categoryText, { color: category.text }]}>{category.label}</Text>
        </View>

        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => onDelete(event.id)}
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
    </View>
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
