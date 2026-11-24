import type React from 'react';
import type { MascotAnimationState, MascotSkin } from './mascotPalettes';
import type { MascotAnimValues } from './mascotAnimationBuilders';

export interface MascotSkiaCanvasProps {
  size: number;
  resolvedState: MascotAnimationState;
  colors: Required<MascotSkin>;
  isCompact: boolean;
  isNotification: boolean;
  anim: MascotAnimValues;
}

/** Fallback Web: o MascotVectorRig renderiza SVG com Reanimated 4 na web sem exigir WASM CanvasKit. */
export const MascotSkiaCanvas: React.FC<MascotSkiaCanvasProps> = () => null;
