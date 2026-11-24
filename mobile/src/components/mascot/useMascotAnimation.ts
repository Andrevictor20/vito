import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AccessibilityInfo } from 'react-native';
import {
  Easing,
  cancelAnimation,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { MascotAnimationState, MascotPart } from './mascotPalettes';
import { type MascotAnimValues, startStateAnimations } from './mascotAnimationBuilders';

export interface UseMascotAnimationOptions {
  state: MascotAnimationState;
  animated: boolean;
  speed?: number;
}

/**
 * Motor de animação do mascote 100% na UI thread (Reanimated 4 SharedValues).
 * Zero ponte JS por frame e suporte estrito a ReduceMotion do sistema.
 */
export function useMascotAnimation({
  state,
  animated,
  speed = 1,
}: UseMascotAnimationOptions) {
  const safeSpeed = Math.max(0.25, speed);

  const wholeX = useSharedValue(0);
  const wholeY = useSharedValue(0);
  const wholeRotate = useSharedValue(0);
  const hatX = useSharedValue(0);
  const hatY = useSharedValue(0);
  const hatRotate = useSharedValue(0);
  const eyesX = useSharedValue(0);
  const eyesY = useSharedValue(0);
  const eyeLeftScaleY = useSharedValue(1);
  const eyeRightScaleY = useSharedValue(1);
  const eyeLeftScale = useSharedValue(1);
  const eyeRightScale = useSharedValue(1);
  const bowtieX = useSharedValue(0);
  const bowtieY = useSharedValue(0);
  const bowtieRotate = useSharedValue(0);
  const bowtieScale = useSharedValue(1);

  const fxSparkleOpacity = useSharedValue(0);
  const fxSparkleY = useSharedValue(4);
  const fxSparkleScale = useSharedValue(0.85);
  const fxAlertOpacity = useSharedValue(0);
  const fxAlertScale = useSharedValue(0.8);
  const fxDot1Opacity = useSharedValue(0.25);
  const fxDot2Opacity = useSharedValue(0.25);
  const fxDot3Opacity = useSharedValue(0.25);
  const fxDot1Y = useSharedValue(3);
  const fxDot2Y = useSharedValue(3);
  const fxDot3Y = useSharedValue(3);
  const fxZ1Opacity = useSharedValue(0);
  const fxZ1X = useSharedValue(0);
  const fxZ1Y = useSharedValue(8);
  const fxZ2Opacity = useSharedValue(0);
  const fxZ2X = useSharedValue(0);
  const fxZ2Y = useSharedValue(8);
  const fxZ3Opacity = useSharedValue(0);
  const fxZ3X = useSharedValue(0);
  const fxZ3Y = useSharedValue(8);

  const values: MascotAnimValues = useMemo(
    () => ({
      wholeX, wholeY, wholeRotate,
      hatX, hatY, hatRotate,
      eyesX, eyesY,
      eyeLeftScaleY, eyeRightScaleY, eyeLeftScale, eyeRightScale,
      bowtieX, bowtieY, bowtieRotate, bowtieScale,
      fxSparkleOpacity, fxSparkleY, fxSparkleScale,
      fxAlertOpacity, fxAlertScale,
      fxDot1Opacity, fxDot2Opacity, fxDot3Opacity,
      fxDot1Y, fxDot2Y, fxDot3Y,
      fxZ1Opacity, fxZ1X, fxZ1Y,
      fxZ2Opacity, fxZ2X, fxZ2Y,
      fxZ3Opacity, fxZ3X, fxZ3Y,
    }),
    [
      bowtieRotate, bowtieScale, bowtieX, bowtieY,
      eyeLeftScale, eyeLeftScaleY, eyeRightScale, eyeRightScaleY, eyesX, eyesY,
      fxAlertOpacity, fxAlertScale, fxDot1Opacity, fxDot1Y, fxDot2Opacity, fxDot2Y,
      fxDot3Opacity, fxDot3Y, fxSparkleOpacity, fxSparkleScale, fxSparkleY,
      fxZ1Opacity, fxZ1X, fxZ1Y, fxZ2Opacity, fxZ2X, fxZ2Y, fxZ3Opacity, fxZ3X, fxZ3Y,
      hatRotate, hatX, hatY, wholeRotate, wholeX, wholeY,
    ]
  );

  const reduceMotionRef = useRef(false);

  const resetAll = useCallback(() => {
    const all = Object.values(values);
    all.forEach((sv) => cancelAnimation(sv));

    [
      wholeX, wholeY, wholeRotate, hatX, hatY, hatRotate, eyesX, eyesY,
      bowtieX, bowtieY, bowtieRotate, fxAlertOpacity,
      fxZ1Opacity, fxZ2Opacity, fxZ3Opacity, fxZ1X, fxZ2X, fxZ3X,
    ].forEach((sv) => {
      sv.value = 0;
    });
    [eyeLeftScaleY, eyeRightScaleY, eyeLeftScale, eyeRightScale, bowtieScale].forEach((sv) => {
      sv.value = 1;
    });
    fxSparkleOpacity.value = state === 'happy' ? 1 : 0;
    fxSparkleY.value = 0;
    fxSparkleScale.value = 1;
    fxAlertScale.value = 1;
    [fxDot1Opacity, fxDot2Opacity, fxDot3Opacity].forEach((sv) => {
      sv.value = state === 'thinking' ? 0.85 : 0.25;
    });
    [fxDot1Y, fxDot2Y, fxDot3Y, fxZ1Y, fxZ2Y, fxZ3Y].forEach((sv) => {
      sv.value = 0;
    });
  }, [
    bowtieRotate, bowtieScale, bowtieX, bowtieY,
    eyeLeftScale, eyeLeftScaleY, eyeRightScale, eyeRightScaleY, eyesX, eyesY,
    fxAlertOpacity, fxAlertScale, fxDot1Opacity, fxDot1Y, fxDot2Opacity, fxDot2Y,
    fxDot3Opacity, fxDot3Y, fxSparkleOpacity, fxSparkleScale, fxSparkleY,
    fxZ1Opacity, fxZ1X, fxZ1Y, fxZ2Opacity, fxZ2X, fxZ2Y, fxZ3Opacity, fxZ3X, fxZ3Y,
    hatRotate, hatX, hatY, state, values, wholeRotate, wholeX, wholeY,
  ]);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (mounted) {
          reduceMotionRef.current = enabled;
          if (enabled) resetAll();
        }
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', (enabled) => {
      reduceMotionRef.current = enabled;
      if (enabled) resetAll();
    });
    return () => {
      mounted = false;
      sub?.remove?.();
    };
  }, [resetAll]);

  useEffect(() => {
    resetAll();
    if (!animated || reduceMotionRef.current) return;

    startStateAnimations(state, values, safeSpeed);
    return () => {
      Object.values(values).forEach((sv) => cancelAnimation(sv));
    };
  }, [animated, resetAll, safeSpeed, state, values]);

  const triggerPartReaction = useCallback(
    (part: MascotPart) => {
      if (reduceMotionRef.current) return;
      if (part === 'hat') {
        const backOut = Easing.out(Easing.back(1.6));
        hatX.value = withSequence(
          withTiming(16, { duration: 240, easing: backOut }),
          withDelay(140, withTiming(0, { duration: 220 }))
        );
        hatY.value = withSequence(
          withTiming(-26, { duration: 240, easing: backOut }),
          withDelay(140, withTiming(0, { duration: 220 }))
        );
        hatRotate.value = withSequence(
          withTiming(20, { duration: 240, easing: backOut }),
          withDelay(140, withTiming(0, { duration: 220 }))
        );
      } else if (part === 'bowtie') {
        bowtieRotate.value = 0;
        bowtieRotate.value = withSequence(
          withTiming(360, { duration: 520, easing: Easing.inOut(Easing.ease) }),
          withTiming(0, { duration: 0 })
        );
        bowtieScale.value = withSequence(
          withTiming(1.18, { duration: 260 }),
          withTiming(1, { duration: 180 })
        );
      } else {
        eyeLeftScaleY.value = withSequence(
          withTiming(0.08, { duration: 90 }),
          withTiming(1, { duration: 110 })
        );
        eyeRightScaleY.value = withSequence(
          withTiming(0.08, { duration: 90 }),
          withTiming(1, { duration: 110 })
        );
      }
    },
    [bowtieRotate, bowtieScale, eyeLeftScaleY, eyeRightScaleY, hatRotate, hatX, hatY]
  );

  return {
    ...values,
    triggerPartReaction,
  };
}
