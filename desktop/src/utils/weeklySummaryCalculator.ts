import { CalendarEvent, Todo } from '../types';

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? `1 ${one}` : `${count} ${many}`;
}

export interface DailyActivityItem {
  dayLabel: string;
  dayShort: string;
  dateStr: string;
  hours: number;
  eventsCount: number;
  isPeak: boolean;
  isToday: boolean;
}

export interface CategoryBreakdownItem {
  name: string;
  hours: number;
  percentage: number;
  color: string;
}

export interface WeeklySummaryItem {
  id: string;
  period: string;
  weekStart: Date;
  weekEnd: Date;
  isCurrentWeek: boolean;
  title: string;
  narrative: string;
  hours: number;
  eventsCount: number;
  completedTodosCount: number;
  totalTodosCount: number;
  dailyActivity: DailyActivityItem[];
  categories: CategoryBreakdownItem[];
  topEvents: Array<{ id: string; title: string; category?: string; time: string }>;
  tips: Array<{ category: string; text: string }>;
}

const CATEGORY_COLORS: Record<string, string> = {
  trabalho: '#10B981',
  work: '#10B981',
  estudo: '#38BDF8',
  study: '#38BDF8',
  pessoal: '#A855F7',
  personal: '#A855F7',
  saude: '#FB7185',
  health: '#FB7185',
  financas: '#FBBF24',
  finance: '#FBBF24',
  lazer: '#F97316',
  leisure: '#F97316',
  tech: '#6366F1',
  geral: '#94A3B8',
  general: '#94A3B8',
  outros: '#94A3B8',
};

const CATEGORY_TRANSLATIONS: Record<string, { name: string; color: string }> = {
  general: { name: 'Geral', color: '#94A3B8' },
  geral: { name: 'Geral', color: '#94A3B8' },
  work: { name: 'Trabalho', color: '#10B981' },
  trabalho: { name: 'Trabalho', color: '#10B981' },
  study: { name: 'Estudo', color: '#38BDF8' },
  estudo: { name: 'Estudo', color: '#38BDF8' },
  health: { name: 'Saúde', color: '#FB7185' },
  saude: { name: 'Saúde', color: '#FB7185' },
  finance: { name: 'Finanças', color: '#FBBF24' },
  financas: { name: 'Finanças', color: '#FBBF24' },
  leisure: { name: 'Lazer', color: '#F97316' },
  lazer: { name: 'Lazer', color: '#F97316' },
  personal: { name: 'Pessoal', color: '#A855F7' },
  pessoal: { name: 'Pessoal', color: '#A855F7' },
  other: { name: 'Outros', color: '#94A3B8' },
  outros: { name: 'Outros', color: '#94A3B8' },
};

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

function getStartOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(startOfWeekDate: Date): Date {
  const d = new Date(startOfWeekDate);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function isAllDay(event: CalendarEvent): boolean {
  if (event.all_day) return true;
  const s = new Date(event.start_at).getTime();
  const e = new Date(event.end_at).getTime();
  const diffHours = (e - s) / (1000 * 60 * 60);
  if (diffHours >= 20) return true;
  const cat = (event.category || '').toLowerCase();
  if (cat.includes('feriad') || cat.includes('holiday')) return true;
  return false;
}

const MONTH_NAMES_SHORT = [
  'jan.', 'fev.', 'mar.', 'abr.', 'mai.', 'jun.',
  'jul.', 'ago.', 'set.', 'out.', 'nov.', 'dez.',
];

function formatPeriod(start: Date, end: Date): string {
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startMonth = MONTH_NAMES_SHORT[start.getMonth()];
  const endMonth = MONTH_NAMES_SHORT[end.getMonth()];

  if (start.getMonth() === end.getMonth()) {
    return `${startDay} - ${endDay} de ${endMonth}`;
  }
  return `${startDay} de ${startMonth} - ${endDay} de ${endMonth}`;
}

export function calculateWeeklySummaries(
  events: CalendarEvent[],
  todos: Todo[],
  weeksCount = 4
): WeeklySummaryItem[] {
  const summaries: WeeklySummaryItem[] = [];
  const now = new Date();
  const currentWeekStart = getStartOfWeek(now);

  for (let i = 0; i < weeksCount; i++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = getEndOfWeek(weekStart);
    const isCurrentWeek = i === 0;

    const weekEvents = events.filter((e) => {
      const eDate = new Date(e.start_at);
      return eDate >= weekStart && eDate <= weekEnd;
    });

    const weekTodos = todos.filter((t) => {
      if (!t.due_date && !t.created_at) return false;
      const refDate = new Date(t.due_date || t.created_at || '');
      return refDate >= weekStart && refDate <= weekEnd;
    });

    const completedTodos = weekTodos.filter((t) => t.status === 'completed');

    let totalMinutes = 0;
    const categoryMinutes: Record<string, number> = {};

    weekEvents.forEach((e) => {
      if (isAllDay(e)) return;
      const s = new Date(e.start_at).getTime();
      const end = new Date(e.end_at).getTime();
      if (end > s) {
        const mins = Math.round((end - s) / (1000 * 60));
        totalMinutes += mins;
        const catKey = (e.category || 'geral').toLowerCase();
        categoryMinutes[catKey] = (categoryMinutes[catKey] || 0) + mins;
      }
    });

    const totalHours = Math.round((totalMinutes / 60) * 10) / 10;

    const dailyActivity: DailyActivityItem[] = [];
    let maxDayMinutes = 0;

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + dayIdx);
      const dateStr = dayDate.toISOString().split('T')[0];

      const dayEvents = weekEvents.filter((e) => e.start_at.startsWith(dateStr));
      let dayMins = 0;
      dayEvents.forEach((e) => {
        if (isAllDay(e)) return;
        const s = new Date(e.start_at).getTime();
        const end = new Date(e.end_at).getTime();
        if (end > s) {
          dayMins += Math.round((end - s) / (1000 * 60));
        }
      });

      if (dayMins > maxDayMinutes) maxDayMinutes = dayMins;

      dailyActivity.push({
        dayLabel: DAY_LABELS[dayIdx],
        dayShort: DAY_LABELS[dayIdx][0],
        dateStr,
        hours: Math.round((dayMins / 60) * 10) / 10,
        eventsCount: dayEvents.length,
        isPeak: false,
        isToday: dateStr === now.toISOString().split('T')[0],
      });
    }

    if (maxDayMinutes > 0) {
      dailyActivity.forEach((d) => {
        if (Math.round(d.hours * 60) === maxDayMinutes) {
          d.isPeak = true;
        }
      });
    }

    const categories: CategoryBreakdownItem[] = [];
    Object.entries(categoryMinutes).forEach(([rawCat, mins]) => {
      const catInfo = CATEGORY_TRANSLATIONS[rawCat] || {
        name: rawCat.charAt(0).toUpperCase() + rawCat.slice(1),
        color: CATEGORY_COLORS[rawCat] || '#94A3B8',
      };
      const catHours = Math.round((mins / 60) * 10) / 10;
      const percentage = totalMinutes > 0 ? Math.round((mins / totalMinutes) * 100) : 0;
      categories.push({
        name: catInfo.name,
        hours: catHours,
        percentage,
        color: catInfo.color,
      });
    });
    categories.sort((a, b) => b.hours - a.hours);

    let topCategoryName = 'aprendizado';
    if (categories.length > 0) {
      topCategoryName = categories[0].name.toLowerCase();
    }

    const title =
      totalHours > 0
        ? `Semana dedicada ao ${topCategoryName}`
        : 'Semana calma e livre';

    let narrative = '';
    if (weekEvents.length === 0 && completedTodos.length === 0) {
      narrative =
        'Esta semana esteve completamente livre de compromissos registrados no Vito. O tempo foi descompactado e sem sobrecargas na agenda.';
    } else {
      const evSample = weekEvents.slice(0, 2).map((e) => `"${e.title}"`).join(' e ');
      const evDesc = evSample ? `registrados como ${evSample}` : 'na agenda';
      const todoPart =
        completedTodos.length > 0
          ? `, com ${plural(completedTodos.length, 'tarefa concluída', 'tarefas concluídas')} com sucesso`
          : '';
      const catPart =
        categories.length > 0
          ? `. A maior parte do tempo foi concentrada em ${categories[0].name}.`
          : '.';
      narrative = `Você dedicou cerca de ${totalHours}h em ${plural(weekEvents.length, 'compromisso', 'compromissos')} ${evDesc}${todoPart}${catPart}`;
    }

    const topEvents = weekEvents.slice(0, 5).map((e) => {
      const s = new Date(e.start_at);
      const timeStr = `${String(s.getHours()).padStart(2, '0')}:${String(s.getMinutes()).padStart(2, '0')}`;
      return {
        id: e.id,
        title: e.title,
        category: e.category,
        time: timeStr,
      };
    });

    const tips: Array<{ category: string; text: string }> = [];
    if (totalHours > 25) {
      tips.push({
        category: 'Atenção',
        text: 'Sua carga horária em reuniões esteve alta. Considere reservar blocos de foco ininterruptos.',
      });
    } else {
      tips.push({
        category: 'Ritmo Saudável',
        text: 'Distribuição equilibrada entre reuniões e tarefas, garantindo tempo livre para prioridades.',
      });
    }

    summaries.push({
      id: `week-${weekStart.toISOString().split('T')[0]}`,
      period: formatPeriod(weekStart, weekEnd),
      weekStart,
      weekEnd,
      isCurrentWeek,
      title,
      narrative,
      hours: totalHours,
      eventsCount: weekEvents.length,
      completedTodosCount: completedTodos.length,
      totalTodosCount: weekTodos.length,
      dailyActivity,
      categories,
      topEvents,
      tips,
    });
  }

  return summaries;
}
