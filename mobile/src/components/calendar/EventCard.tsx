import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens, MD3Shapes } from '../../theme/tokens';
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
      return { label: 'ANIVERSÁRIO', bg: tokens.colors.categoryBirthdayBg, text: tokens.colors.categoryBirthdayText };
    }
    if (text.includes('churras') || text.includes('bbq')) {
      return { label: 'CHURRASCO', bg: tokens.colors.categoryBbqBg, text: tokens.colors.categoryBbqText };
    }
    if (text.includes('festa') || text.includes('party') || text.includes('balada')) {
      return { label: 'FESTA', bg: tokens.colors.categoryPartyBg, text: tokens.colors.categoryPartyText };
    }
    return { label: 'EVENTO', bg: tokens.colors.secondaryContainer, text: tokens.colors.onSecondaryContainer };
  };

  const category = getCategory();

  return (
    <View style={styles.card}>
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
          <MaterialIcons name="close" size={16} color={tokens.colors.onSurfaceVariant} />
        </TouchableOpacity>
      </View>

      {/* Título do Evento */}
      <Text style={styles.title} numberOfLines={2}>
        {event.title}
      </Text>

      {/* Metadados: Horário e Local */}
      <View style={styles.metaRow}>
        {startTime ? (
          <View style={styles.metaItem}>
            <MaterialIcons name="schedule" size={15} color={tokens.colors.textSecondary} />
            <Text style={styles.metaText}>{timeDisplay}</Text>
          </View>
        ) : null}

        {event.location ? (
          <View style={styles.metaItem}>
            <MaterialIcons name="place" size={15} color={tokens.colors.textSecondary} />
            <Text style={styles.metaText} numberOfLines={1}>
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
