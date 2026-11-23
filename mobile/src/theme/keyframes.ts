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
 * do HTML com os frames declarados.
 *
 * Este arquivo apenas agrega os módulos de specs por domínio (navegação, dados e voz),
 * mantendo a API pública (`KEYFRAMES`, `PORTED_KEYFRAME_NAMES`, tipos e curvas).
 * Sem imports de react-native: roda em Node puro (`tsx --test`).
 */

import type { KeyframeSpec } from './keyframes/shared';
import { NAVIGATION_SPECS } from './keyframes/specs-navigation';
import { DATA_SPECS } from './keyframes/specs-data';
import { VOICE_SPECS } from './keyframes/specs-voice';

export * from './keyframes/shared';

const KEYFRAME_LIST: readonly KeyframeSpec[] = [
  ...NAVIGATION_SPECS,
  ...DATA_SPECS,
  ...VOICE_SPECS,
];

export const KEYFRAMES: Record<string, KeyframeSpec> = Object.freeze(
  KEYFRAME_LIST.reduce<Record<string, KeyframeSpec>>((acc, spec) => {
    acc[spec.name] = spec;
    return acc;
  }, {})
);

export type KeyframeName = keyof typeof KEYFRAMES;

/** Nomes portados nesta onda — usado pelo teste de paridade. */
export const PORTED_KEYFRAME_NAMES: readonly string[] = KEYFRAME_LIST.map((spec) => spec.name);
