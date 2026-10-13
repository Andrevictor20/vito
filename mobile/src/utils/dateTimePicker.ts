/** Helpers puros do seletor de data/hora (JS puro, sem dependência nativa). */

export interface MonthCell {
  day: number | null;
  iso: string | null;
}

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Monta YYYY-MM-DD a partir de partes locais (mês 1-12). */
export function toISODateLocal(year: number, month: number, day: number): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${year}-${p(month)}-${p(day)}`;
}

/** Extrai {year, month, day} de YYYY-MM-DD, ou null se inválido. */
export function parseISODate(iso: string): { year: number; month: number; day: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return { year, month, day };
}

/** Soma n dias a YYYY-MM-DD (horário local meio-dia p/ evitar DST). */
export function addDaysISO(iso: string, n: number): string {
  const p = parseISODate(iso);
  if (!p) return iso;
  const d = new Date(p.year, p.month - 1, p.day, 12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return toISODateLocal(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Data local de hoje em YYYY-MM-DD. */
export function todayISO(): string {
  const d = new Date();
  return toISODateLocal(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Grade do mês em semanas Dom–Sáb; células vazias têm day/iso null. */
export function buildMonthGrid(year: number, month: number): MonthCell[][] {
  const firstDow = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const weeks: MonthCell[][] = [];
  let day = 1;
  for (let w = 0; w < 6 && day <= daysInMonth; w++) {
    const week: MonthCell[] = [];
    for (let dow = 0; dow < 7; dow++) {
      if ((w === 0 && dow < firstDow) || day > daysInMonth) {
        week.push({ day: null, iso: null });
      } else {
        week.push({ day, iso: toISODateLocal(year, month, day) });
        day++;
      }
    }
    weeks.push(week);
  }
  return weeks;
}

/** "outubro de 2026" sem depender de ICU do runtime. */
export function monthLabelPt(year: number, month: number): string {
  return `${MESES_PT[month - 1] || ''} de ${year}`;
}

/** Slots "HH:MM" de stepMin em stepMin (default 30). */
export function buildTimeSlots(stepMin = 30): string[] {
  const slots: string[] = [];
  for (let m = 0; m < 24 * 60; m += stepMin) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`);
  }
  return slots;
}

/** Valida "HH:MM" estrito (2 dígitos de hora). */
export function isValidHHMM(s: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec((s || '').trim());
  if (!m) return false;
  return Number(m[1]) <= 23 && Number(m[2]) <= 59;
}

/** Monta ISO a partir de YYYY-MM-DD + HH:MM (horário local), ou null se inválido. */
export function toLocalISO(dateISO: string, hhmm: string): string | null {
  const p = parseISODate(dateISO);
  if (!p || !isValidHHMM(hhmm)) return null;
  const d = new Date(p.year, p.month - 1, p.day, Number(hhmm.slice(0, 2)), Number(hhmm.slice(3, 5)), 0, 0);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
