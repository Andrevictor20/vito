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
import { SelectedDayInspector } from './SelectedDayInspector';
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

export const FullMonthCalendarView: React.FC<FullMonthCalendarViewProps> = ({
  selectedDate,
  onSelectDate,
  onBack,
  events,
  dayEvents,
  totalTodos,
  completedTodos,
  onEditEvent,
  onDeleteEvent,
  onCreateEvent,
}) => {
  const { colors, isDark } = useTheme();
  const today = useMemo(() => new Date(), []);
  const todayMonthId = useMemo(
    () => `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
    [today],
  );
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const [inspectingDay, setInspectingDay] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const monthOffsets = useRef<{ [key: string]: number }>({});
  const hasInitialScrolled = useRef<boolean>(false);

  // Gera intervalo contínuo de meses centrado na data selecionada (3 anteriores e 11 futuros)
  const months = useMemo(() => {
    return generateMonthRange(selectedDate, 3, 11);
  }, [selectedDate]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (inspectingDay) {
        setInspectingDay(false);
        return true;
      }
      onBack();
      return true;
    });
    return () => subscription.remove();
  }, [onBack, inspectingDay]);

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
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top', 'bottom']}>
      {/* Header Calendário Infinito */}
      <View style={[styles.header, { borderBottomColor: colors.line }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: colors.surf }]}
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Voltar para a agenda"
          >
            <MaterialIcons name="arrow-back" size={20} color={colors.ink} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.ink }]}>
            {currentMonthTitle}
          </Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.todayButton, { backgroundColor: colors.surf }]}
            onPress={handleGoToday}
            accessibilityRole="button"
            accessibilityLabel="Ir para hoje"
          >
            <Text style={[styles.todayButtonText, { color: colors.ink }]}>
              Hoje
            </Text>
          </TouchableOpacity>

          {onCreateEvent && (
            <TouchableOpacity
              style={[styles.addBtn, { backgroundColor: colors.ink }]}
              onPress={onCreateEvent}
              accessibilityRole="button"
              accessibilityLabel="Novo evento"
            >
              <MaterialIcons name="add" size={20} color={colors.bg} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Barra Fixa dos Dias da Semana */}
      <View style={[styles.weekdayHeader, { borderBottomColor: colors.line, backgroundColor: colors.bg }]}>
        {weekdayNames.map((name, index) => (
          <View key={index} style={styles.weekdayCol}>
            <Text
              style={[
                styles.weekdayText,
                { color: index === 0 || index === 6 ? colors.muted : colors.ink },
              ]}
            >
              {name}
            </Text>
          </View>
        ))}
      </View>

      {/* Rolagem Contínua Vertical de Meses */}
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
              onSelectDay={(date) => {
                onSelectDate(date);
                setInspectingDay(true);
              }}
            />
          </View>
        ))}
      </ScrollView>

      {/* Painel inferior de inspeção rápida do dia selecionado */}
      {inspectingDay && (
        <View
          style={[
            styles.inspectorSheet,
            {
              backgroundColor: colors.bg,
              borderTopColor: colors.line,
              shadowColor: isDark ? '#000' : '#141916',
            },
          ]}
        >
          <View style={styles.inspectorHeaderBar}>
            <View style={[styles.inspectorHandle, { backgroundColor: colors.line }]} />
            <TouchableOpacity
              onPress={() => setInspectingDay(false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Fechar detalhes do dia"
            >
              <MaterialIcons name="close" size={18} color={colors.muted} />
            </TouchableOpacity>
          </View>
          <SelectedDayInspector
            selectedDate={selectedDate}
            selectedDayEvents={dayEvents}
            totalTodos={totalTodos}
            completedTodos={completedTodos}
            onBack={onBack}
            onEditEvent={onEditEvent}
            onDeleteEvent={onDeleteEvent}
            onCreateEvent={onCreateEvent}
          />
        </View>
      )}

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
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: 'Montserrat_800ExtraBold',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.36,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayButton: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: MD3Shapes.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingBottom: 140,
  },
  inspectorSheet: {
    borderTopWidth: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 96,
    maxHeight: '48%',
    elevation: 12,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
  },
  inspectorHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  inspectorHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
});
