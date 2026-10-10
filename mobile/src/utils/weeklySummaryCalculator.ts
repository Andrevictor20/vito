import { Event, Todo } from '../types';

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
  trabalho: '#10B981', // Emerald
  work: '#10B981',
  estudo: '#38BDF8', // Sky
  study: '#38BDF8',
  pessoal: '#A855F7', // Violet
  personal: '#A855F7',
  saude: '#FB7185', // Coral
  health: '#FB7185',
  financas: '#FBBF24', // Amber
  finance: '#FBBF24',
  lazer: '#F97316', // Orange
  leisure: '#F97316',
  tech: '#6366F1', // Indigo
  geral: '#94A3B8', // Slate
  general: '#94A3B8',
  outros: '#94A3B8', // Slate
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
  others: { name: 'Outros', color: '#94A3B8' },
  outros: { name: 'Outros', color: '#94A3B8' },
};

const DAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

/**
 * Retorna o início da semana (Segunda-feira 00:00:00) para uma data dada
 */
function getStartOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Domingo, 1 = Segunda...
  const diff = day === 0 ? -6 : 1 - day; // ajustar para Segunda-feira
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Retorna o fim da semana (Domingo 23:59:59.999) para uma data de início da semana
 */
function getEndOfWeek(startOfWeek: Date): Date {
  const d = new Date(startOfWeek);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Formata o período semanal de forma limpa em português (ex: "5 de out. - 11 de out.")
 */
function formatWeekPeriod(start: Date, end: Date): string {
  const startDay = start.getDate();
  const startMonth = start.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  const endDay = end.getDate();
  const endMonth = end.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');

  if (startMonth === endMonth) {
    return `${startDay} - ${endDay} de ${startMonth}.`;
  }
  return `${startDay} de ${startMonth}. - ${endDay} de ${endMonth}.`;
}

/**
 * Infere a categoria a partir do evento ou do título, garantindo 100% termos em português
 */
function normalizeCategory(category?: string, title?: string): { name: string; color: string } {
  const raw = (category || '').toLowerCase().trim();
  const rawTitle = (title || '').toLowerCase();

  // 1. Verificação explícita por mapa canônico de categorias
  if (CATEGORY_TRANSLATIONS[raw]) {
    return CATEGORY_TRANSLATIONS[raw];
  }

  // 2. Classificação heurística refinada por palavras-chave em PT e EN
  if (
    raw.includes('trabalho') ||
    raw.includes('work') ||
    rawTitle.includes('reunião') ||
    rawTitle.includes('meeting') ||
    rawTitle.includes('projeto') ||
    rawTitle.includes('call')
  ) {
    return { name: 'Trabalho', color: CATEGORY_COLORS.trabalho };
  }
  if (
    raw.includes('estud') ||
    raw.includes('study') ||
    raw.includes('learn') ||
    rawTitle.includes('inglês') ||
    rawTitle.includes('curso') ||
    rawTitle.includes('aula') ||
    rawTitle.includes('leitura')
  ) {
    return { name: 'Estudo', color: CATEGORY_COLORS.estudo };
  }
  if (
    raw.includes('saúd') ||
    raw.includes('health') ||
    rawTitle.includes('treino') ||
    rawTitle.includes('academia') ||
    rawTitle.includes('médic') ||
    rawTitle.includes('corrida')
  ) {
    return { name: 'Saúde', color: CATEGORY_COLORS.saude };
  }
  if (
    raw.includes('finan') ||
    raw.includes('finance') ||
    rawTitle.includes('banco') ||
    rawTitle.includes('imposto') ||
    rawTitle.includes('pagar') ||
    rawTitle.includes('invest')
  ) {
    return { name: 'Finanças', color: CATEGORY_COLORS.financas };
  }
  if (
    raw.includes('lazer') ||
    raw.includes('leisure') ||
    rawTitle.includes('show') ||
    rawTitle.includes('cinema') ||
    rawTitle.includes('filme') ||
    rawTitle.includes('festa') ||
    rawTitle.includes('praia') ||
    rawTitle.includes('churrasco') ||
    rawTitle.includes('futebol') ||
    rawTitle.includes('jogo')
  ) {
    return { name: 'Lazer', color: CATEGORY_COLORS.lazer };
  }
  if (
    raw.includes('pessoal') ||
    raw.includes('personal') ||
    rawTitle.includes('almoço') ||
    rawTitle.includes('jantar') ||
    rawTitle.includes('aniversário') ||
    rawTitle.includes('família')
  ) {
    return { name: 'Pessoal', color: CATEGORY_COLORS.pessoal };
  }

  // 3. Fallback seguro em Português
  return { name: 'Geral', color: CATEGORY_COLORS.outros };
}

/**
 * Calcula a duração em horas de um evento
 */
function getEventDurationHours(event: Event): number {
  try {
    const start = new Date(event.start_at).getTime();
    const end = new Date(event.end_at).getTime();
    if (isNaN(start) || isNaN(end) || end <= start) {
      return 1; // 1 hora padrão se não houver intervalo válido
    }
    const diffMs = end - start;
    const diffHours = diffMs / (1000 * 60 * 60);
    return Math.max(0.25, Math.round(diffHours * 10) / 10);
  } catch {
    return 1;
  }
}

/**
 * Gera a narrativa inteligente baseada nos dados reais
 */
function generateNarrative(
  hours: number,
  eventsCount: number,
  completedTodosCount: number,
  topCategory: string | null,
  isCurrentWeek: boolean,
  topEventTitles: string[]
): { title: string; narrative: string } {
  if (eventsCount === 0 && completedTodosCount === 0) {
    return {
      title: isCurrentWeek ? 'Semana em aberto' : 'Semana calma e livre',
      narrative: isCurrentWeek
        ? 'Nenhum compromisso ou tarefa registrada nesta semana ainda. Aproveite o respiro da agenda para focar no que é prioritário ou planejar novas metas.'
        : 'Esta semana esteve completamente livre de compromissos registrados no Vito. O tempo foi descompactado e sem sobrecargas na agenda.',
    };
  }

  let title = 'Semana de foco e entregas';
  if (topCategory === 'Trabalho') {
    title = hours > 8 ? 'Semana intensa de trabalho' : 'Foco em entregas profissionais';
  } else if (topCategory === 'Estudo') {
    title = 'Semana dedicada ao aprendizado';
  } else if (topCategory === 'Saúde') {
    title = 'Semana de cuidado e bem-estar';
  } else if (topCategory === 'Lazer') {
    title = 'Semana de descanso e lazer';
  } else if (hours < 4 && eventsCount <= 2) {
    title = 'Semana leve e equilibrada';
  }

  const eventsMention = topEventTitles.length > 0 ? ` como "${topEventTitles.slice(0, 2).join('" e "')}"` : '';
  const todosMention = completedTodosCount > 0 ? `, com ${completedTodosCount} tarefa(s) concluída(s) com sucesso` : '';

  const eventLabel = eventsCount === 1 ? 'compromisso registrado' : 'compromissos registrados';
  const narrative = `Você dedicou cerca de ${hours}h em ${eventsCount} ${eventLabel}${eventsMention}${todosMention}. ${
    topCategory ? `A maior parte do tempo foi concentrada em ${topCategory}.` : 'O tempo foi distribuído de forma diversificada.'
  }`;

  return { title, narrative };
}

/**
 * Gera dicas práticas da IA para otimização de tempo com base no ritmo real
 */
function generateTips(hours: number, eventsCount: number, topCategory: string | null, completedTodosCount: number): Array<{ category: string; text: string }> {
  const tips: Array<{ category: string; text: string }> = [];

  if (hours > 12) {
    tips.push({
      category: 'Blindagem de Foco',
      text: 'Sua carga horária esteve alta. Agende blocos intencionais de descanso entre reuniões para evitar fadiga cognitiva cumulativa.',
    });
  } else {
    tips.push({
      category: 'Ritmo Cognitivo',
      text: 'Programe blocos de foco de pelo menos 90 minutos pela manhã quando seu rendimento mental costuma estar no pico.',
    });
  }

  if (topCategory === 'Trabalho') {
    tips.push({
      category: 'Gestão de Energia',
      text: 'Mantenha pelo menos um período da tarde livre de chamadas avulsas para consolidar entregas profundas e sem interrupções.',
    });
  } else if (topCategory === 'Estudo') {
    tips.push({
      category: 'Retenção Ativa',
      text: 'Aplique pequenas sessões de revisão no dia seguinte para fixar o aprendizado dos seus blocos de estudo.',
    });
  } else {
    tips.push({
      category: 'Planejamento Proativo',
      text: 'Use os Radares do Vito para acompanhar novidades e temas de interesse enquanto sua agenda mantém um respiro saudável.',
    });
  }

  if (completedTodosCount > 0) {
    tips.push({
      category: 'Eficiência de Tarefas',
      text: `Excelente avanço com ${completedTodosCount} tarefas concluídas. Continue fragmentando demandas complexas em subtarefas ágeis.`,
    });
  } else {
    tips.push({
      category: 'Checklist Executivo',
      text: 'Defina uma única prioridade não negociável para o dia seguinte antes de encerrar o expediente.',
    });
  }

  return tips;
}

/**
 * Motor Principal: Converte eventos e tarefas reais em semanas ricas estruturadas
 */
export function calculateWeeklySummaries(
  events: Event[],
  todos: Todo[],
  weeksCount: number = 4
): WeeklySummaryItem[] {
  const today = new Date();
  const currentWeekStart = getStartOfWeek(today);

  const summaries: WeeklySummaryItem[] = [];

  for (let w = 0; w < weeksCount; w++) {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - w * 7);
    const weekEnd = getEndOfWeek(weekStart);

    const isCurrentWeek = w === 0;
    const periodLabel = formatWeekPeriod(weekStart, weekEnd);

    // 1. Filtrar eventos da semana
    const weekEvents = events.filter((ev) => {
      try {
        const evStart = new Date(ev.start_at);
        return evStart >= weekStart && evStart <= weekEnd;
      } catch {
        return false;
      }
    });

    // 2. Filtrar tarefas da semana
    const weekTodos = todos.filter((td) => {
      try {
        const d = td.due_date ? new Date(td.due_date) : new Date(td.created_at);
        return d >= weekStart && d <= weekEnd;
      } catch {
        return false;
      }
    });

    const completedTodos = weekTodos.filter((t) => t.status === 'completed');

    // 3. Distribuição Diária de 7 Dias (Seg a Dom)
    const dailyActivity: DailyActivityItem[] = [];
    const dayHoursMap: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dayEventsCountMap: number[] = [0, 0, 0, 0, 0, 0, 0];

    weekEvents.forEach((ev) => {
      const evDate = new Date(ev.start_at);
      const jsDay = evDate.getDay(); // 0 = Dom, 1 = Seg...
      const idx = jsDay === 0 ? 6 : jsDay - 1; // 0=Seg ... 6=Dom
      const dur = getEventDurationHours(ev);
      dayHoursMap[idx] += dur;
      dayEventsCountMap[idx] += 1;
    });

    const maxDayHours = Math.max(...dayHoursMap);

    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const isToday =
        d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();

      dailyActivity.push({
        dayLabel: DAY_LABELS[i],
        dayShort: DAY_LABELS[i].charAt(0),
        dateStr: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        hours: Math.round(dayHoursMap[i] * 10) / 10,
        eventsCount: dayEventsCountMap[i],
        isPeak: maxDayHours > 0 && dayHoursMap[i] === maxDayHours,
        isToday,
      });
    }

    // 4. Categorias e Horas Totais
    const categoryTotals: Record<string, { hours: number; color: string }> = {};
    let totalHours = 0;

    weekEvents.forEach((ev) => {
      const { name, color } = normalizeCategory(ev.category, ev.title);
      const dur = getEventDurationHours(ev);
      totalHours += dur;
      if (!categoryTotals[name]) {
        categoryTotals[name] = { hours: 0, color };
      }
      categoryTotals[name].hours += dur;
    });

    totalHours = Math.round(totalHours * 10) / 10;

    const categories: CategoryBreakdownItem[] = Object.entries(categoryTotals)
      .map(([name, data]) => ({
        name,
        hours: Math.round(data.hours * 10) / 10,
        percentage: totalHours > 0 ? Math.round((data.hours / totalHours) * 100) : 0,
        color: data.color,
      }))
      .sort((a, b) => b.hours - a.hours);

    const topCategory = categories.length > 0 ? categories[0].name : null;

    // 5. Principais eventos para exibição
    const topEvents = weekEvents.slice(0, 3).map((ev) => {
      const d = new Date(ev.start_at);
      const timeStr = !isNaN(d.getTime())
        ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '';
      return {
        id: ev.id,
        title: ev.title,
        category: ev.category,
        time: timeStr,
      };
    });

    const topEventTitles = weekEvents.map((e) => e.title);
    const { title, narrative } = generateNarrative(
      totalHours,
      weekEvents.length,
      completedTodos.length,
      topCategory,
      isCurrentWeek,
      topEventTitles
    );

    const tips = generateTips(totalHours, weekEvents.length, topCategory, completedTodos.length);

    summaries.push({
      id: `week-${weekStart.toISOString().split('T')[0]}`,
      period: periodLabel,
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
