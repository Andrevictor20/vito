export interface TaskListDef {
  id: string;
  name: string;
  color: string;
}

export const DEFAULT_TASK_LISTS: TaskListDef[] = [
  { id: 'trabalho', name: 'Trabalho', color: '#0a7cff' },
  { id: 'pessoal', name: 'Pessoal', color: '#0aa55c' },
  { id: 'estudos', name: 'Estudos', color: '#ff2fa0' },
  { id: 'casa', name: 'Casa', color: '#f08300' },
];

export const TASK_LIST_COLORS = ['#0a7cff', '#f08300', '#ff2fa0', '#0aa55c', '#7a4fe0'];

export interface QuickAddParsedTask {
  title: string;
  dueDate: string | null;
  priority: 'high' | 'medium' | null;
  listId: string | null;
}

const WEEKDAY_INDEX: Record<string, number> = {
  domingo: 0,
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
};

function stripAccents(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

export function formatIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

type DateRule = [RegExp, (match: RegExpMatchArray, ref: Date) => Date];

export const QA_DATE_RULES: DateRule[] = [
  [/(^|\s)depois de amanh[ãa](?=\s|$)/i, (_m, ref) => addDays(ref, 2)],
  [/(^|\s)amanh[ãa](?=\s|$)/i, (_m, ref) => addDays(ref, 1)],
  [/(^|\s)hoje(?=\s|$)/i, (_m, ref) => addDays(ref, 0)],
  [
    /(^|\s)(domingo|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado)(-feira)?(?=\s|$)/i,
    (m, ref) => {
      const target = WEEKDAY_INDEX[m[2].toLowerCase()] ?? ref.getDay();
      const delta = (target - ref.getDay() + 7) % 7 || 7;
      return addDays(ref, delta);
    },
  ],
  [
    /(^|\s)(\d{1,2})\/(\d{1,2})(?=\s|$)/,
    (m, ref) => {
      const day = parseInt(m[2], 10);
      const month = parseInt(m[3], 10) - 1;
      const d = new Date(ref.getFullYear(), month, day);
      const todayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      if (d < todayStart) d.setFullYear(d.getFullYear() + 1);
      return d;
    },
  ],
  [
    /(^|\s)dia (\d{1,2})(?=\s|$)/i,
    (m, ref) => {
      const day = parseInt(m[2], 10);
      const d = new Date(ref.getFullYear(), ref.getMonth(), day);
      const todayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
      if (d < todayStart) d.setMonth(d.getMonth() + 1);
      return d;
    },
  ],
];

export function qaParse(
  rawInput: string,
  lists: TaskListDef[] = DEFAULT_TASK_LISTS,
  referenceDate: Date = new Date()
): QuickAddParsedTask {
  let text = rawInput || '';
  let dueDate: string | null = null;
  let priority: 'high' | 'medium' | null = null;
  let listId: string | null = null;

  for (const [regex, resolveDate] of QA_DATE_RULES) {
    const match = text.match(regex);
    if (match) {
      dueDate = formatIsoDate(resolveDate(match, referenceDate));
      text = text.replace(regex, ' ');
      break;
    }
  }

  if (/(^|\s)(p1|urgente)(?=\s|$)/i.test(text)) {
    priority = 'high';
    text = text.replace(/(^|\s)(p1|urgente)(?=\s|$)/gi, ' ');
  } else if (/(^|\s)p2(?=\s|$)/i.test(text)) {
    priority = 'medium';
    text = text.replace(/(^|\s)p2(?=\s|$)/gi, ' ');
  }

  const listMatch = text.match(/(^|\s)#([\wÀ-ú-]+)/);
  if (listMatch) {
    const query = stripAccents(listMatch[2].toLowerCase());
    const found = lists.find((l) => {
      const normName = stripAccents(l.name.toLowerCase().replace(/\s+/g, ''));
      const normId = stripAccents(l.id.toLowerCase().replace(/\s+/g, ''));
      return normName.startsWith(query) || normId.startsWith(query);
    });
    if (found) {
      listId = found.id;
      text = text.replace(listMatch[0], ' ');
    }
  }

  const cleaned = text.replace(/\s+/g, ' ').trim();
  const title = cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';

  return { title, dueDate, priority, listId };
}
