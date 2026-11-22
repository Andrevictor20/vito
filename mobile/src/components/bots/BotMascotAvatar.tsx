import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect } from 'react-native-svg';
import { BotAnimState, BotSkin } from '../../types/bots';
import { parseBotSkin } from '../../utils/botsHelpers';

export interface BotMascotAvatarProps {
  size?: number;
  skin?: BotSkin;
  skinJson?: string;
  animState?: BotAnimState;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Rig vetorial 500x500 do polvo Vito com skin própria do bot (6 cores + 10 presets)
 * e suporte a botAnimState (idle, thinking, happy, surprised, sleeping).
 * Em cards de lista, passar animated={false} para manter 60 FPS.
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
  const floatAnim = useRef(new Animated.Value(0)).current;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animated || animState === 'sleeping') {
      floatAnim.setValue(0);
      return;
    }
    const duration = animState === 'happy' ? 700 : animState === 'thinking' ? 1200 : 1800;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: animState === 'happy' ? -3 : -1.5,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [animated, animState, floatAnim]);

  useEffect(() => {
    if (!animated || animState === 'sleeping') {
      blinkAnim.setValue(animState === 'sleeping' ? 0.15 : 1);
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        if (!alive) return;
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.12, duration: 75, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 120, useNativeDriver: true }),
        ]).start(() => {
          if (alive) schedule();
        });
      }, 2800 + Math.random() * 2500);
    };
    schedule();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [animated, animState, blinkAnim]);

  const isSleeping = animState === 'sleeping';
  const isSurprised = animState === 'surprised';
  const eyeRadiusY = isSleeping ? 4 : isSurprised ? 32 : 24;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          transform: [{ translateY: floatAnim }],
        },
        style,
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 500 500">
        {/* Fundo sutil circular */}
        <Circle cx="250" cy="250" r="240" fill={resolvedSkin.bellyColor} opacity={0.45} />

        {/* Tentáculos traseiros */}
        <Path
          d="M115 330 C85 385 95 435 135 440 C165 444 175 400 185 365 Z"
          fill={resolvedSkin.tentacleColor}
        />
        <Path
          d="M385 330 C415 385 405 435 365 440 C335 444 325 400 315 365 Z"
          fill={resolvedSkin.tentacleColor}
        />
        <Path
          d="M175 355 C165 415 185 455 215 452 C240 450 240 400 240 365 Z"
          fill={resolvedSkin.tentacleColor}
        />
        <Path
          d="M325 355 C335 415 315 455 285 452 C260 450 260 400 260 365 Z"
          fill={resolvedSkin.tentacleColor}
        />

        {/* Cabeça / Corpo */}
        <Ellipse cx="250" cy="225" rx="145" ry="140" fill={resolvedSkin.bodyColor} />

        {/* Barriga / Destaque interno */}
        <Ellipse cx="250" cy="285" rx="92" ry="68" fill={resolvedSkin.bellyColor} opacity={0.28} />

        {/* Antena / Detalhe de destaque do Bot */}
        <Path
          d="M250 85 L250 54"
          stroke={resolvedSkin.accentColor}
          strokeWidth="12"
          strokeLinecap="round"
        />
        <Circle cx="250" cy="46" r="16" fill={resolvedSkin.accentColor} />

        {/* Bochechas */}
        <Ellipse
          cx="155"
          cy="252"
          rx="22"
          ry="13"
          fill={resolvedSkin.cheekColor}
          opacity={0.75}
        />
        <Ellipse
          cx="345"
          cy="252"
          rx="22"
          ry="13"
          fill={resolvedSkin.cheekColor}
          opacity={0.75}
        />

        {/* Olhos */}
        <Ellipse cx="204" cy="215" rx="18" ry={eyeRadiusY} fill={resolvedSkin.eyeColor} />
        <Ellipse cx="296" cy="215" rx="18" ry={eyeRadiusY} fill={resolvedSkin.eyeColor} />

        {/* Brilho nos olhos quando acordado */}
        {!isSleeping && (
          <>
            <Circle cx="210" cy="205" r="5" fill={resolvedSkin.accentColor} opacity={0.5} />
            <Circle cx="302" cy="205" r="5" fill={resolvedSkin.accentColor} opacity={0.5} />
          </>
        )}

        {/* Boca conforme estado */}
        {animState === 'happy' && (
          <Path
            d="M224 268 Q250 292 276 268"
            stroke={resolvedSkin.eyeColor}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />
        )}
        {animState === 'surprised' && (
          <Circle cx="250" cy="276" r="14" fill={resolvedSkin.eyeColor} opacity={0.9} />
        )}
        {animState === 'thinking' && (
          <Rect x="234" y="272" width="32" height="8" rx="4" fill={resolvedSkin.eyeColor} />
        )}
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
