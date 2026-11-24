import React, { useState } from 'react';
import { StyleProp, TouchableOpacity, ViewStyle } from 'react-native';
import { MascotVectorRig } from '../../features/bots/mascot/MascotVectorRig';
import {
  MascotAnimationState,
  MascotSkin,
  nextHeroAnimState,
  normalizeMascotState,
} from '../../features/bots/mascot/mascotPalettes';

export interface VitoMascotProps {
  size?: number;
  animated?: boolean;
  state?: MascotAnimationState | 'success';
  speed?: number;
  skin?: MascotSkin;
  isNotification?: boolean;
  interactiveParts?: boolean;
  cycleOnTap?: boolean;
  darkStage?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  onStateChange?: (next: MascotAnimationState) => void;
}

/**
 * Componente unificado do mascote Vito (Rig Vetorial 500x500).
 * Suporta todos os 10 estados dinâmicos, micro-interações, modo compacto (<=34px),
 * pausa em listas (animated=false) e ReduceMotion nativo.
 */
export const VitoMascot: React.FC<VitoMascotProps> = ({
  size = 48,
  animated = true,
  state = 'idle',
  speed = 1,
  skin,
  isNotification = false,
  interactiveParts = false,
  cycleOnTap = false,
  darkStage,
  style,
  onPress,
  onStateChange,
}) => {
  const [cycledState, setCycledState] = useState<MascotAnimationState | null>(null);
  const propState = normalizeMascotState(state);
  const activeState = cycleOnTap && cycledState ? cycledState : propState;

  const rig = (
    <MascotVectorRig
      skin={skin}
      state={activeState}
      size={size}
      animated={animated}
      speed={speed}
      darkStage={darkStage}
      isNotification={isNotification}
      interactiveParts={interactiveParts}
      style={style}
    />
  );

  if (cycleOnTap || onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={() => {
          if (cycleOnTap) {
            const next = nextHeroAnimState(activeState);
            setCycledState(next);
            onStateChange?.(next);
          }
          onPress?.();
        }}
        accessibilityRole="button"
        accessibilityLabel="Mascote Vito"
      >
        {rig}
      </TouchableOpacity>
    );
  }

  return rig;
};
