import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { Event } from '../../types';

interface EventCardProps {
  event: Event;
  onDelete: (id: string) => void;
  accentColor?: string;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onDelete,
  accentColor = tokens.colors.primaryContainer,
}) => {
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const calculateDuration = () => {
    try {
      const start = new Date(event.start_at).getTime();
      const end = new Date(event.end_at).getTime();
      const diffMinutes = Math.round((end - start) / 60000);
      if (diffMinutes > 0 && diffMinutes < 1440) {
        return `${diffMinutes} min`;
      }
    } catch {
      // fallback
    }
    return '';
  };

  const startTime = formatTime(event.start_at);
  const duration = calculateDuration();

  const getEventIcon = () => {
    const loc = (event.location || '').toLowerCase();
    const title = (event.title || '').toLowerCase();
    if (loc.includes('meet') || loc.includes('zoom') || loc.includes('teams') || title.includes('daily') || title.includes('call')) {
      return 'videocam' as const;
    }
    if (loc.includes('sala') || loc.includes('escritório') || loc.includes('rua') || loc.includes('av')) {
      return 'location-on' as const;
    }
    return 'groups' as const;
  };

  return (
    <View style={styles.card}>
      <View style={styles.timeColumn}>
        <Text style={styles.startTime}>{startTime}</Text>
        {duration ? <Text style={styles.duration}>{duration}</Text> : null}
      </View>

      <View style={[styles.indicator, { backgroundColor: accentColor }]} />

      <View style={styles.contentColumn}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {event.title}
          </Text>
          <MaterialIcons name={getEventIcon()} size={15} color={tokens.colors.outline} />
        </View>

        {event.location ? (
          <Text style={styles.meta} numberOfLines={1}>
            {event.location}
          </Text>
        ) : null}

        {event.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {event.description}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(event.id)}
        hitSlop={tokens.hitSlop.sm}
        accessibilityLabel="Excluir compromisso"
      >
        <MaterialIcons name="close" size={15} color={tokens.colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceContainer,
    borderWidth: 1,
    borderColor: tokens.colors.surfaceBorder,
    borderRadius: tokens.radii.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
  },
  timeColumn: {
    width: 52,
    alignItems: 'flex-start',
  },
  startTime: {
    fontSize: tokens.typography.size.sm,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textPrimary,
  },
  duration: {
    fontSize: 10,
    color: tokens.colors.textMuted,
    marginTop: 2,
  },
  indicator: {
    width: 3.5,
    height: '80%',
    borderRadius: tokens.radii.full,
    marginHorizontal: tokens.spacing.sm,
  },
  contentColumn: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  title: {
    fontSize: tokens.typography.size.sm + 1,
    fontWeight: tokens.typography.weight.semibold,
    color: tokens.colors.textPrimary,
    flex: 1,
  },
  meta: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.primary,
    marginTop: 2,
    fontWeight: tokens.typography.weight.medium,
  },
  description: {
    fontSize: tokens.typography.size.xs,
    color: tokens.colors.textSecondary,
    marginTop: 2,
  },
  deleteButton: {
    padding: tokens.spacing.xs,
    marginLeft: tokens.spacing.xs,
  },
});
