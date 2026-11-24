/** Converte "DD/MM/AAAA" + "HH:MM" em ISO local, ou null se inválido/passado. */
export function parseReminderInput(dateStr: string, timeStr: string, nowRef?: number): string | null {
  const dm = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec((dateStr || '').trim());
  const tm = /^(\d{1,2}):(\d{2})$/.exec((timeStr || '').trim());
  if (!dm || !tm) return null;

  const day = Number(dm[1]);
  const month = Number(dm[2]);
  const year = Number(dm[3]);
  const hour = Number(tm[1]);
  const minute = Number(tm[2]);
  if (month < 1 || month > 12 || hour > 23 || minute > 59) return null;

  const d = new Date(year, month - 1, day, hour, minute, 0, 0);
  // Guarda contra overflow (ex: 31/02 vira março).
  if (d.getDate() !== day || d.getMonth() !== month - 1 || d.getFullYear() !== year) return null;

  const now = nowRef ?? Date.now();
  if (d.getTime() <= now) return null;
  return d.toISOString();
}

/** Formata ISO para "DD/MM/AAAA" e "HH:MM" (pré-preenchimento do sheet). */
export function splitReminderISO(iso?: string): { date: string; time: string } {
  if (!iso) return { date: '', time: '' };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: '', time: '' };
  const p = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${p(d.getHours())}:${p(d.getMinutes())}`,
  };
}
