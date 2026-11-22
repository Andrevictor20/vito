import React, { useState } from 'react';
import { MascotVectorRig } from '../mascot/MascotVectorRig';
import {
  MascotAnimationState,
  MascotSkin,
  nextHeroAnimState,
  normalizeMascotState,
} from '../mascot/mascotPalettes';

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
  className?: string;
  onClick?: () => void;
  onStateChange?: (next: MascotAnimationState) => void;
}

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
  className = '',
  onClick,
  onStateChange,
}) => {
  const [cycledState, setCycledState] = useState<MascotAnimationState | null>(null);
  const propState = normalizeMascotState(state);
  const activeState = cycleOnTap && cycledState ? cycledState : propState;

  const handleClick = () => {
    if (cycleOnTap) {
      const next = nextHeroAnimState(activeState);
      setCycledState(next);
      onStateChange?.(next);
    }
    onClick?.();
  };

  return (
    <div
      onClick={cycleOnTap || onClick ? handleClick : undefined}
      style={{ width: size, height: size }}
      className={`relative inline-flex items-center justify-center select-none shrink-0 ${
        cycleOnTap || onClick ? 'cursor-pointer' : ''
      } ${className}`}
      data-state={activeState}
    >
      <MascotVectorRig
        skin={skin}
        state={activeState}
        size={size}
        animated={animated}
        speed={speed}
        darkStage={darkStage}
        isNotification={isNotification}
        interactiveParts={interactiveParts}
      />
    </div>
  );
};
