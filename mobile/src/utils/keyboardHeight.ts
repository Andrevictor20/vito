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
