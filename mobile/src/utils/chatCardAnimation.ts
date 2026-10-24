/**
 * Constantes e utilitários para animação de entrada suave dos cards do chat.
 * Paridade com as animações de login-vito.html (`animation: rise .45s .25s ease both`).
 */
export const CHAT_CARD_ANIMATION = {
  duration: 400, // 380-420ms
  delay: 180, // 150-200ms
  offsetY: 10, // 8-10dp
  // Bezier cúbica suave idêntica ao login-vito.html
  bezier: [0.2, 0.8, 0.2, 1] as const,
  // Spring orgânica alternativa
  spring: {
    damping: 20,
    stiffness: 220,
  } as const,
};

export function shouldReduceMotion(systemReduceMotion: boolean): boolean {
  return Boolean(systemReduceMotion);
}

export function computeEntranceTiming(
  cardIndex: number = 0,
  baseDelay: number = CHAT_CARD_ANIMATION.delay,
  staggerMs: number = 60
): number {
  return Math.max(0, baseDelay + cardIndex * staggerMs);
}
