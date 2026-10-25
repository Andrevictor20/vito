import { AssistantChatResponse, ChatWhatsAppMessage } from '../types';
import { toChatWhatsAppMessage } from '../utils/chatCards';

export type ConversationState = 'LISTENING' | 'THINKING' | 'SPEAKING';

export interface HarmonicBarConfig {
  minHeight: number;
  maxHeight: number;
}

export const DEFAULT_BAR_CONFIG: HarmonicBarConfig = {
  minHeight: 8,
  maxHeight: 38,
};

/**
 * Calcula a altura dos 5 seletores harmônicos do visualizador estilo Gemini.
 * Os índices 0 a 4 recebem multiplicadores harmônicos para criar uma curva suave e natural.
 */
export function calculateHarmonicBarHeights(
  level: number, // 0.0 a 1.0
  state: ConversationState,
  phase: number = 0,
  config: HarmonicBarConfig = DEFAULT_BAR_CONFIG
): number[] {
  const { minHeight, maxHeight } = config;
  const clampedLevel = Math.max(0, Math.min(1, level));
  const range = maxHeight - minHeight;

  if (state === 'LISTENING') {
    // Curva harmônica de sino (centro mais alto): [0.45, 0.8, 1.0, 0.8, 0.45]
    const weights = [0.45, 0.82, 1.0, 0.78, 0.48];
    return weights.map((w, idx) => {
      // Leve oscilação de repouso (fase) para não ficar estático quando em silêncio
      const idleWave = Math.sin(phase + idx * 0.8) * 0.08;
      const effectiveLevel = Math.max(idleWave, clampedLevel);
      return Math.round(minHeight + effectiveLevel * range * w);
    });
  }

  if (state === 'THINKING') {
    // Onda senoidal viajante suave
    return [0, 1, 2, 3, 4].map((idx) => {
      const sine = (Math.sin(phase * 4 + idx * 0.9) + 1) / 2; // 0..1
      return Math.round(minHeight + (sine * range * 0.65));
    });
  }

  // SPEAKING: Dança harmônica mais vibrante
  const danceWeights = [0.6, 0.95, 0.8, 1.0, 0.65];
  return danceWeights.map((w, idx) => {
    const wave = (Math.sin(phase * 6 + idx * 1.2) + 1) / 2;
    return Math.round(minHeight + (wave * range * w));
  });
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
