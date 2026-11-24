/**
 * Zona morta p/ altura do teclado: faixas de sugestão/autocomplete (Gboard)
 * re-disparam keyboardDidShow com ±40-50px. Cada setState move o dock e
 * cancela o toque em voo — causa do "1º toque só fecha o teclado".
 * Trocas reais de teclado (emoji/painel) variam > 100px e passam.
 */
export const KEYBOARD_HEIGHT_DEADZONE = 64;

/**
 * Decide a altura a adotar: retorna o novo valor, ou null p/ manter o atual.
 * Fechado (next=0) sempre zera; aberto adota qualquer valor vindo do zero.
 */
export function resolveKeyboardHeight(
  prev: number,
  isOpen: boolean,
  next: number,
  deadzone = KEYBOARD_HEIGHT_DEADZONE,
): number | null {
  if (next === 0) return 0;
  if (!isOpen || prev === 0) return next;
  if (Math.abs(next - prev) < deadzone) return null;
  return next;
}

/**
 * Calcula margem e padding inferiores do BottomSheetModal para que o teclado
 * nunca cubra inputs ou botões de ação no Android e no iOS.
 */
export function computeSheetBottomMetrics(
  keyboardHeight: number,
  safeBottom: number,
  platformOS: string = 'android',
  baseClearance = 100,
): { marginBottom: number; paddingBottom: number } {
  const safe = Math.max(0, safeBottom || 0);
  if (keyboardHeight > 0) {
    return {
      marginBottom: platformOS === 'android' ? keyboardHeight : 0,
      paddingBottom: 16,
    };
  }
  return {
    marginBottom: 0,
    paddingBottom: baseClearance + safe,
  };
}

/**
 * Garante folga mínima (120px + safe-area) para sub-views com barra inferior flutuante (FloatingTabBar).
 */
export function computeSubViewBottomPadding(safeBottom: number, minClearance = 120): number {
  return minClearance + Math.max(0, safeBottom || 0);
}

