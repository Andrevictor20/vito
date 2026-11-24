import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { BotAnimState, BotSkin } from '../types/bots';
import { parseBotSkin } from '../utils/botsHelpers';
import { MascotVectorRig } from '../mascot/MascotVectorRig';

export interface BotMascotAvatarProps {
  size?: number;
  skin?: BotSkin;
  skinJson?: string;
  animState?: BotAnimState;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Avatar de Bot unificado no rig vetorial 500x500 do polvo Vito (6 cores + 10 presets).
 * Em cards de lista, passar animated={false} para manter 60 FPS (list-pause lock).
 */
export const BotMascotAvatar: React.FC<BotMascotAvatarProps> = ({
  size = 60,
  skin,
  skinJson,
  animState = 'idle',
  animated = false,
  style,
}) => {
  const resolvedSkin = parseBotSkin(skinJson, skin);

  return (
    <MascotVectorRig
      size={size}
      skin={resolvedSkin}
      state={animState}
      animated={animated}
      style={style}
    />
  );
};
