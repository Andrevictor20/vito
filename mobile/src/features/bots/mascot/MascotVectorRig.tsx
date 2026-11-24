import React, { useEffect } from 'react';
import { Platform, Pressable, StyleProp, View, ViewStyle } from 'react-native';
import Animated, { Extrapolation, interpolate, useAnimatedProps } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Path, Rect, type GProps, type RectProps } from 'react-native-svg';
import { useTheme } from '../../../context/ThemeContext';
import {
  ALERT_LINES,
  BODY_FILL_PATHS,
  BODY_STROKE_PATHS,
  BOWTIE_WING_PATHS,
  HAPPY_EYE_PATHS,
  HAT_BRIM_PATH,
  SLEEPING_EYE_PATHS,
  SPARKLE_CROSS_PATHS,
  SPARKLE_DOTS,
  THINKING_DOTS,
  ZZZ_PATHS,
} from './mascotGeometry';
import {
  MascotAnimationState,
  MascotPart,
  MascotSkin,
  normalizeMascotState,
  resolveSkin,
} from './mascotPalettes';
import { MascotSkiaCanvas } from './MascotSkiaCanvas';
import { useMascotAnimation } from './useMascotAnimation';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedRect = Animated.createAnimatedComponent(Rect);

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

  const handlePart = (part: MascotPart) => {
    if (interactiveParts) {
      anim.triggerPartReaction(part);
    }
    onPartPress?.(part);
  };

  const wholeProps = useAnimatedProps<Partial<GProps>>(() => ({
    x: anim.wholeX.value,
    y: anim.wholeY.value,
    rotation: anim.wholeRotate.value,
  }));

  const bowtieProps = useAnimatedProps<Partial<GProps>>(() => ({
    x: anim.bowtieX.value,
    y: anim.bowtieY.value,
    rotation: anim.bowtieRotate.value,
    scale: anim.bowtieScale.value,
  }));

  const eyesProps = useAnimatedProps<Partial<GProps>>(() => ({
    x: anim.eyesX.value,
    y: anim.eyesY.value,
  }));

  const eyeLeftGroupProps = useAnimatedProps<Partial<GProps>>(() => ({
    scale: anim.eyeLeftScale.value,
  }));

  const eyeRightGroupProps = useAnimatedProps<Partial<GProps>>(() => ({
    scale: anim.eyeRightScale.value,
  }));

  const eyeLeftRectProps = useAnimatedProps<Partial<RectProps>>(() => ({
    y: interpolate(anim.eyeLeftScaleY.value, [0.06, 1], [209.25, 176], Extrapolation.CLAMP),
    height: interpolate(anim.eyeLeftScaleY.value, [0.06, 1], [4.5, 71], Extrapolation.CLAMP),
  }));

  const eyeRightRectProps = useAnimatedProps<Partial<RectProps>>(() => ({
    y: interpolate(anim.eyeRightScaleY.value, [0.06, 1], [209.25, 176], Extrapolation.CLAMP),
    height: interpolate(anim.eyeRightScaleY.value, [0.06, 1], [4.5, 71], Extrapolation.CLAMP),
  }));

  const hatProps = useAnimatedProps<Partial<GProps>>(() => ({
    x: anim.hatX.value,
    y: anim.hatY.value,
    rotation: anim.hatRotate.value,
  }));

  const sparkleProps = useAnimatedProps<Partial<GProps>>(() => ({
    y: anim.fxSparkleY.value,
    scale: anim.fxSparkleScale.value,
    opacity: anim.fxSparkleOpacity.value,
  }));

  const alertProps = useAnimatedProps<Partial<GProps>>(() => ({
    scale: anim.fxAlertScale.value,
    opacity: anim.fxAlertOpacity.value,
  }));

  const dot1Props = useAnimatedProps<Partial<GProps>>(() => ({
    y: anim.fxDot1Y.value,
    opacity: anim.fxDot1Opacity.value,
  }));
  const dot2Props = useAnimatedProps<Partial<GProps>>(() => ({
    y: anim.fxDot2Y.value,
    opacity: anim.fxDot2Opacity.value,
  }));
  const dot3Props = useAnimatedProps<Partial<GProps>>(() => ({
    y: anim.fxDot3Y.value,
    opacity: anim.fxDot3Opacity.value,
  }));

  const z1Props = useAnimatedProps<Partial<GProps>>(() => ({
    x: anim.fxZ1X.value,
    y: anim.fxZ1Y.value,
    opacity: anim.fxZ1Opacity.value,
  }));
  const z2Props = useAnimatedProps<Partial<GProps>>(() => ({
    x: anim.fxZ2X.value,
    y: anim.fxZ2Y.value,
    opacity: anim.fxZ2Opacity.value,
  }));
  const z3Props = useAnimatedProps<Partial<GProps>>(() => ({
    x: anim.fxZ3X.value,
    y: anim.fxZ3Y.value,
    opacity: anim.fxZ3Opacity.value,
  }));

  const hasPartTap = Boolean(interactiveParts || onPartPress);

  if (Platform.OS !== 'web') {
    const u = size / 500;
    return (
      <View
        style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
        testID={`mascot-rig-${resolvedState}`}
      >
        <MascotSkiaCanvas
          size={size}
          resolvedState={resolvedState}
          colors={c}
          isCompact={isCompact}
          isNotification={isNotification}
          anim={anim}
        />
        {hasPartTap ? (
          <>
            <Pressable
              accessibilityLabel="Cartola do mascote"
              onPress={() => handlePart('hat')}
              style={{ position: 'absolute', left: 265 * u, top: 20 * u, width: 145 * u, height: 115 * u }}
            />
            <Pressable
              accessibilityLabel="Olhos do mascote"
              onPress={() => handlePart('eyes')}
              style={{ position: 'absolute', left: 175 * u, top: 165 * u, width: 150 * u, height: 95 * u }}
            />
            <Pressable
              accessibilityLabel="Gravata do mascote"
              onPress={() => handlePart('bowtie')}
              style={{ position: 'absolute', left: 200 * u, top: 285 * u, width: 100 * u, height: 64 * u }}
            />
          </>
        ) : null}
      </View>
    );
  }

  const showHappyEyes = resolvedState === 'happy';
  const showSleepingEyes = resolvedState === 'sleeping';
  const showDefaultEyes = !showHappyEyes && !showSleepingEyes;

  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      testID={`mascot-rig-${resolvedState}`}
    >
      <Svg width={size} height={size} viewBox="0 0 500 500">
        <AnimatedG testID="rig-whole" originX={250} originY={280} animatedProps={wholeProps}>
          {!isCompact && resolvedState === 'happy' && (
            <AnimatedG
              testID="fx-sparkles"
              originX={250}
              originY={180}
              animatedProps={sparkleProps}
              stroke={c.bowtie}
              strokeWidth={10}
              strokeLinecap="round"
              fill="none"
            >
              {SPARKLE_CROSS_PATHS.map((d, idx) => (
                <Path key={idx} d={d} />
              ))}
              {SPARKLE_DOTS.map((pt, idx) => (
                <Circle key={idx} cx={pt.cx} cy={pt.cy} r={pt.r} fill={c.bowtie} stroke="none" />
              ))}
            </AnimatedG>
          )}

          {!isCompact && resolvedState === 'surprised' && (
            <AnimatedG
              testID="fx-alert"
              originX={120}
              originY={90}
              animatedProps={alertProps}
              stroke={c.bowtie}
              strokeWidth={12}
              strokeLinecap="round"
            >
              {ALERT_LINES.map((ln, idx) => (
                <Line key={idx} x1={ln.x1} y1={ln.y1} x2={ln.x2} y2={ln.y2} />
              ))}
            </AnimatedG>
          )}

          {!isCompact && resolvedState === 'thinking' && (
            <G testID="fx-thinking" fill={c.fill} stroke={c.stroke} strokeWidth={10}>
              <AnimatedG originX={404} originY={148} animatedProps={dot1Props}>
                <Circle cx={THINKING_DOTS[0].cx} cy={THINKING_DOTS[0].cy} r={THINKING_DOTS[0].r} />
              </AnimatedG>
              <AnimatedG originX={432} originY={112} animatedProps={dot2Props}>
                <Circle cx={THINKING_DOTS[1].cx} cy={THINKING_DOTS[1].cy} r={THINKING_DOTS[1].r} />
              </AnimatedG>
              <AnimatedG originX={456} originY={66} animatedProps={dot3Props}>
                <Circle cx={THINKING_DOTS[2].cx} cy={THINKING_DOTS[2].cy} r={THINKING_DOTS[2].r} />
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
              <AnimatedG originX={400} originY={165} animatedProps={z1Props}>
                <Path d={ZZZ_PATHS[0].d} />
              </AnimatedG>
              <AnimatedG originX={428} originY={132} animatedProps={z2Props}>
                <Path d={ZZZ_PATHS[1].d} />
              </AnimatedG>
              <AnimatedG originX={454} originY={99} animatedProps={z3Props}>
                <Path d={ZZZ_PATHS[2].d} />
              </AnimatedG>
            </G>
          )}

          <G testID="rig-body">
            {BODY_FILL_PATHS.map((d, idx) => (
              <Path key={`bf-${idx}`} d={d} fill={c.fill} stroke="none" />
            ))}
            {BODY_STROKE_PATHS.map((d, idx) => (
              <Path
                key={`bs-${idx}`}
                d={d}
                fill="none"
                stroke={c.stroke}
                strokeWidth={16.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
          </G>

          <AnimatedG
            testID="rig-bowtie"
            originX={250}
            originY={316}
            animatedProps={bowtieProps}
            onPress={hasPartTap ? () => handlePart('bowtie') : undefined}
          >
            {BOWTIE_WING_PATHS.map((d, idx) => (
              <Path key={`bw-${idx}`} d={d} fill={c.bowtie} />
            ))}
            <Rect x={239} y={304} width={22} height={24} rx={7} fill={c.bowtie} />
          </AnimatedG>

          <AnimatedG
            testID="rig-eyes-group"
            originX={250}
            originY={211.5}
            animatedProps={eyesProps}
            onPress={hasPartTap ? () => handlePart('eyes') : undefined}
          >
            {showDefaultEyes && (
              <G testID="eyes-default">
                <AnimatedG testID="rig-eye-left" originX={209} originY={211.5} animatedProps={eyeLeftGroupProps}>
                  <AnimatedRect x={195} width={28} rx={14} fill={c.eyes} animatedProps={eyeLeftRectProps} />
                </AnimatedG>
                <AnimatedG testID="rig-eye-right" originX={291} originY={211.5} animatedProps={eyeRightGroupProps}>
                  <AnimatedRect x={277} width={28} rx={14} fill={c.eyes} animatedProps={eyeRightRectProps} />
                </AnimatedG>
              </G>
            )}

            {showHappyEyes && (
              <G testID="eyes-happy" fill="none" stroke={c.eyes} strokeWidth={18} strokeLinecap="round">
                {HAPPY_EYE_PATHS.map((d, idx) => (
                  <Path key={idx} d={d} />
                ))}
              </G>
            )}

            {showSleepingEyes && (
              <G testID="eyes-sleeping" fill="none" stroke={c.eyes} strokeWidth={16} strokeLinecap="round">
                {SLEEPING_EYE_PATHS.map((d, idx) => (
                  <Path key={idx} d={d} />
                ))}
              </G>
            )}
          </AnimatedG>

          <AnimatedG
            testID="rig-hat"
            originX={332}
            originY={104}
            animatedProps={hatProps}
            onPress={hasPartTap ? () => handlePart('hat') : undefined}
          >
            <G transform="translate(332, 92) rotate(27.5)">
              {isNotification ? (
                <Rect x={-32} y={-12} width={64} height={14} rx={3} fill={c.band} />
              ) : (
                <>
                  <Rect x={-42} y={-64} width={84} height={66} rx={22} fill={c.hat} stroke={c.hat} strokeWidth={8} />
                  <Rect x={-33} y={-18} width={66} height={14} rx={2} fill={c.band} />
                  <Path d={HAT_BRIM_PATH} fill="none" stroke={c.hat} strokeWidth={15} strokeLinecap="round" />
                </>
              )}
            </G>
          </AnimatedG>
        </AnimatedG>
      </Svg>
    </View>
  );
};
