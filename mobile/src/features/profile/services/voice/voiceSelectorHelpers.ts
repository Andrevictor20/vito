export interface VoiceOption {
  id: 'puck' | 'kore';
  gender: 'masculino' | 'feminino';
  label: string;
  sub: string;
  badge: string;
}

export const VOICE_OPTIONS: VoiceOption[] = [
  {
    id: 'puck',
    gender: 'masculino',
    label: 'Voz Masculina',
    sub: 'Tom natural, conversacional e firme (Gemini Puck)',
    badge: 'Gemini Neural',
  },
  {
    id: 'kore',
    gender: 'feminino',
    label: 'Voz Feminina',
    sub: 'Tom natural, caloroso e expressivo (Gemini Kore)',
    badge: 'Gemini Neural',
  },
];

export function normalizeVoiceChoice(voice?: string | null): 'puck' | 'kore' {
  if (!voice) return 'puck';
  const v = voice.toLowerCase().trim();
  if (
    v.includes('kore') ||
    v.includes('female') ||
    v.includes('feminino') ||
    v.includes('francisca') ||
    v.includes('mulher')
  ) {
    return 'kore';
  }
  return 'puck';
}

export function getVoiceDisplayLabel(voice?: string | null): string {
  const normalized = normalizeVoiceChoice(voice);
  return normalized === 'kore' ? 'Voz Feminina' : 'Voz Masculina';
}

export function getVoiceEmoji(voice?: string | null): string {
  const normalized = normalizeVoiceChoice(voice);
  return normalized === 'kore' ? '👩' : '👨';
}
