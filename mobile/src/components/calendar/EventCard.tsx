import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { tokens } from '../../theme/tokens';
import { useTheme } from '../../context/ThemeContext';
import { Event } from '../../types';
import { isAllDayEvent, badgeDayMonthUTC, isHolidayReadOnly } from '../../utils/calendarDateUtils';

export interface EventCardProps {
  event: Event;
  onDelete: (id: string, allSeries?: boolean) => void;
  onPress?: (event: Event) => void;
  onRequestDelete?: (event: Event) => void;
  accentColor?: string;
  variant?: 'day' | 'next' | 'auto';
  showDateBadge?: boolean;
}

/**
 * EventCard fiel a vito-telas.html:
 * - Evento de dia inteiro (.allday): pill com fundo suave na cor da categoria, ícone e rótulo.
 * - Evento com hora (.ev): coluna horária (.tm, 42px) + card (.evc) com borderLeft de 4px na cor da categoria.
 * - Evento 'Em seguida' (.next): bloco de data (.db, 42x46px), título, horário e chevron.
 */
export const EventCard: React.FC<EventCardProps> = ({
  event,
  onDelete,
  onPress,
  onRequestDelete,
  variant = 'auto',
  showDateBadge = false,
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

  let dayNum = '';
  let monthShort = '';
  try {
    const badge = badgeDayMonthUTC(event.start_at, isAllDay);
    dayNum = badge.day;
    monthShort = badge.month.toUpperCase();
  } catch {
    dayNum = '';
    monthShort = '';
  }

  // Mapeamento de categorias e cores fiéis a vito-telas.html
  const getCategoryInfo = () => {
    const text = `${event.title} ${event.description || ''}`.toLowerCase();
    const isHoliday =
      event.category === 'holiday' ||
      (isAllDay &&
        (text.includes('feriado') ||
          text.includes('nossa senhora') ||
          text.includes('aparecida') ||
          text.includes('tiradentes') ||
          text.includes('páscoa') ||
          text.includes('pascoa') ||
          text.includes('natal') ||
          text.includes('ano novo') ||
          text.includes('trabalho') ||
          text.includes('independência') ||
          text.includes('independencia') ||
          text.includes('finados') ||
          text.includes('república') ||
          text.includes('republica') ||
          text.includes('consciência') ||
          text.includes('consciencia') ||
          text.includes('carnaval') ||
          text.includes('corpus christi')));

    if (isHoliday) {
      return {
        label: 'Feriado',
        color: colors.orange,
        bg: isDark ? 'rgba(255, 154, 82, 0.16)' : colors.orangeBg,
        border: colors.orange + '44',
        isHoliday: true,
      };
    }

    const catKey = (event.category || '').toLowerCase();
    if (catKey === 'work' || catKey === 'trabalho') {
      return { label: 'Trabalho', color: colors.teal, bg: isDark ? 'rgba(60, 196, 208, 0.14)' : colors.tealBg, border: colors.teal + '33', isHoliday: false };
    }
    if (catKey === 'personal' || catKey === 'pessoal') {
      return { label: 'Pessoal', color: colors.purple, bg: isDark ? 'rgba(165, 139, 255, 0.14)' : colors.purpleBg, border: colors.purple + '33', isHoliday: false };
    }
    if (catKey === 'study' || catKey === 'estudo') {
      return { label: 'Estudo', color: colors.orange, bg: isDark ? 'rgba(255, 154, 82, 0.14)' : colors.orangeBg, border: colors.orange + '33', isHoliday: false };
    }
    if (catKey === 'health' || catKey === 'saude' || catKey === 'saúde') {
      return { label: 'Saúde', color: colors.blue, bg: isDark ? 'rgba(90, 162, 238, 0.14)' : colors.blueBg, border: colors.blue + '33', isHoliday: false };
    }
    if (catKey === 'leisure' || catKey === 'lazer') {
      return { label: 'Lazer', color: colors.acc, bg: isDark ? 'rgba(52, 211, 153, 0.14)' : colors.greenBg, border: colors.acc + '33', isHoliday: false };
    }
    if (catKey === 'finance' || catKey === 'financas' || catKey === 'finanças' || catKey === 'financeiro') {
      return { label: 'Finanças', color: colors.red, bg: isDark ? 'rgba(255, 107, 138, 0.14)' : colors.redBg, border: colors.red + '33', isHoliday: false };
    }

    if (text.includes('anivers') || text.includes('niver')) {
      return { label: 'Aniversário', color: colors.orange, bg: isDark ? 'rgba(255, 154, 82, 0.14)' : colors.orangeBg, border: colors.orange + '33', isHoliday: false };
    }
    if (text.includes('churras') || text.includes('bbq')) {
      return { label: 'Churrasco', color: colors.red, bg: isDark ? 'rgba(255, 107, 138, 0.14)' : colors.redBg, border: colors.red + '33', isHoliday: false };
    }
    if (text.includes('festa') || text.includes('party') || text.includes('balada')) {
      return { label: 'Festa', color: colors.purple, bg: isDark ? 'rgba(165, 139, 255, 0.14)' : colors.purpleBg, border: colors.purple + '33', isHoliday: false };
    }

    const defaultColor = event.color || colors.blue;
    return {
      label: event.category ? event.category.charAt(0).toUpperCase() + event.category.slice(1) : 'Compromisso',
      color: defaultColor,
      bg: isDark ? 'rgba(90, 162, 238, 0.12)' : colors.blueBg,
      border: colors.line,
      isHoliday: false,
    };
  };

  const catInfo = getCategoryInfo();
  const isGoogle = event.source === 'google';
  const isRecurring = event.is_recurring || !!event.recurrence;
  const readOnly = isHolidayReadOnly(event);
  const canPress = !!onPress && !readOnly;

  const handleDeletePress = () => {
    if (onRequestDelete) {
      onRequestDelete(event);
    } else {
      onDelete(event.id);
    }
  };

  // 1. Apresentação "Em seguida" (.next) ou busca com data
  if (variant === 'next' || showDateBadge) {
    const timeRange = isAllDay ? 'Dia inteiro' : endTime ? `${startTime}–${endTime}` : startTime;
    return (
      <TouchableOpacity
        style={[styles.nextRow, { borderTopColor: colors.line }]}
        activeOpacity={canPress ? 0.75 : 1}
        onPress={canPress && onPress ? () => onPress(event) : undefined}
        accessibilityRole={canPress ? 'button' : undefined}
        accessibilityLabel={canPress ? `Abrir detalhes de ${event.title}` : event.title}
      >
        <View style={[styles.dbBadge, { backgroundColor: colors.surf }]}>
          <Text style={[styles.dbDay, { color: colors.ink }]}>{dayNum}</Text>
          <Text style={[styles.dbMonth, { color: colors.muted }]}>{monthShort}</Text>
        </View>

        <View style={styles.nextTextCol}>
          <Text style={[styles.nextTitle, { color: colors.ink }]} numberOfLines={1}>
            {event.title}
          </Text>
          <View style={styles.metaRow}>
            <Text style={[styles.metaCat, { color: catInfo.color }]}>
              {catInfo.label}
            </Text>
            <Text style={[styles.metaText, { color: colors.muted }]}>
              · {timeRange}
            </Text>
            {isGoogle && (
              <Text style={[styles.metaText, { color: colors.muted }]}>
                · Google
              </Text>
            )}
            {isRecurring && (
              <View style={styles.inlineMeta}>
                <Text style={[styles.metaText, { color: colors.muted }]}>·</Text>
                <MaterialIcons name="repeat" size={11} color={colors.muted} />
              </View>
            )}
          </View>
        </View>

        {!readOnly && (
          <TouchableOpacity
            style={styles.deleteBtnSmall}
            onPress={handleDeletePress}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Excluir compromisso"
          >
            <MaterialIcons name="close" size={14} color={colors.muted} />
          </TouchableOpacity>
        )}

        <MaterialIcons name="chevron-right" size={18} color={colors.muted} style={{ marginLeft: 2 }} />
      </TouchableOpacity>
    );
  }

  // 2. Apresentação de dia inteiro (.allday)
  if (isAllDay) {
    return (
      <TouchableOpacity
        style={[
          styles.allDayPill,
          {
            backgroundColor: catInfo.bg,
            borderColor: catInfo.border,
          },
        ]}
        activeOpacity={canPress ? 0.8 : 1}
        onPress={canPress && onPress ? () => onPress(event) : undefined}
        accessibilityRole={canPress ? 'button' : undefined}
        accessibilityLabel={canPress ? `Abrir detalhes de ${event.title}` : `${event.title} (dia inteiro)`}
      >
        <MaterialIcons
          name={isGoogle ? 'event' : 'event-available'}
          size={16}
          color={catInfo.color}
        />
        <Text
          style={[
            styles.allDayText,
            { color: catInfo.color },
          ]}
          numberOfLines={1}
        >
          {event.title} · {catInfo.label}
        </Text>

        {!readOnly && (
          <TouchableOpacity
            style={styles.allDayDelete}
            onPress={handleDeletePress}
            hitSlop={tokens.hitSlop.sm}
            accessibilityLabel="Excluir compromisso"
          >
            <MaterialIcons name="close" size={14} color={catInfo.color} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  }

  // 3. Apresentação padrão com hora (.ev com .tm e .evc)
  return (
    <View style={styles.evRow}>
      <View style={styles.tmCol}>
        <Text style={[styles.tmStart, { color: colors.ink }]}>{startTime}</Text>
        {endTime ? (
          <Text style={[styles.tmEnd, { color: colors.muted }]}>{endTime}</Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[
          styles.evcCard,
          {
            backgroundColor: catInfo.bg,
            borderLeftColor: catInfo.color,
            borderColor: isDark ? colors.line : catInfo.border,
          },
        ]}
        activeOpacity={canPress ? 0.8 : 1}
        onPress={canPress && onPress ? () => onPress(event) : undefined}
        accessibilityRole={canPress ? 'button' : undefined}
        accessibilityLabel={canPress ? `Abrir detalhes de ${event.title}` : event.title}
      >
        <View style={styles.evcContent}>
          <Text style={[styles.evcTitle, { color: colors.ink }]} numberOfLines={2}>
            {event.title}
          </Text>

          <View style={styles.metaRow}>
            <Text style={[styles.metaCat, { color: catInfo.color }]}>
              {catInfo.label}
            </Text>
            {isGoogle && (
              <Text style={[styles.metaText, { color: colors.muted }]}>
                · Google
              </Text>
            )}
            {isRecurring && (
              <View style={styles.inlineMeta}>
                <Text style={[styles.metaText, { color: colors.muted }]}>·</Text>
                <MaterialIcons name="repeat" size={12} color={colors.muted} />
                <Text style={[styles.metaText, { color: colors.muted }]}>Recorrente</Text>
              </View>
            )}
            {event.location ? (
              <View style={styles.inlineMeta}>
                <Text style={[styles.metaText, { color: colors.muted }]}>·</Text>
                <MaterialIcons name="place" size={12} color={colors.muted} />
                <Text style={[styles.metaText, { color: colors.muted }]} numberOfLines={1}>
                  {event.location}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.evcActions}>
          {!readOnly && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDeletePress}
              hitSlop={tokens.hitSlop.sm}
              accessibilityLabel="Excluir compromisso"
            >
              <MaterialIcons name="close" size={15} color={colors.muted} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  // .allday: pill de dia inteiro
  allDayPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  allDayText: {
    flex: 1,
    fontSize: 13,
    fontFamily: tokens.typography.family.semibold,
  },
  allDayDelete: {
    padding: 2,
  },

  // .ev: container de evento com coluna horária
  evRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 10,
    marginBottom: 8,
  },
  tmCol: {
    width: 42,
    alignItems: 'flex-end',
    paddingTop: 11,
    flexShrink: 0,
  },
  tmStart: {
    fontSize: 12.5,
    fontFamily: tokens.typography.family.semibold,
    lineHeight: 15,
  },
  tmEnd: {
    fontSize: 11.5,
    fontFamily: tokens.typography.family.medium,
    lineHeight: 14,
    marginTop: 1,
  },

  // .evc: card de evento com faixa vertical
  evcCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderLeftWidth: 4,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  evcContent: {
    flex: 1,
    minWidth: 0,
  },
  evcTitle: {
    fontSize: 16,
    fontFamily: tokens.typography.family.semibold,
    lineHeight: 21,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  metaCat: {
    fontSize: 12,
    fontFamily: tokens.typography.family.semibold,
  },
  metaText: {
    fontSize: 12,
    fontFamily: tokens.typography.family.regular,
  },
  inlineMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  evcActions: {
    marginLeft: 8,
    alignSelf: 'flex-start',
  },
  deleteBtn: {
    padding: 2,
  },

  // .next: linha de próximo evento
  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  dbBadge: {
    width: 42,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dbDay: {
    fontFamily: tokens.typography.family.montserratBold,
    fontSize: 17,
    lineHeight: 19,
  },
  dbMonth: {
    fontFamily: tokens.typography.family.semibold,
    fontSize: 10,
    letterSpacing: 0.5,
    marginTop: 1,
  },
  nextTextCol: {
    flex: 1,
    minWidth: 0,
  },
  nextTitle: {
    fontSize: 15,
    fontFamily: tokens.typography.family.semibold,
  },
  deleteBtnSmall: {
    padding: 4,
  },
});
