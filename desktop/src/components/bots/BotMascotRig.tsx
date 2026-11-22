import React from 'react';
import { BotAnimState, BotSkin } from '../../types/bot';
import { MascotVectorRig } from '../mascot/MascotVectorRig';
import { MascotPart } from '../mascot/mascotPalettes';

export interface BotMascotRigProps {
  skin?: BotSkin;
  state?: BotAnimState;
  size?: number;
  animated?: boolean;
  darkStage?: boolean;
  isNotification?: boolean;
  reaction?: MascotPart | null;
  interactiveParts?: boolean;
  className?: string;
}

export const BotMascotRig: React.FC<BotMascotRigProps> = ({
  skin,
  state = 'idle',
  size = 60,
  animated = true,
  darkStage,
  isNotification = false,
  reaction = null,
  interactiveParts = false,
  className = '',
}) => {
  return (
    <MascotVectorRig
      skin={skin}
      state={state}
      size={size}
      animated={animated}
      darkStage={darkStage}
      isNotification={isNotification}
      reaction={reaction}
      interactiveParts={interactiveParts}
      className={className}
    />
  );
};
