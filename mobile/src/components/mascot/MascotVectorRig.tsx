import React, { useEffect } from 'react';
import { Animated, StyleProp, View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Line, Path, Rect } from 'react-native-svg';
import { useTheme } from '../../context/ThemeContext';
import {
  MascotAnimationState,
  MascotPart,
  MascotSkin,
  normalizeMascotState,
  resolveSkin,
} from './mascotPalettes';
import { useMascotAnimation } from './useMascotAnimation';

const AnimatedG = Animated.createAnimatedComponent(G);

export interface MascotVectorRigProps {
  skin?: MascotSkin;
  state?: MascotAnimationState | 'success';
  size?: number;
  animated?: boolean;
  speed?: number;
  darkStage?: boolean;
  isNotification?: boolean;
  reaction?: MascotPart | null;
  interactiveParts?: boolean;
  style?: StyleProp<ViewStyle>;
  onPartPress?: (part: MascotPart) => void;
}

export const MascotVectorRig: React.FC<MascotVectorRigProps> = ({
  skin,
  state = 'idle',
  size = 60,
  animated = true,
  speed = 1,
  darkStage,
  isNotification = false,
  reaction = null,
  interactiveParts = false,
  style,
  onPartPress,
}) => {
  const { isDark } = useTheme();
  const resolvedState = normalizeMascotState(state);
  const c = resolveSkin(skin, darkStage ?? isDark);
  const isCompact = size <= 34;

  const anim = useMascotAnimation({
    state: resolvedState,
    animated,
    speed,
  });

  useEffect(() => {
    if (reaction) {
      anim.triggerPartReaction(reaction);
    }
  }, [reaction, anim]);

  const showHappyEyes = resolvedState === 'happy';
  const showSleepingEyes = resolvedState === 'sleeping';
  const showDefaultEyes = !showHappyEyes && !showSleepingEyes;

  const handlePart = (part: MascotPart) => {
    if (interactiveParts) {
      anim.triggerPartReaction(part);
    }
    onPartPress?.(part);
  };

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      testID={`mascot-rig-${resolvedState}`}
    >
      <Svg width={size} height={size} viewBox="0 0 500 500">
        <AnimatedG
          testID="rig-whole"
          originX={250}
          originY={280}
          translateX={anim.wholeX}
          translateY={anim.wholeY}
          rotation={anim.wholeRotate}
        >
          {!isCompact && resolvedState === 'happy' && (
            <AnimatedG
              testID="fx-sparkles"
              originX={250}
              originY={180}
              translateY={anim.fxSparkleY}
              scale={anim.fxSparkleScale}
              opacity={anim.fxSparkleOpacity}
              stroke={c.bowtie}
              strokeWidth={10}
              strokeLinecap="round"
              fill="none"
            >
              <Path d="M 74 140 L 74 176 M 56 158 L 92 158" />
              <Path d="M 432 168 L 432 198 M 417 183 L 447 183" />
              <Circle cx={105} cy={96} r={6} fill={c.bowtie} stroke="none" />
              <Circle cx={410} cy={238} r={6} fill={c.bowtie} stroke="none" />
            </AnimatedG>
          )}

          {!isCompact && resolvedState === 'surprised' && (
            <AnimatedG
              testID="fx-alert"
              originX={120}
              originY={90}
              scale={anim.fxAlertScale}
              opacity={anim.fxAlertOpacity}
              stroke={c.bowtie}
              strokeWidth={12}
              strokeLinecap="round"
            >
              <Line x1={115} y1={88} x2={90} y2={62} />
              <Line x1={168} y1={54} x2={155} y2={22} />
              <Line x1={88} y1={142} x2={54} y2={132} />
            </AnimatedG>
          )}

          {!isCompact && resolvedState === 'thinking' && (
            <G testID="fx-thinking" fill={c.fill} stroke={c.stroke} strokeWidth={10}>
              <AnimatedG originX={404} originY={148} translateY={anim.fxDot1Y} opacity={anim.fxDot1Opacity}>
                <Circle cx={404} cy={148} r={10} />
              </AnimatedG>
              <AnimatedG originX={432} originY={112} translateY={anim.fxDot2Y} opacity={anim.fxDot2Opacity}>
                <Circle cx={432} cy={112} r={15} />
              </AnimatedG>
              <AnimatedG originX={456} originY={66} translateY={anim.fxDot3Y} opacity={anim.fxDot3Opacity}>
                <Circle cx={456} cy={66} r={21} />
              </AnimatedG>
            </G>
          )}

          {!isCompact && resolvedState === 'sleeping' && (
            <G
              testID="fx-zzz"
              fill="none"
              stroke={c.stroke}
              strokeWidth={10}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <AnimatedG originX={400} originY={165} translateX={anim.fxZ1X} translateY={anim.fxZ1Y} opacity={anim.fxZ1Opacity}>
                <Path d="M 386 150 H 414 L 386 180 H 414" />
              </AnimatedG>
              <AnimatedG originX={428} originY={132} translateX={anim.fxZ2X} translateY={anim.fxZ2Y} opacity={anim.fxZ2Opacity}>
                <Path d="M 412 115 H 444 L 412 149 H 444" />
              </AnimatedG>
              <AnimatedG originX={454} originY={99} translateX={anim.fxZ3X} translateY={anim.fxZ3Y} opacity={anim.fxZ3Opacity}>
                <Path d="M 436 80 H 472 L 436 118 H 472" />
              </AnimatedG>
            </G>
          )}

          <G testID="rig-body">
            <Path d="M 53 372 C 41 360, 35 345, 35 329 A 36 43 0 0 1 71 286 A 30 25 0 0 1 101 311 A 18 17 0 0 1 83 328 C 78 342, 78 350, 88 354 A 40 45 0 0 0 53 372 Z" fill={c.fill} stroke="none" />
            <Path d="M 447 372 C 459 360, 465 345, 465 329 A 36 43 0 0 0 429 286 A 30 25 0 0 0 399 311 A 18 17 0 0 0 417 328 C 422 342, 422 350, 412 354 A 40 45 0 0 1 447 372 Z" fill={c.fill} stroke="none" />
            <Path d="M 88 354 C 122 354, 141.8 325.8, 126 301 A 147 147 0 1 1 374 301 C 358.2 325.8, 378 354, 412 354 A 40 45 0 0 1 452 399 A 52 53 0 0 1 400 452 C 380 452, 362 447, 351 434 A 53 53 0 0 1 303 465 A 53 53 0 0 1 250 412 A 53 53 0 0 1 197 465 A 53 53 0 0 1 149 434 C 138 447, 120 452, 100 452 A 52 53 0 0 1 48 399 A 40 45 0 0 1 88 354 Z" fill={c.fill} stroke="none" />
            <Path d="M 53 372 C 41 360, 35 345, 35 329 A 36 43 0 0 1 71 286 A 30 25 0 0 1 101 311 A 18 17 0 0 1 83 328 A 13 14 0 0 1 70 314" fill="none" stroke={c.stroke} strokeWidth={16.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 447 372 C 459 360, 465 345, 465 329 A 36 43 0 0 0 429 286 A 30 25 0 0 0 399 311 A 18 17 0 0 0 417 328 A 13 14 0 0 0 430 314" fill="none" stroke={c.stroke} strokeWidth={16.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 88 354 C 122 354, 141.8 325.8, 126 301 A 147 147 0 1 1 374 301 C 358.2 325.8, 378 354, 412 354" fill="none" stroke={c.stroke} strokeWidth={16.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 149 434 C 138 447, 120 452, 100 452 A 52 53 0 0 1 48 399 A 40 45 0 0 1 88 354 A 29 31 0 0 1 117 385 A 21 27 0 0 1 96 412 A 17 17 0 0 1 79 395 A 8 11 0 0 1 86 384" fill="none" stroke={c.stroke} strokeWidth={16.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 351 434 C 362 447, 380 452, 400 452 A 52 53 0 0 0 452 399 A 40 45 0 0 0 412 354 A 29 31 0 0 0 383 385 A 21 27 0 0 0 404 412 A 17 17 0 0 0 421 395 A 8 11 0 0 0 414 384" fill="none" stroke={c.stroke} strokeWidth={16.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 250 368 L 250 412 A 53 53 0 0 1 197 465 A 53 53 0 0 1 144 412 A 42 45 0 0 1 186 367 A 34 32 0 0 1 220 399 A 24 27 0 0 1 196 426 A 21 20 0 0 1 175 406 A 8 12 0 0 1 183 394" fill="none" stroke={c.stroke} strokeWidth={16.5} strokeLinecap="round" strokeLinejoin="round" />
            <Path d="M 250 368 L 250 412 A 53 53 0 0 0 303 465 A 53 53 0 0 0 356 412 A 42 45 0 0 0 314 367 A 34 32 0 0 0 280 399 A 24 27 0 0 0 304 426 A 21 20 0 0 0 325 406 A 8 12 0 0 0 317 394" fill="none" stroke={c.stroke} strokeWidth={16.5} strokeLinecap="round" strokeLinejoin="round" />
          </G>

          <AnimatedG
            testID="rig-bowtie"
            originX={250}
            originY={316}
            translateX={anim.bowtieX}
            translateY={anim.bowtieY}
            rotation={anim.bowtieRotate}
            scale={anim.bowtieScale}
            onPress={interactiveParts || onPartPress ? () => handlePart('bowtie') : undefined}
          >
            <Path d="M 211 299 C 211 295, 215 293, 219 295 L 244 307 L 244 325 L 219 337 C 215 339, 211 337, 211 333 Z" fill={c.bowtie} />
            <Path d="M 289 299 C 289 295, 285 293, 281 295 L 256 307 L 256 325 L 281 337 C 285 339, 289 337, 289 333 Z" fill={c.bowtie} />
            <Rect x={239} y={304} width={22} height={24} rx={7} fill={c.bowtie} />
          </AnimatedG>

          <AnimatedG
            testID="rig-eyes-group"
            originX={250}
            originY={211.5}
            translateX={anim.eyesX}
            translateY={anim.eyesY}
            onPress={interactiveParts || onPartPress ? () => handlePart('eyes') : undefined}
          >
            {showDefaultEyes && (
              <G testID="eyes-default">
                <AnimatedG
                  testID="rig-eye-left"
                  originX={209}
                  originY={211.5}
                  scaleX={anim.eyeLeftScale}
                  scaleY={Animated.multiply(anim.eyeLeftScaleY, anim.eyeLeftScale)}
                >
                  <Rect x={195} y={176} width={28} height={71} rx={14} fill={c.eyes} />
                </AnimatedG>
                <AnimatedG
                  testID="rig-eye-right"
                  originX={291}
                  originY={211.5}
                  scaleX={anim.eyeRightScale}
                  scaleY={Animated.multiply(anim.eyeRightScaleY, anim.eyeRightScale)}
                >
                  <Rect x={277} y={176} width={28} height={71} rx={14} fill={c.eyes} />
                </AnimatedG>
              </G>
            )}

            {showHappyEyes && (
              <G testID="eyes-happy" fill="none" stroke={c.eyes} strokeWidth={18} strokeLinecap="round">
                <Path d="M 190 220 C 198 194, 220 194, 228 220" />
                <Path d="M 272 220 C 280 194, 302 194, 310 220" />
              </G>
            )}

            {showSleepingEyes && (
              <G testID="eyes-sleeping" fill="none" stroke={c.eyes} strokeWidth={16} strokeLinecap="round">
                <Path d="M 190 214 C 198 232, 220 232, 228 214" />
                <Path d="M 272 214 C 280 232, 302 232, 310 214" />
              </G>
            )}
          </AnimatedG>

          <AnimatedG
            testID="rig-hat"
            originX={332}
            originY={104}
            translateX={anim.hatX}
            translateY={anim.hatY}
            rotation={anim.hatRotate}
            onPress={interactiveParts || onPartPress ? () => handlePart('hat') : undefined}
          >
            <G transform="translate(332, 92) rotate(27.5)">
              {isNotification ? (
                <Rect x={-32} y={-12} width={64} height={14} rx={3} fill={c.band} />
              ) : (
                <>
                  <Rect x={-42} y={-64} width={84} height={66} rx={22} fill={c.hat} stroke={c.hat} strokeWidth={8} />
                  <Rect x={-33} y={-18} width={66} height={14} rx={2} fill={c.band} />
                  <Path d="M -64 -2 Q 0 11 64 -2" fill="none" stroke={c.hat} strokeWidth={15} strokeLinecap="round" />
                </>
              )}
            </G>
          </AnimatedG>
        </AnimatedG>
      </Svg>
    </View>
  );
};
