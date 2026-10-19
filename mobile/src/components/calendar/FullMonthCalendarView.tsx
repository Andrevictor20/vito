import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  BackHandler,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { tokens, MD3Shapes } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { TokiMonthBlock } from './TokiMonthBlock';
import { TokiDensitySlider } from './TokiDensitySlider';
import { generateMonthRange } from '../../utils/tokiCalendarUtils';
import type { Event } from '../../types';

interface FullMonthCalendarViewProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onBack: () => void;
  events: Event[];
  dayEvents: Event[];
  eventDates: Set<string>;
  totalTodos: number;
  completedTodos: number;
  onEditEvent?: (ev: Event) => void;
  onDeleteEvent?: (id: string) => void;
  onCreateEvent?: () => void;
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export const FullMonthCalendarView: React.FC<FullMonthCalendarViewProps> = ({
  selectedDate,
  onSelectDate,
  onBack,
  events,
  onCreateEvent,
}) => {
  const { colors, isDark } = useTheme();
  const today = useMemo(() => new Date(), []);
  const todayMonthId = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    [today]
  );
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const scrollViewRef = useRef<ScrollView>(null);
  const monthOffsets = useRef<{ [key: string]: number }>({});
  const hasInitialScrolled = useRef<boolean>(false);

  // Gera intervalo continuo de meses centrado na data selecionada (3 anteriores e 11 futuros)
  const months = useMemo(() => {
    return generateMonthRange(selectedDate, 3, 11);
  }, [selectedDate]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack]);

  const scrollToMonth = (targetDate: Date, animated = true) => {
    const targetId = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
    const targetY = monthOffsets.current[targetId];
    if (targetY !== undefined && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({ y: Math.max(0, targetY - 4), animated });
    }
  };

  const handleGoToday = () => {
    const now = new Date();
    onSelectDate(now);
    scrollToMonth(now, true);
  };

  const currentMonthTitle = useMemo(() => {
    const mName = selectedDate.toLocaleDateString('pt-BR', { month: 'long' });
    const capitalized = mName.charAt(0).toUpperCase() + mName.slice(1);
    return `${capitalized} ${selectedDate.getFullYear()}`;
  }, [selectedDate]);

  const weekdayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]} edges={['top', 'bottom']}>
      {/* Header Estilo Toki */}
      <View style={[styles.header, { borderBottomColor: colors.outlineVariant }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)' }]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar para a agenda"
          >
            <MaterialIcons name="arrow-back" size={22} color={colors.onSurface} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.onSurface }]}>
            {currentMonthTitle}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.todayButton, { backgroundColor: colors.primaryContainer }]}
            onPress={handleGoToday}
            accessibilityRole="button"
            accessibilityLabel="Ir para hoje"
          >
            <Text style={[styles.todayButtonText, { color: colors.onPrimaryContainer }]}>
              Hoje
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra Fixa dos Dias da Semana */}
      <View style={[styles.weekdayHeader, { borderBottomColor: colors.outlineVariant, backgroundColor: colors.surface }]}>
        {weekdayNames.map((name, index) => (
          <View key={index} style={styles.weekdayCol}>
            <Text
              style={[
                styles.weekdayText,
                { color: index === 0 || index === 6 ? colors.textMuted : colors.onSurfaceVariant },
              ]}
            >
              {name}
            </Text>
          </View>
        ))}
      </View>

      {/* Rolagem Contínua Vertical de Meses (Estilo Toki) */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {months.map((m) => (
          <View
            key={m.id}
            onLayout={(e) => {
              const y = e.nativeEvent.layout.y;
              monthOffsets.current[m.id] = y;
              if (!hasInitialScrolled.current && m.id === todayMonthId) {
                hasInitialScrolled.current = true;
                requestAnimationFrame(() => {
                  scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 4), animated: false });
                });
              }
            }}
          >
            <TokiMonthBlock
              monthData={m}
              events={events}
              selectedDate={selectedDate}
              todayDate={today}
              isExpanded={isExpanded}
              onSelectDay={onSelectDate}
            />
          </View>
        ))}
      </ScrollView>

      {/* Slider Vertical Flutuante de Densidade (Zoom Toki) */}
      <TokiDensitySlider
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded((prev) => !prev)}
        onSetExpanded={setIsExpanded}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.md,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.sm,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.spacing.xs,
  },
  todayButton: {
    paddingHorizontal: tokens.spacing.sm,
    paddingVertical: 6,
    borderRadius: MD3Shapes.full,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  weekdayHeader: {
    flexDirection: 'row',
    height: 32,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  weekdayCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 130, // Garante que o último mês/dia não seja coberto pela FloatingTabBar
  },
});
