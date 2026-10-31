import { AssistantChatResponse, ChatWhatsAppMessage } from '../types';
import { toChatWhatsAppMessage } from '../utils/chatCards';

export type ConversationState = 'LISTENING' | 'THINKING' | 'SPEAKING' | 'IDLE' | 'MINI';

export interface HarmonicBarConfig {
  minHeight: number;
  maxHeight: number;
}

export const DEFAULT_BAR_CONFIG: HarmonicBarConfig = {
  minHeight: 4,
  maxHeight: 28,
};

export const GAUSSIAN_WEIGHTS_13 = [
  0.22, 0.35, 0.50, 0.68, 0.85, 0.96, 1.00, 0.96, 0.85, 0.68, 0.50, 0.35, 0.22,
];

export const COMPACT_WEIGHTS_5 = [0.45, 0.80, 1.00, 0.80, 0.45];

export interface OverlayThemeTokens {
  mode: 'light' | 'dark';
  bg: string;
  ink: string;
  muted: string;
  line: string;
  surf: string;
  ov: string;
  blue: string;
  red: string;
  orange: string;
  acc: string;
  purple: string;
  fin: string;
}

export const OVERLAY_LIGHT_THEME: OverlayThemeTokens = {
  mode: 'light',
  bg: '#ffffff',
  ink: '#17191b',
  muted: '#69706d',
  line: '#d6dbd8',
  surf: '#f2f4f3',
  ov: 'rgba(255,255,255,0.92)',
  blue: '#2b7fd4',
  red: '#d6355a',
  orange: '#d9681a',
  acc: '#0b9a5f',
  purple: '#7a4fe0',
  fin: '#a8710a',
};

export const OVERLAY_DARK_THEME: OverlayThemeTokens = {
  mode: 'dark',
  bg: '#121416',
  ink: '#f1f3f2',
  muted: '#9aa3a0',
  line: '#2c3134',
  surf: '#1c1f21',
  ov: 'rgba(28,31,33,0.92)',
  blue: '#5aa2ee',
  red: '#ff6b8a',
  orange: '#ff9a52',
  acc: '#34d399',
  purple: '#a58bff',
  fin: '#f5b93d',
};

export function getOverlayTheme(mode: 'light' | 'dark' | boolean): OverlayThemeTokens {
  const isDark = mode === true || mode === 'dark';
  return isDark ? OVERLAY_DARK_THEME : OVERLAY_LIGHT_THEME;
}

export function getCompactStateAccentColor(
  state: ConversationState,
  isMuted: boolean,
  theme: OverlayThemeTokens
): string {
  if (isMuted) return theme.muted;
  switch (state) {
    case 'LISTENING':
      return theme.blue;
    case 'THINKING':
      return theme.orange;
    case 'SPEAKING':
      return theme.acc;
    case 'IDLE':
    case 'MINI':
    default:
      return theme.muted;
  }
}

/**
 * Calcula a altura das 5 barras do equalizador compacto (.eq2) do protótipo fora do app (intervalo [4, 18]).
 */
export function calculateCompact5BarHeights(
  level: number,
  state: ConversationState,
  isMuted: boolean = false,
  phase: number = 0
): number[] {
  if (isMuted || state === 'IDLE' || state === 'MINI') {
    return [4, 4, 4, 4, 4];
  }

  const minHeight = 4;
  const maxHeight = 18;
  const range = maxHeight - minHeight;
  const clamped = Math.max(0, Math.min(1, level));

  if (state === 'LISTENING') {
    return COMPACT_WEIGHTS_5.map((w, idx) => {
      const wave = (Math.sin(phase * 5 + idx * 0.9) + 1) * 0.22;
      const eff = Math.max(wave, clamped);
      return Math.max(minHeight, Math.min(maxHeight, Math.round(minHeight + eff * range * w)));
    });
  }

  if (state === 'THINKING') {
    return COMPACT_WEIGHTS_5.map((w, idx) => {
      const wave = (Math.sin(phase * 7 + idx * 1.1) + 1) / 2;
      return Math.max(minHeight, Math.min(maxHeight, Math.round(minHeight + wave * range * 0.65 * w)));
    });
  }

  // SPEAKING
  return COMPACT_WEIGHTS_5.map((w, idx) => {
    const wave =
      (Math.sin(phase * 8 + idx * 0.85) * 0.65 +
        Math.cos(phase * 5 + idx * 1.3) * 0.35 +
        1) /
      2;
    return Math.max(minHeight, Math.min(maxHeight, Math.round(minHeight + wave * range * w)));
  });
}

/**
 * Retorna a legenda em 2 linhas (.pcap <small> e <span>) idêntica ao protótipo fora do app.
 */
export function getCompactStateCaption(
  state: ConversationState,
  isMuted: boolean,
  liveText?: string
): { label: string; text: string } {
  if (isMuted) {
    return { label: 'Mudo', text: 'Microfone desligado' };
  }
  const cleanLive = (liveText || '').trim();
  switch (state) {
    case 'LISTENING':
      return {
        label: 'Ouvindo',
        text:
          cleanLive &&
          cleanLive !== 'Estou ouvindo... O que deseja fazer?' &&
          cleanLive !== 'Ouvindo você...'
            ? cleanLive
            : 'Pode falar…',
      };
    case 'THINKING':
      return {
        label: 'Pensando',
        text: cleanLive && cleanLive !== 'Pensando...' ? cleanLive : 'Pensando…',
      };
    case 'SPEAKING':
      return {
        label: 'Falando',
        text: 'Respondendo…',
      };
    case 'IDLE':
    case 'MINI':
    default:
      return {
        label: 'Pronto',
        text: 'Pode continuar…',
      };
  }
}

export type OverlayActionKind = 'cal' | 'check' | 'wa' | 'coin';

export interface OverlayActionCardData {
  kind: OverlayActionKind;
  title: string;
  subtitle: string;
  primaryLabel: string;
  secondaryLabel?: string;
}

/**
 * Extrai um card estruturado (.acard) da resposta do assistente para o card flutuante (.rcard).
 */
export function extractOverlayActionCard(
  response?: Partial<AssistantChatResponse> | null
): OverlayActionCardData | null {
  if (!response) return null;

  const wa = extractWhatsAppCardData(response as AssistantChatResponse);
  if (wa) {
    return {
      kind: 'wa',
      title: `WhatsApp · ${wa.recipient_name || wa.recipient_phone || 'Contato'}`,
      subtitle: `"${wa.message}"`,
      primaryLabel: 'Enviar no WhatsApp',
      secondaryLabel: 'Desfazer',
    };
  }

  if (response.event) {
    return {
      kind: 'cal',
      title: response.event.title || 'Compromisso',
      subtitle: response.event.start_at || 'GoogleAgenda',
      primaryLabel: 'Abrir no Vito',
      secondaryLabel: 'Desfazer',
    };
  }

  if (response.todo) {
    return {
      kind: 'check',
      title: response.todo.title || 'Tarefa criada',
      subtitle: response.todo.category || 'Tarefas · Pendente',
      primaryLabel: 'Abrir no Vito',
      secondaryLabel: 'Desfazer',
    };
  }

  const rawCards = response.actions || response.cards || [];
  if (Array.isArray(rawCards) && rawCards.length > 0) {
    const first = rawCards[0];
    const t = (first.type || '').toLowerCase();
    let kind: OverlayActionKind = 'cal';
    if (t.includes('todo') || t.includes('task') || t.includes('pending')) {
      kind = 'check';
    } else if (t.includes('whatsapp') || t.includes('wa')) {
      kind = 'wa';
    } else if (t.includes('trigger') || t.includes('fin') || t.includes('price')) {
      kind = 'coin';
    }
    return {
      kind,
      title: first.title || 'Ação concluída',
      subtitle: first.subtitle || 'Sincronizado no Vito',
      primaryLabel: 'Abrir no Vito',
      secondaryLabel: 'Desfazer',
    };
  }

  return null;
}

/**
 * Divide a resposta em palavras para destaque progressivo sincronizado com a fala (#rtxt span.on).
 */
export function splitReplyWordsForHighlight(text?: string): string[] {
  if (!text) return [];
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

/**
 * Infere o MIME type real do áudio gravado (.wav vs .m4a vs .mp3).
 */
export function inferAudioMimeType(filename?: string, uri?: string): string {
  const combined = `${filename || ''} ${uri || ''}`.toLowerCase();
  if (combined.includes('.wav')) return 'audio/wav';
  if (combined.includes('.mp3')) return 'audio/mpeg';
  return 'audio/m4a';
}

/**
 * Calcula a altura das 13 barras harmônicas do visualizador estilo Gemini.
 * Utiliza distribuição gaussiana de sino com pico central no índice 6 (peso 1.00).
 */
export function calculateHarmonicBarHeights(
  level: number, // 0.0 a 1.0
  state: ConversationState,
  phase: number = 0,
  barCountOrConfig: number | HarmonicBarConfig = 13,
  maybeConfig?: HarmonicBarConfig
): number[] {
  const config =
    (typeof barCountOrConfig === 'object' ? barCountOrConfig : maybeConfig) ||
    DEFAULT_BAR_CONFIG;
  const { minHeight, maxHeight } = config;
  const clampedLevel = Math.max(0, Math.min(1, level));
  const range = maxHeight - minHeight;
  const weights = GAUSSIAN_WEIGHTS_13;

  if (state === 'LISTENING' || state === 'IDLE' || state === 'MINI') {
    return weights.map((w, idx) => {
      const idleWave = Math.sin(phase + idx * 0.45) * 0.12;
      const effectiveLevel = Math.max(idleWave, clampedLevel);
      return Math.round(minHeight + effectiveLevel * range * w);
    });
  }

  if (state === 'THINKING') {
    return weights.map((w, idx) => {
      const sine = (Math.sin(phase * 5 + idx * 0.65) + 1) / 2;
      return Math.round(minHeight + sine * range * 0.65);
    });
  }

  // SPEAKING: Dança harmônica expressiva modulada pela curva gaussiana
  return weights.map((w, idx) => {
    const wave =
      (Math.sin(phase * 7 + idx * 0.8) * 0.7 +
        Math.cos(phase * 4 + idx * 1.2) * 0.3 +
        1) /
      2;
    return Math.round(minHeight + wave * range * w);
  });
}

/**
 * Identifica se a fala do usuário é uma despedida que deve fechar o assistente
 */
export function isGoodbyeUtterance(text?: string): boolean {
  if (!text) return false;
  const clean = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  const patterns = [
    /\b(tchau|falou|valeu|brigado|obrigado|ate mais|ate logo|ate breve|so isso|pode fechar|fechar assistente|encerrar|dispensar)\b/i,
  ];

  return patterns.some((p) => p.test(clean));
}

export function getAuraColor(state: ConversationState): string {
  switch (state) {
    case 'LISTENING':
      return '#10B981';
    case 'THINKING':
      return '#3B82F6';
    case 'SPEAKING':
      return '#8B5CF6';
    default:
      return '#10B981';
  }
}

export function getStateLabel(state: ConversationState): string {
  switch (state) {
    case 'LISTENING':
      return 'Ouvindo você...';
    case 'THINKING':
      return 'Processando...';
    case 'SPEAKING':
      return 'Vito';
    default:
      return 'Pronto';
  }
}

export function extractWhatsAppCardData(
  response?: AssistantChatResponse | null
): ChatWhatsAppMessage | null {
  if (!response) return null;
  const card = toChatWhatsAppMessage(response);
  if (card && (card.recipient_name || card.recipient_phone) && card.message) {
    return card;
  }
  return null;
}

export function formatVoiceDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export function getPrototypeStateColor(state: ConversationState): string {
  switch (state) {
    case 'LISTENING':
      return '#2B7FD4';
    case 'THINKING':
      return '#D9681A';
    case 'SPEAKING':
      return '#0B9A5F';
    default:
      return '#69706D';
  }
}

export function getPrototypeSpeakerLabel(state: ConversationState): 'VOCÊ' | 'VITO' {
  return state === 'SPEAKING' ? 'VITO' : 'VOCÊ';
}

export function getPrototypeHint(state: ConversationState, isMuted: boolean): string {
  if (isMuted) {
    return 'Microfone desativado';
  }
  switch (state) {
    case 'SPEAKING':
      return 'Toque no Vito para interromper';
    case 'THINKING':
      return 'Processando sua solicitação...';
    case 'LISTENING':
    default:
      return 'Fale naturalmente com o Vito';
  }
}
