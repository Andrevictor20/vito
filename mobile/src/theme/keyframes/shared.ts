/**
 * keyframes.ts — Port declarativo 1:1 dos @keyframes de Vito-telas-atualizadas.html
 *
 * Fonte da verdade: Vito-telas-atualizadas.html
 *   - CSS base L78–L1746
 *   - Bloco #vito-onb L5300–L5305
 *   - Bloco #vito-motion L5297+
 *
 * Regra de ouro: nenhuma animação existe aqui se não existir no HTML.
 * Cada spec carrega a linha de origem para rastreabilidade e para o teste de paridade
 * (`src/theme/__tests__/keyframesParity.test.ts`), que compara os stops percentuais
 * do HTML com os frames declarados abaixo.
 *
 * Sem imports de react-native: este arquivo roda em Node puro (`tsx --test`).
 */

export type KeyframeEasing = readonly [number, number, number, number];

export interface KeyframeFrame {
  /** Offset normalizado 0..1 (0% → 1, 100% → 1). */
  at: number;
  opacity?: number;
  translateX?: number;
  translateXPercent?: number;
  translateY?: number;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  /** Graus. */
  rotate?: number;
  /** Consumido por SVG via `progress` (não entra no style animado). */
  strokeDashoffset?: number;
}

export interface KeyframeSpec {
  name: string;
  duration: number;
  easing: KeyframeEasing;
  delay?: number;
  iterations?: number | 'infinite';
  /** Linha do protótipo de onde o spec foi copiado. */
  source: string;
  frames: readonly KeyframeFrame[];
}

export const EASE: KeyframeEasing = [0.25, 0.1, 0.25, 1];
export const EASE_IN: KeyframeEasing = [0.4, 0, 1, 1];
export const EASE_OUT: KeyframeEasing = [0, 0, 0.2, 1];
export const EASE_IN_OUT: KeyframeEasing = [0.42, 0, 0.58, 1];
export const LINEAR: KeyframeEasing = [0, 0, 1, 1];
export const STD: KeyframeEasing = [0.2, 0.8, 0.2, 1];
export const Q: KeyframeEasing = [0.22, 1, 0.36, 1];
export const PUSH_LEAVE: KeyframeEasing = [0.4, 0, 0.2, 1];
export const BACK_11: KeyframeEasing = [0.2, 0.9, 0.3, 1.1];
export const BACK_12: KeyframeEasing = [0.2, 0.9, 0.3, 1.2];
export const BACK_13: KeyframeEasing = [0.2, 0.9, 0.3, 1.3];
export const BACK_125: KeyframeEasing = [0.2, 0.9, 0.3, 1.25];
export const BACK_156: KeyframeEasing = [0.34, 1.56, 0.64, 1];
