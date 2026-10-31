import type { CalendarEvent as Event } from '../types';

export interface TokiDayCell {
  dayNumber: number;
  date: Date;
  dateKey: string;
  isCurrentMonth: boolean;
}

export interface TokiMonthData {
  id: string;
  year: number;
  month: number;
  title: string;
  daysInMonth: number;
  firstDayOfWeek: number;
  grid: TokiDayCell[];
}

export function getEventCompactEmoji(event: Event): string {
  const text = `${event.title || ''} ${event.description || ''}`.toLowerCase();
  const category = (event.category || '').toLowerCase();

  if (category === 'holiday' || text.includes('feriado') || text.includes('servidor') || text.includes('república') || text.includes('independência') || text.includes('tiradentes') || text.includes('consciência')) {
    if (text.includes('finados')) return '🕯️';
    if (text.includes('natal')) return '🎄';
    if (text.includes('páscoa') || text.includes('pascoa')) return '🐰';
    if (text.includes('ano novo') || text.includes('reveillon')) return '🎆';
    if (text.includes('carnaval')) return '🎉';
    return '🇧🇷';
  }

  if (category === 'study' || text.includes('aula') || text.includes('curso') || text.includes('estudo') || text.includes('inglês') || text.includes('ingles') || text.includes('prova')) {
    if (text.includes('inglês') || text.includes('ingles') || text.includes('english')) return '🇬🇧';
    return '📚';
  }

  if (category === 'work' || text.includes('reunião') || text.includes('reuniao') || text.includes('meeting') || text.includes('sync') || text.includes('alinhamento') || text.includes('planejamento')) {
    return '💼';
  }

  if (category === 'health' || text.includes('médic') || text.includes('medic') || text.includes('consulta') || text.includes('exame') || text.includes('terapia')) {
    if (text.includes('dentista')) return '🦷';
    return '🩺';
  }

  if (category === 'finance' || text.includes('fatura') || text.includes('pagamento') || text.includes('banco') || text.includes('investimento')) {
    return '💰';
  }

  if (category === 'leisure' || text.includes('anivers') || text.includes('niver')) {
    return '🎂';
  }
  if (text.includes('churras') || text.includes('bbq')) {
    return '🍖';
  }
  if (text.includes('viagem') || text.includes('voo')) {
    return '✈️';
  }
  if (text.includes('festa') || text.includes('party')) {
    return '🍻';
  }

  return '📌';
}

export function formatTokiMonthHeader(year: number, month: number): string {
  const d = new Date(year, month, 1);
  const name = d.toLocaleDateString('pt-BR', { month: 'long' });
  return `${name} ${year}`;
}

export function generateMonthData(year: number, month: number): TokiMonthData {
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const grid: TokiDayCell[] = [];

  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const day = prevMonthDays - i;
    const d = new Date(year, month - 1, day);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    grid.push({
      dayNumber: day,
      date: d,
      dateKey,
      isCurrentMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    grid.push({
      dayNumber: day,
      date: d,
      dateKey,
      isCurrentMonth: true,
    });
  }

  const remainder = 7 - (grid.length % 7);
  if (remainder < 7) {
    for (let day = 1; day <= remainder; day++) {
      const d = new Date(year, month + 1, day);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      grid.push({
        dayNumber: day,
        date: d,
        dateKey,
        isCurrentMonth: false,
      });
    }
  }

  return {
    id: `${year}-${String(month + 1).padStart(2, '0')}`,
    year,
    month,
    title: formatTokiMonthHeader(year, month),
    daysInMonth,
    firstDayOfWeek: firstDayIndex,
    grid,
  };
}

export function generateMonthRange(
  baseDate: Date,
  pastMonths: number = 2,
  futureMonths: number = 8
): TokiMonthData[] {
  const result: TokiMonthData[] = [];
  const startMonthDate = new Date(baseDate.getFullYear(), baseDate.getMonth() - pastMonths, 1);
  const totalMonths = pastMonths + 1 + futureMonths;

  for (let i = 0; i < totalMonths; i++) {
    const cur = new Date(startMonthDate.getFullYear(), startMonthDate.getMonth() + i, 1);
    result.push(generateMonthData(cur.getFullYear(), cur.getMonth()));
  }

  return result;
}
