import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { M3ProgressRing } from '../ui/M3ProgressRing';
import { Event } from '../../types';

interface HeroDayOverviewProps {
  dayEvents: Event[];
  totalTodos: number;
  completedTodos: number;
}

export const HeroDayOverview: React.FC<HeroDayOverviewProps> = ({
  dayEvents,
  totalTodos,
  completedTodos,
}) => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const [currentTime, setCurrentTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      setCurrentTime(`${hours}:${minutes}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 1000 * 30);
    return () => clearInterval(interval);
  }, []);

  const firstName = user?.name ? user.name.split(' ')[0] : 'Executivo';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

  const todayFormatted = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
  });
  const capitalizedDate = todayFormatted.charAt(0).toUpperCase() + todayFormatted.slice(1);

  // Progresso do dia
  const progressRatio = totalTodos > 0 ? completedTodos / totalTodos : (dayEvents.length > 0 ? 0.5 : 1);
  const progressPercentage = totalTodos > 0 ? `${Math.round(progressRatio * 100)}%` : '100%';

  return (
    <View
      style={[
        styles.heroCard,
        {
          backgroundColor: isDark ? colors.surfaceContainer : colors.surfaceContainerLow,
          borderColor: colors.outlineVariant,
        },
      ]}
    >
      <View style={styles.topRow}>
        <View style={styles.leftColumn}>
          {/* Greeting & Data */}
          <View style={styles.greetingRow}>
            <View style={[styles.statusDot, { backgroundColor: colors.accents.emerald }]} />
            <Text style={[styles.greetingText, { color: colors.onSurfaceVariant }]}>
              {greeting}, {firstName}
            </Text>
          </View>

          {/* Relógio Hero Display M3 (Display Medium 45sp) */}
          <View style={styles.clockRow}>
            <Text style={[styles.clockDisplay, { color: colors.onSurface }]}>
              {currentTime}
            </Text>
            <View style={[styles.dateChip, { backgroundColor: colors.surfaceContainerHighest }]}>
              <MaterialIcons name="today" size={13} color={colors.accents.sky} />
              <Text style={[styles.dateChipText, { color: colors.onSurface }]}>
                {capitalizedDate}
              </Text>
            </View>
          </View>
        </View>

        {/* Ring Gauge de Produtividade Diária (Material You Privacy/Gauge style com Esmeralda) */}
        <View style={styles.ringContainer}>
          <M3ProgressRing
            progress={progressRatio}
            size={76}
            strokeWidth={7}
            centerText={progressPercentage}
            subtitle="tarefas"
            color={completedTodos > 0 ? colors.accents.emerald : (totalTodos > 0 ? colors.accents.amber : colors.primary)}
            trackColor={colors.surfaceContainerHighest}
          />
        </View>
      </View>

      {/* Faixa inferior de status */}
      <View
        style={[
          styles.statusStrip,
          {
            backgroundColor: isDark ? colors.surfaceContainerHigh : colors.surface,
            borderColor: colors.outlineVariant,
          },
        ]}
      >
        <View style={styles.statusItem}>
          <MaterialIcons name="event" size={15} color={colors.accents.sky} />
          <Text style={[styles.statusItemText, { color: colors.onSurface }]}>
            {dayEvents.length} {dayEvents.length === 1 ? 'compromisso' : 'compromissos'}
          </Text>
        </View>

        <View style={[styles.statusDivider, { backgroundColor: colors.outlineVariant }]} />

        <View style={styles.statusItem}>
          <MaterialIcons name="check-circle-outline" size={15} color={colors.accents.emerald} />
          <Text style={[styles.statusItemText, { color: colors.onSurface }]}>
            {completedTodos}/{totalTodos} tarefas
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: MD3Shapes.extraLarge,
    borderWidth: 1,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftColumn: {
    flex: 1,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  greetingText: {
    fontSize: tokens.typography.size.labelLarge,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  clockRow: {
    alignItems: 'flex-start',
    gap: 4,
  },
  clockDisplay: {
    fontSize: tokens.typography.size.displayMedium,
    fontWeight: '700',
    letterSpacing: -1,
    lineHeight: 50,
  },
  dateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: MD3Shapes.full,
    marginTop: 2,
  },
  dateChipText: {
    fontSize: tokens.typography.size.labelSmall,
    fontWeight: '600',
  },
  ringContainer: {
    marginLeft: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginTop: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    borderRadius: MD3Shapes.large,
    borderWidth: 1,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusItemText: {
    fontSize: tokens.typography.size.bodySmall,
    fontWeight: '600',
  },
  statusDivider: {
    width: 1,
    height: 16,
  },
});
