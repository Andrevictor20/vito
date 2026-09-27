import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { tokens } from '../../theme/tokens';
import { Event } from '../../types';

interface EventCardProps {
  event: Event;
  onDelete: (id: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({ event, onDelete }) => {
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const startTime = formatTime(event.start_at);
  const endTime = formatTime(event.end_at);

  return (
    <View style={styles.card}>
      <View style={styles.timeColumn}>
        <Text style={styles.startTime}>{startTime}</Text>
        <Text style={styles.endTime}>{endTime}</Text>
      </View>

      <View style={styles.indicator} />

      <View style={styles.contentColumn}>
        <Text style={styles.title} numberOfLines={1}>
          {event.title}
        </Text>
        {event.location ? (
          <Text style={styles.meta} numberOfLines={1}>
            📍 {event.location}
          </Text>
        ) : null}
        {event.description ? (
          <Text style={styles.description} numberOfLines={2}>
            {event.description}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(event.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteText}>✕</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  timeColumn: {
    width: 50,
    alignItems: 'flex-start',
  },
  startTime: {
    fontSize: 13,
    fontWeight: '700',
    color: tokens.colors.textPrimary,
  },
  endTime: {
    fontSize: 11,
    color: tokens.colors.textMuted,
  },
  indicator: {
    width: 3,
    height: '80%',
    backgroundColor: tokens.colors.primary,
    borderRadius: 2,
    marginHorizontal: tokens.spacing.sm,
  },
  contentColumn: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: tokens.colors.textPrimary,
  },
  meta: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.primary,
    marginTop: 2,
    fontWeight: tokens.typography.weight.medium,
  },
  description: {
    fontSize: 11,
    color: tokens.colors.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: tokens.spacing.xs,
    marginLeft: tokens.spacing.xs,
  },
  deleteText: {
    color: tokens.colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
