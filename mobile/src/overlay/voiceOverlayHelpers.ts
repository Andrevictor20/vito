import { AssistantChatResponse, ChatWhatsAppMessage } from '../types';
import { toChatWhatsAppMessage } from '../utils/chatCards';

export type ConversationState = 'LISTENING' | 'THINKING' | 'SPEAKING';

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

  if (state === 'LISTENING') {
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

/**
 * Retorna a cor de acento e aura com base no estado conversacional
 */
export function getAuraColor(state: ConversationState): string {
  switch (state) {
    case 'LISTENING':
      return '#10B981'; // Esmeralda Vito
    case 'THINKING':
      return '#3B82F6'; // Azul Safira
    case 'SPEAKING':
      return '#8B5CF6'; // Roxo Ametista
    default:
      return '#10B981';
  }
}

/**
 * Retorna o rótulo de status compacto
 */
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

/**
 * Extrai dados estruturados de WhatsApp da resposta do assistente
 */
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

/**
 * Formata duração em segundos para o formato canônico MM:SS (ex: "0:00", "1:15")
 */
export function formatVoiceDuration(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Retorna as cores de estado do protótipo vito-telas.html
 * Blue (#2B7FD4) ouvindo, Orange (#D9681A) pensando, Acc (#0B9A5F) falando
 */
export function getPrototypeStateColor(state: ConversationState): string {
  switch (state) {
    case 'LISTENING':
      return '#2B7FD4'; // Blue Vito
    case 'THINKING':
      return '#D9681A'; // Laranja Vito
    case 'SPEAKING':
      return '#0B9A5F'; // Acc / Esmeralda Vito
    default:
      return '#69706D'; // Muted
  }
}

/**
 * Retorna o rótulo de quem está com a palavra (VOCÊ ou VITO)
 */
export function getPrototypeSpeakerLabel(state: ConversationState): 'VOCÊ' | 'VITO' {
  return state === 'SPEAKING' ? 'VITO' : 'VOCÊ';
}

/**
 * Retorna a dica contextual refinada para a interface de voz
 */
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
