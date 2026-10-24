export type DayPeriod = 'dawn' | 'morning' | 'afternoon' | 'evening';

// Retorna o período do dia a partir da hora local (0-23).
export const getDayPeriod = (hour: number): DayPeriod => {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  if (hour >= 18 && hour < 24) return 'evening';
  return 'dawn';
};

interface GreetingTemplate {
  period: DayPeriod | 'neutral';
  withName: string;
  anonymous: string;
}

// Frases de boas-vindas do Vito idênticas ao mobile. Tom executivo e acolhedor, estritamente sem emojis.
const GREETINGS: GreetingTemplate[] = [
  // Manhã
  { period: 'morning', withName: 'Bom dia, {name}! Vamos organizar o dia?', anonymous: 'Bom dia! Vamos organizar o dia?' },
  { period: 'morning', withName: 'Bom dia, {name}! O que temos para hoje?', anonymous: 'Bom dia! O que temos para hoje?' },
  { period: 'morning', withName: 'Bom dia, {name}! Quais são os eventos de hoje?', anonymous: 'Bom dia! Quais são os eventos de hoje?' },
  { period: 'morning', withName: 'Bom dia, {name}! Pronto para planejar a agenda?', anonymous: 'Bom dia! Pronto para planejar a agenda?' },
  // Tarde
  { period: 'afternoon', withName: 'Boa tarde, {name}! Como posso ajudar com sua rotina?', anonymous: 'Boa tarde! Como posso ajudar com sua rotina?' },
  { period: 'afternoon', withName: 'Boa tarde, {name}! Como está a agenda da tarde?', anonymous: 'Boa tarde! Como está a agenda da tarde?' },
  { period: 'afternoon', withName: 'Boa tarde, {name}! Precisa reagendar algo?', anonymous: 'Boa tarde! Precisa reagendar algo?' },
  { period: 'afternoon', withName: 'Boa tarde, {name}! O que posso adiantar para você?', anonymous: 'Boa tarde! O que posso adiantar para você?' },
  // Noite
  { period: 'evening', withName: 'Boa noite, {name}! Algum compromisso para amanhã?', anonymous: 'Boa noite! Algum compromisso para amanhã?' },
  { period: 'evening', withName: 'Boa noite, {name}! Vamos revisar o dia?', anonymous: 'Boa noite! Vamos revisar o dia?' },
  { period: 'evening', withName: 'Boa noite, {name}! Quer planejar o amanhã?', anonymous: 'Boa noite! Quer planejar o amanhã?' },
  // Madrugada
  { period: 'dawn', withName: 'Boa madrugada, {name}! Anotando algo para amanhã?', anonymous: 'Boa madrugada! Anotando algo para amanhã?' },
  // Neutras (valem para qualquer período)
  { period: 'neutral', withName: 'Como posso ajudar hoje, {name}?', anonymous: 'Como posso ajudar hoje?' },
  { period: 'neutral', withName: 'Pronto para organizar, {name}? Me diga o que precisa.', anonymous: 'Pronto para organizar? Me diga o que precisa.' },
];

const hasUsableName = (firstName?: string): boolean =>
  !!firstName && firstName.trim() !== '' && firstName !== 'Usuário';

export const pickWelcomeGreeting = (
  firstName: string | undefined,
  hour: number,
  rand: () => number = Math.random
): string => {
  const period = getDayPeriod(hour);
  const pool = GREETINGS.filter((g) => g.period === period || g.period === 'neutral');
  const list = pool.length > 0 ? pool : GREETINGS;
  const idx = Math.floor(rand() * list.length) % list.length;
  const template = list[idx];
  if (hasUsableName(firstName)) {
    return template.withName.replace('{name}', firstName!.trim().split(' ')[0]);
  }
  return template.anonymous;
};

export const THINKING_PHRASES: string[] = [
  'Pensando...',
  'Conectando contexto...',
  'Estruturando plano...',
  'Sintetizando resposta...',
  'Quase pronto...',
];

export const getNextThinkingPhrase = (currentIndex: number): string => {
  if (currentIndex < 0 || currentIndex >= THINKING_PHRASES.length) return THINKING_PHRASES[0];
  return THINKING_PHRASES[(currentIndex + 1) % THINKING_PHRASES.length];
};
