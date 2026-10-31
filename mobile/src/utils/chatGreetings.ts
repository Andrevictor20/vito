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

// Frases de boas-vindas do Vito. Tom humano, calmo e prestativo, sem pressão ou interrogatórios.
const GREETINGS: GreetingTemplate[] = [
  // Manhã
  { period: 'morning', withName: 'Bom dia, {name}.', anonymous: 'Bom dia.' },
  { period: 'morning', withName: 'Bom dia, {name}! Tudo bem por aí?', anonymous: 'Bom dia! Tudo bem?' },
  { period: 'morning', withName: 'Bom dia, {name}. Por aqui quando precisar.', anonymous: 'Bom dia. Por aqui quando precisar.' },
  // Tarde
  { period: 'afternoon', withName: 'Boa tarde, {name}.', anonymous: 'Boa tarde.' },
  { period: 'afternoon', withName: 'Boa tarde, {name}! Tudo bem?', anonymous: 'Boa tarde! Tudo bem?' },
  { period: 'afternoon', withName: 'Boa tarde, {name}. Por aqui.', anonymous: 'Boa tarde. Por aqui.' },
  // Noite
  { period: 'evening', withName: 'Boa noite, {name}.', anonymous: 'Boa noite.' },
  { period: 'evening', withName: 'Boa noite, {name}! Tudo em ordem?', anonymous: 'Boa noite! Tudo em ordem?' },
  { period: 'evening', withName: 'Boa noite, {name}. Por aqui quando precisar.', anonymous: 'Boa noite. Por aqui quando precisar.' },
  // Madrugada
  { period: 'dawn', withName: 'Boa madrugada, {name}.', anonymous: 'Boa madrugada.' },
  { period: 'dawn', withName: 'Olá, {name}.', anonymous: 'Olá.' },
  // Neutras (valem para qualquer período)
  { period: 'neutral', withName: 'Oi, {name}.', anonymous: 'Oi.' },
  { period: 'neutral', withName: 'Fala, {name}, tudo bem?', anonymous: 'Oi, tudo bem?' },
  { period: 'neutral', withName: 'Por aqui, {name}.', anonymous: 'Por aqui quando precisar.' },
  { period: 'neutral', withName: 'Olá, {name}.', anonymous: 'Olá.' },
];

const hasUsableName = (firstName?: string): boolean =>
  !!firstName && firstName.trim() !== '' && firstName !== 'Usuário';

// Sorteia uma mensagem de boas-vindas para o período do dia informado,
// com fallback para as frases neutras. Aceita rand injetável para testes.
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

// Frases dinâmicas, progressivas e elegantes de pensamento (estilo Claude / Toki / Gemini)
// Substituem a antiga faixa estática "Vito está organizando..."
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
